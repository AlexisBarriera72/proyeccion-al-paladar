// Sesión → Tu grupo → Datos de contacto → Revisar → Confirmación.
// The draft (with its mutation ID and management token) is kept in this tab's storage, so a
// lost response can be retried safely and the link rebuilt. The screen says only what the
// server answered.
import {useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {CalendarDays, CircleCheck, Copy, Hourglass, MessageCircle, Minus, Plus} from 'lucide-react';
import type {BookingStatus, ManageView, PublicSession, PublicTerms, TextStatus} from '../../shared/types.ts';
import {formatLongDate, formatShortDate, formatTime} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {postJson} from '../lib/api.ts';
import {newMutationId, newToken} from '../lib/ids.ts';
import {readJson, remove, writeJson} from '../lib/storage.ts';
import {copyText} from '../lib/copy.ts';
import {formatMoney, pick} from '../lib/format.ts';
import {SPRING} from '../lib/motion.ts';
import {detailTitle, doorNumber, helper, inset, kicker, numbers, sectionTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Dialog} from '../components/ui/dialog.tsx';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Field, Input, Textarea, describedBy} from '../components/ui/field.tsx';
import {Checkbox, Choices} from '../components/ui/choice.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {Price} from '../components/Price.tsx';
import {Ticket, TicketDate} from '../components/Ticket.tsx';
import {Popcorn} from '../components/Popcorn.tsx';
import {PolicyBlock, WhenText} from './SessionDetail.tsx';
import {CalendarExport} from './CalendarExport.tsx';
import {draftKey, receiptKey} from './flowStorage.ts';

const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_DM = 'https://ig.me/m/proyeccionalpaladarpr';

type Step = 1 | 2 | 3 | 4 | 5;

interface Draft {
  step: Step;
  partySize: number;
  leadName: string;
  contactKind: 'phone' | 'email';
  contactValue: string;
  note: string;
  accepted: boolean;
  /** The terms the guest ticked "I accept" for: a saved tick counts only for those same terms. */
  acceptedKey?: string | null;
  /** The guest asked for their booking number by text (phone only, when texts are on). */
  textConsent?: boolean;
  mutationId: string;
  token: string;
}

interface Receipt {
  bookingId: string | null;
  reference: string;
  status: BookingStatus;
  token: string | null;
  partySize: number;
  replaced?: boolean;
  intent?: 'reserve' | 'request';
  /** The text with the booking number, as the provider answered (null: none was sent). */
  text?: TextStatus | null;
  /** The guest asked for a text, but their number can't take one. */
  textNumberRefused?: boolean;
}

/** One key per set of terms: policy version and price. */
const termsKey = (terms: PublicTerms | null) =>
  terms ? [terms.policyVersionId, terms.priceStatus, terms.unitPriceCents, terms.currency].join('|') : null;

/** The largest group the guest may choose: the session's limit, and the seats left when reserving. */
const largestGroup = (session: PublicSession) =>
  Math.min(session.partyMax ?? 60, session.action === 'reserve' && session.remaining !== null ? session.remaining : 60);

function freshDraft(session: PublicSession, kind: 'phone' | 'email'): Draft {
  return {
    step: 1,
    partySize: Math.max(session.partyMin ?? 1, Math.min(2, largestGroup(session))),
    leadName: '',
    contactKind: kind,
    contactValue: '',
    note: '',
    accepted: false,
    acceptedKey: null,
    textConsent: false,
    mutationId: newMutationId(),
    token: newToken(),
  };
}

/** A saved draft, with its group size brought within what the session allows now. */
function restoredDraft(session: PublicSession, kind: 'phone' | 'email'): Draft {
  const saved = readJson<Draft>('session', draftKey(session.id));
  if (!saved) return freshDraft(session, kind);
  const min = session.partyMin ?? 1;
  return {...saved, partySize: Math.max(min, Math.min(largestGroup(session), saved.partySize))};
}

type Problem = {message: string; kind: 'lost' | 'retry' | 'final' | 'otherDates'} | null;

export function ReserveFlow({
  session,
  open,
  onOpenChange,
  onSessionChanged,
}: {
  session: PublicSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionChanged: () => void;
}) {
  const {t, lang} = useT();
  const config = useConfig();
  const ids = useId();
  const required = config?.requiredContact;
  const lockedKind = required === 'phone' || required === 'email' ? required : null;
  const [draft, setDraftState] = useState<Draft>(() => restoredDraft(session, lockedKind ?? 'phone'));
  const [receipt, setReceipt] = useState<Receipt | null>(() => readJson<Receipt>('session', receiptKey(session.id)));
  // A receipt keeps the kind of booking it was made as, even after the session stops selling.
  const reserve = receipt
    ? (receipt.intent ?? (['confirmed', 'pending_payment'].includes(receipt.status) ? 'reserve' : 'request')) ===
      'reserve'
    : session.action === 'reserve';
  // "I accept" counts only for the terms on screen now, not for terms a saved draft once showed.
  const currentTerms = termsKey(session.terms);
  const accepted = draft.accepted && draft.acceptedKey === currentTerms;
  // Texts are offered only when the business has set them up, and only for a phone.
  const textsOffered = Boolean(config?.texts) && draft.contactKind === 'phone';
  // The group size as typed, so a field can be cleared and retyped without jumping.
  const [partyText, setPartyText] = useState(() => String(draft.partySize));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<Problem>(null);
  const [sending, setSending] = useState(false);
  // True only right after the server confirmed this reservation; a reopened receipt stays still.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!open) setCelebrate(false);
  }, [open]);
  // Some answers change what the session page should show (no seats left, closed). Refreshing it
  // while the sheet is open would take the sheet away before its message is read, so it waits.
  const refreshOnClose = useRef(false);
  useEffect(() => {
    if (open || !refreshOnClose.current) return;
    refreshOnClose.current = false;
    onSessionChanged();
  }, [open, onSessionChanged]);
  // Focus moves to each step's heading once that step is on screen, after the previous step has
  // left (the steps change with an exit animation), so the change is announced. The heading's
  // ref runs when the new step mounts; the effect below asks for it on every step change.
  const wantFocus = useRef(true);
  const headingRef = useCallback((heading: HTMLHeadingElement | null) => {
    if (!heading || !wantFocus.current) return;
    wantFocus.current = false;
    requestAnimationFrame(() => heading.focus());
  }, []);
  const problemRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const acceptId = `${ids}-accept`;
  const step: Step = receipt ? 5 : draft.step;

  const setDraft = (patch: Partial<Draft>) =>
    setDraftState(current => {
      const next = {...current, ...patch};
      writeJson('session', draftKey(session.id), next);
      return next;
    });

  useEffect(() => {
    if (lockedKind && draft.contactKind !== lockedKind) setDraft({contactKind: lockedKind});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedKind]);

  // A problem appears at the end of the review, above the footer: bring it into view.
  useEffect(() => {
    if (problem) requestAnimationFrame(() => problemRef.current?.scrollIntoView({block: 'nearest'}));
  }, [problem]);

  useEffect(() => {
    wantFocus.current = true;
  }, [step, open]);

  const max = largestGroup(session);
  const min = session.partyMin ?? 1;
  const partyTyped = /^\d+$/.test(partyText.trim()) ? Number(partyText.trim()) : null;
  const partyValid = partyTyped !== null && partyTyped >= min && partyTyped <= max;
  const setParty = (n: number) => {
    setDraft({partySize: n});
    setPartyText(String(n));
  };

  const stepNames = [t('flow.step1'), t('flow.step2'), t('flow.step3'), t('flow.step4'), t('flow.step5')];
  const go = (next: Step) => {
    setProblem(null);
    setDraft({step: next});
  };

  const validateContact = () => {
    const found: Record<string, string> = {};
    if (draft.leadName.trim().length < 2) found.leadName = t('error.name');
    const value = draft.contactValue.trim();
    if (draft.contactKind === 'phone' ? !PHONE.test(value) : !EMAIL.test(value)) {
      found.contactValue = draft.contactKind === 'phone' ? t('error.phone') : t('error.email');
    }
    if (draft.note.length > 280) found.note = t('error.note');
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const finish = (next: Receipt) => {
    remove('session', draftKey(session.id));
    writeJson('session', receiptKey(session.id), next);
    setReceipt(next);
    setProblem(null);
    setCelebrate(next.status === 'confirmed' && !next.replaced);
    // The seats this booking took show on the session page once the sheet closes.
    refreshOnClose.current = true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reserve && !accepted) {
      setErrors({accepted: t('flow.acceptRequired')});
      // The submit sits in the footer, so bring the checkbox and its error into view.
      requestAnimationFrame(() => {
        const box = document.getElementById(acceptId);
        box?.focus();
        box?.scrollIntoView({block: 'center'});
      });
      return;
    }
    if (!navigator.onLine) {
      setProblem({message: t('error.offline'), kind: 'retry'});
      return;
    }
    setSending(true);
    setProblem(null);
    const terms =
      reserve && session.terms
        ? {
            policyVersionId: session.terms.policyVersionId,
            priceStatus: session.terms.priceStatus,
            unitPriceCents: session.terms.unitPriceCents,
            currency: session.terms.currency,
          }
        : null;
    const result = await postJson<{
      bookingId?: string;
      reference: string;
      status?: BookingStatus;
      linkReplaced?: boolean;
      text?: TextStatus | null;
      textNumberRefused?: boolean;
    }>(
      '/api/public/bookings',
      {
        intent: reserve ? 'reserve' : 'request',
        sessionId: session.id,
        partySize: draft.partySize,
        leadName: draft.leadName.trim(),
        contactKind: draft.contactKind,
        contactValue: draft.contactValue.trim(),
        note: draft.note.trim() || null,
        token: draft.token,
        terms,
        acceptedTerms: reserve ? accepted : false,
        textConsent: textsOffered && Boolean(draft.textConsent),
        lang,
      },
      draft.mutationId,
    );
    setSending(false);
    if (result.kind === 'lost') {
      // Same mutation ID and token on retry: it can't be duplicated.
      setProblem({message: t('error.lost'), kind: 'lost'});
      return;
    }
    if (result.kind === 'ok') {
      if (result.data.linkReplaced) {
        finish({
          bookingId: null,
          reference: result.data.reference,
          status: 'inquiry',
          token: null,
          partySize: draft.partySize,
          replaced: true,
          intent: reserve ? 'reserve' : 'request',
        });
      } else {
        finish({
          bookingId: result.data.bookingId!,
          reference: result.data.reference,
          status: result.data.status!,
          token: draft.token,
          partySize: draft.partySize,
          intent: reserve ? 'reserve' : 'request',
          text: result.data.text ?? null,
          textNumberRefused: Boolean(result.data.textNumberRefused),
        });
      }
      return;
    }
    const code = result.code;
    if (code === 'idempotency_conflict') {
      // The first attempt may have arrived with other details: look for it with our token.
      const found = await postJson<{booking: ManageView}>('/api/public/manage', {token: draft.token});
      if (found.kind === 'ok') {
        const b = found.data.booking;
        finish({
          bookingId: b.bookingId,
          reference: b.reference,
          status: b.status,
          token: draft.token,
          partySize: b.partySize,
          intent: reserve ? 'reserve' : 'request',
          text: b.text,
        });
        return;
      }
      setDraft({mutationId: newMutationId()});
      setProblem({message: t('error.conflict'), kind: 'retry'});
      return;
    }
    if (code === 'rate_limited') {
      setProblem({message: t('error.rate'), kind: 'retry'});
      return;
    }
    // A rejection is settled for this mutation ID: the next attempt gets a new one.
    setDraft({mutationId: newMutationId()});
    if (code === 'terms_changed' || code === 'mode_requires_terms' || code === 'mode_not_confirmed') {
      onSessionChanged();
      setDraft({accepted: false, acceptedKey: null, step: 4, mutationId: newMutationId()});
      setProblem({message: t('error.termsChanged'), kind: 'final'});
    } else if (code === 'no_seats') {
      refreshOnClose.current = true;
      setProblem({message: t('error.noSeats'), kind: 'otherDates'});
    } else if (code === 'party_size_limits') {
      setProblem({message: t('error.limits'), kind: 'final'});
    } else if (code === 'contact_kind_not_accepted') {
      setProblem({message: t('error.contactKind'), kind: 'final'});
    } else if (code === 'contact_invalid') {
      setDraft({step: 3});
      validateContact();
    } else if (
      [
        'session_not_open',
        'session_not_future',
        'confirmations_off',
        'venue_not_approved',
        'price_missing',
        'policy_not_approved',
        'capacity_missing',
        'contact_setting_missing',
        'session_not_found',
      ].includes(code)
    ) {
      refreshOnClose.current = true;
      setProblem({message: t('error.closed'), kind: 'otherDates'});
    } else {
      setProblem({message: t('error.generic'), kind: 'retry'});
    }
  };

  const startOver = () => {
    remove('session', receiptKey(session.id));
    setReceipt(null);
    setCelebrate(false);
    const fresh = freshDraft(session, lockedKind ?? 'phone');
    setDraftState(fresh);
    setPartyText(String(fresh.partySize));
  };

  const total =
    reserve && session.price.status === 'approved' && session.price.cents !== null && session.price.currency
      ? formatMoney(session.price.cents * draft.partySize, session.price.currency, lang)
      : null;
  const people = (n: number) => (n === 1 ? t('flow.person') : t('flow.people', {count: n}));

  const heading = (text: string) => (
    <h3 ref={headingRef} tabIndex={-1} className={cn(sectionTitle, 'focus:outline-none')}>
      {text}
    </h3>
  );
  const contactForm = `${ids}-contact-form`;
  const reviewForm = `${ids}-review-form`;
  const manageUrl = receipt?.token ? `${location.origin}/reservacion/${receipt.token}/` : null;
  // The actions sit in the sheet's footer, so they stay in view on every step.
  const actions = (back: Step | null, primary: ReactNode) => (
    <div className="flex gap-3">
      {back ? (
        <Button onClick={() => go(back)} disabled={sending}>
          {t('flow.back')}
        </Button>
      ) : null}
      {primary}
    </div>
  );

  let body;
  let footer: ReactNode = null;
  if (step === 1) {
    body = (
      <div className="space-y-4">
        {heading(t('flow.step1'))}
        <p className={helper}>{t('flow.sessionCheck')}</p>
        <dl className={cn(inset, 'space-y-3')}>
          <div>
            <dt className="sr-only">{t('flow.step1')}</dt>
            <dd className="text-base font-medium leading-6 text-ink">{pick(session.title, lang)}</dd>
          </div>
          <div>
            <dt className={helper}>{t('detail.when')}</dt>
            <dd>
              <WhenText session={session} />
            </dd>
          </div>
          <div>
            <dt className={helper}>{t('detail.where')}</dt>
            <dd>{session.venue ? session.venue.name : t('venue.tbd')}</dd>
          </div>
          <div>
            <dt className={helper}>{t('detail.price')}</dt>
            <dd className={numbers}>
              <Price price={session.price} />
            </dd>
          </div>
        </dl>
      </div>
    );
    footer = actions(
      null,
      <Button variant="primary" className="flex-1" onClick={() => go(2)}>
        {t('flow.next')}
      </Button>,
    );
  } else if (step === 2) {
    const id = `${ids}-party`;
    body = (
      <div className="space-y-4">
        {heading(t('flow.step2'))}
        <Field id={id} label={t('flow.groupLabel')} help={t('flow.groupHelp')}>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              aria-label={t('flow.groupLess')}
              disabled={draft.partySize <= min}
              onClick={() => setParty(Math.max(min, draft.partySize - 1))}
              className="w-11 px-0"
            >
              <Minus aria-hidden="true" />
            </Button>
            <Input
              id={id}
              inputMode="numeric"
              type="number"
              min={min}
              max={max}
              value={partyText}
              aria-describedby={describedBy(id, true, false)}
              aria-invalid={!partyValid}
              onChange={event => {
                // Kept as typed; the draft takes it once it is a whole number within the limits.
                const text = event.target.value;
                setPartyText(text);
                const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
                if (n !== null && n >= min && n <= max) setDraft({partySize: n});
              }}
              onBlur={() => setParty(Math.max(min, Math.min(max, partyTyped ?? draft.partySize)))}
              className={cn('w-24 text-center font-semibold', numbers)}
            />
            <Button
              variant="secondary"
              aria-label={t('flow.groupMore')}
              disabled={draft.partySize >= max}
              onClick={() => setParty(Math.min(max, draft.partySize + 1))}
              className="w-11 px-0"
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </Field>
        <p className={cn(helper, numbers)} aria-live="polite">
          {people(draft.partySize)}
          {session.partyMax !== null ? ` · ${t('flow.groupMax', {max: session.partyMax})}` : ''}
          {reserve && session.remaining !== null
            ? ` ${session.remaining === 1 ? t('flow.groupSeatsOne') : t('flow.groupSeats', {count: session.remaining})}`
            : ''}
        </p>
      </div>
    );
    footer = actions(
      1,
      <Button variant="primary" className="flex-1" onClick={() => go(3)} disabled={!partyValid}>
        {t('flow.next')}
      </Button>,
    );
  } else if (step === 3) {
    const nameId = `${ids}-name`;
    const valueId = `${ids}-contact`;
    const noteId = `${ids}-note`;
    body = (
      <form
        id={contactForm}
        className="space-y-4"
        noValidate
        onSubmit={event => {
          event.preventDefault();
          if (validateContact()) go(4);
        }}
      >
        {heading(t('flow.step3'))}
        <Field id={nameId} label={t('flow.nameLabel')} error={errors.leadName}>
          <Input
            id={nameId}
            autoComplete="name"
            value={draft.leadName}
            maxLength={80}
            aria-invalid={Boolean(errors.leadName)}
            aria-describedby={describedBy(nameId, false, Boolean(errors.leadName))}
            onChange={event => setDraft({leadName: event.target.value})}
          />
        </Field>
        {lockedKind ? (
          <p className={helper}>
            {t('flow.contactRequired', {kind: lockedKind === 'phone' ? t('flow.phone') : t('flow.email')})}
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-5 text-ink">{t('flow.contactKind')}</legend>
            <Choices
              name={`${ids}-kind`}
              label={t('flow.contactKind')}
              value={draft.contactKind}
              onChange={value => setDraft({contactKind: value, contactValue: ''})}
              options={[
                {value: 'phone', label: t('flow.phone')},
                {value: 'email', label: t('flow.email')},
              ]}
            />
          </fieldset>
        )}
        <Field
          id={valueId}
          label={draft.contactKind === 'phone' ? t('flow.phone') : t('flow.email')}
          error={errors.contactValue}
        >
          <Input
            id={valueId}
            type={draft.contactKind === 'phone' ? 'tel' : 'email'}
            autoComplete={draft.contactKind === 'phone' ? 'tel' : 'email'}
            inputMode={draft.contactKind === 'phone' ? 'tel' : 'email'}
            value={draft.contactValue}
            maxLength={120}
            aria-invalid={Boolean(errors.contactValue)}
            aria-describedby={describedBy(valueId, false, Boolean(errors.contactValue))}
            onChange={event => setDraft({contactValue: event.target.value})}
          />
        </Field>
        {textsOffered ? (
          <div className="space-y-1">
            <Checkbox
              id={`${ids}-text`}
              checked={Boolean(draft.textConsent)}
              onChange={textConsent => setDraft({textConsent})}
              describedBy={`${ids}-text-help`}
            >
              {t('flow.textConsent')}
            </Checkbox>
            <p id={`${ids}-text-help`} className={cn(helper, 'pl-8')}>
              {t('flow.textConsentHelp')}
            </p>
          </div>
        ) : null}
        <Disclosure variant="link" summary={t('flow.addNote')} defaultOpen={Boolean(draft.note || errors.note)}>
          <Field
            id={noteId}
            label={t('flow.noteLabel')}
            help={
              <>
                {t('flow.noteHelp')} {t('flow.noteLimit')}
              </>
            }
            error={errors.note}
          >
            <Textarea
              id={noteId}
              value={draft.note}
              maxLength={280}
              rows={3}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={describedBy(noteId, true, Boolean(errors.note))}
              onChange={event => setDraft({note: event.target.value})}
            />
          </Field>
        </Disclosure>
      </form>
    );
    footer = actions(
      2,
      <Button variant="primary" type="submit" form={contactForm} className="flex-1">
        {t('flow.next')}
      </Button>,
    );
  } else if (step === 4) {
    const rows: {label: string; value: ReactNode; edit?: Step}[] = [
      {label: t('flow.step1'), value: pick(session.title, lang)},
      {label: t('detail.when'), value: <WhenText session={session} />},
      {label: t('detail.where'), value: session.venue ? session.venue.name : t('venue.tbd')},
      {label: t('flow.step2'), value: people(draft.partySize), edit: 2},
      {
        label: t('detail.price'),
        value: (
          <span className={numbers}>
            <Price price={session.price} />
            {total ? ` · ${t('flow.total', {amount: total})}` : ''}
          </span>
        ),
      },
      {
        label: t('flow.step3'),
        value: (
          <>
            <span className="block">{draft.leadName}</span>
            <span className={cn('block', draft.contactKind === 'phone' ? 'whitespace-nowrap' : 'break-all')}>
              {draft.contactValue}
            </span>
            {textsOffered && draft.textConsent ? (
              <span className={cn('block', helper)}>{t('flow.textChosen')}</span>
            ) : null}
          </>
        ),
        edit: 3,
      },
      ...(draft.note.trim() ? [{label: t('flow.noteLabel'), value: draft.note.trim(), edit: 3 as Step}] : []),
    ];
    body = (
      <form id={reviewForm} className="space-y-4" noValidate onSubmit={submit}>
        {heading(reserve ? t('flow.reviewReserve') : t('flow.reviewRequest'))}
        <dl className="divide-y divide-border/70 border-y border-border/70">
          {rows.map(row => (
            <div key={row.label} className="flex flex-col gap-0.5 py-2.5">
              <dt className="flex min-h-6 items-center justify-between gap-2">
                <span className={helper}>{row.label}</span>
                {row.edit ? (
                  <button
                    type="button"
                    onClick={() => go(row.edit!)}
                    aria-label={t('flow.editWhat', {what: row.label})}
                    className="-my-2.5 inline-flex min-h-11 shrink-0 items-center rounded-2xl px-2 text-sm font-medium leading-5 text-accent underline underline-offset-4 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {t('flow.edit')}
                  </button>
                ) : null}
              </dt>
              <dd className="text-base leading-6 text-ink [overflow-wrap:break-word]">{row.value}</dd>
            </div>
          ))}
        </dl>
        <section className="space-y-2">
          <h4 className={sectionTitle}>{t('detail.terms')}</h4>
          <PolicyBlock policy={session.policy} />
        </section>
        {reserve ? (
          <div className="space-y-2">
            <Checkbox
              id={acceptId}
              checked={accepted}
              onChange={next => {
                setDraft({accepted: next, acceptedKey: next ? currentTerms : null});
                setErrors({});
              }}
              invalid={Boolean(errors.accepted)}
              describedBy={errors.accepted ? `${acceptId}-error` : undefined}
            >
              {t('flow.accept')}
            </Checkbox>
            {errors.accepted ? (
              <p id={`${acceptId}-error`} role="alert" className="text-sm font-medium leading-5 text-ink">
                {errors.accepted}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm leading-5 text-ink">
          {!reserve ? t('flow.nextRequest') : session.terms?.prepayment ? t('flow.nextPrepay') : t('flow.nextReserve')}
        </p>
        {problem ? (
          <div
            ref={problemRef}
            role="alert"
            className="space-y-2 rounded-2xl border-2 border-ink p-3 text-sm font-medium leading-5 text-ink"
          >
            <p>{problem.message}</p>
            {problem.kind === 'otherDates' ? (
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {t('error.otherDates')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    );
    footer = actions(
      3,
      <Button
        variant="primary"
        type="submit"
        form={reviewForm}
        className="flex-1"
        disabled={sending}
        aria-busy={sending}
      >
        {sending
          ? t('flow.sending')
          : problem?.kind === 'lost'
            ? t('app.retry')
            : reserve
              ? t('flow.submitReserve')
              : t('flow.submitRequest')}
      </Button>,
    );
  } else {
    body = (
      <ReceiptView
        session={session}
        receipt={receipt!}
        manageUrl={manageUrl}
        headingRef={headingRef}
        celebrate={celebrate}
        startOver={
          // Quiet and last: starting over clears this receipt, the only copy of the private link here.
          // Not offered once the session can't be booked any more.
          session.action === 'none' ? null : (
            <Button variant="ghost" onClick={startOver} className="-ml-3">
              {session.action === 'reserve' ? t('flow.startOverReserve') : t('flow.startOverRequest')}
            </Button>
          )
        }
      />
    );
    footer = manageUrl ? (
      <a href={manageUrl} className={buttonVariants({variant: 'primary', width: 'full'})}>
        {t('result.openLink')}
      </a>
    ) : null;
  }

  return (
    <Dialog
      kind="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title={reserve ? t('flow.title') : t('flow.titleRequest')}
      description={
        <>
          <span className="block">{`${t('flow.stepOf', {n: step})}: ${stepNames[step - 1]}`}</span>
          {/* The header doesn't scroll, so every step, the receipt included, names its session. */}
          <span className={cn('mt-1 flex items-start gap-2', numbers)}>
            <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-ink">{pick(session.title, lang)}</span>
              {' · '}
              {session.startsAt === null ? (
                t('status.date_tbd')
              ) : (
                <>
                  {formatShortDate(session.startsAt, lang)},{' '}
                  <span className="whitespace-nowrap">{formatTime(session.startsAt, lang)}</span>
                </>
              )}
            </span>
          </span>
        </>
      }
      closeLabel={t('app.close')}
      footer={footer}
    >
      <ol className="mb-5 grid grid-cols-5 gap-1" aria-hidden="true">
        {stepNames.map((name, index) => (
          <li key={name} className={cn('h-1.5 rounded-full', index < step ? 'bg-accent' : 'bg-stone-200')} />
        ))}
      </ol>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? {opacity: 1} : {opacity: 0, x: 12}}
          animate={{opacity: 1, x: 0}}
          exit={reduce ? {opacity: 1} : {opacity: 0, x: -12}}
          transition={reduce ? {duration: 0} : SPRING}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </Dialog>
  );
}

function ReceiptView({
  session,
  receipt,
  manageUrl,
  headingRef,
  celebrate,
  startOver,
}: {
  session: PublicSession;
  receipt: Receipt;
  manageUrl: string | null;
  headingRef: Ref<HTMLHeadingElement>;
  celebrate: boolean;
  startOver: ReactNode;
}) {
  const {t, lang} = useT();
  const [copied, setCopied] = useState<string | null>(null);
  const [dmState, setDmState] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const count = receipt.partySize === 1 ? t('flow.person') : t('flow.people', {count: receipt.partySize});
  // The time goes in parentheses, so "p. m." never runs into the sentence's period.
  const dm =
    session.startsAt === null
      ? t('result.dmMessageTbd', {reference: receipt.reference, count})
      : t('result.dmMessage', {
          reference: receipt.reference,
          date: formatLongDate(session.startsAt, lang),
          time: formatTime(session.startsAt, lang),
          count,
        });

  if (receipt.replaced) {
    return (
      <div className="space-y-4">
        <h3 ref={headingRef} tabIndex={-1} className={cn(sectionTitle, 'focus:outline-none')}>
          {t('flow.step5')}
        </h3>
        <p role="status" className="text-base leading-6 text-ink">
          {t('result.replaced', {reference: receipt.reference})}
        </p>
      </div>
    );
  }

  // A retried request reports the booking as it is now: it may have ended since.
  const ended = !['confirmed', 'pending_payment', 'inquiry'].includes(receipt.status);
  const headline =
    receipt.status === 'confirmed'
      ? t('result.confirmed')
      : receipt.status === 'pending_payment'
        ? t('result.pending')
        : ended
          ? t('result.ended')
          : t('result.inquiry');
  // What we say about messages is only what happened: a text the provider took, refused or never
  // answered, a number that can't take one, or no message at all.
  const text =
    receipt.text && receipt.text.status !== 'skipped' && receipt.text.status !== 'queued' ? receipt.text : null;
  const messageLine = text
    ? text.status === 'sent'
      ? t('result.textSent', {to: text.to})
      : text.status === 'failed'
        ? t('result.textFailed', {to: text.to})
        : t('result.textUnknown', {to: text.to})
    : receipt.textNumberRefused
      ? t('result.textRefused')
      : t('result.noMessage');

  const copyDm = async () => {
    const ok = await copyText(dm);
    if (ok) {
      setDmState(t('result.copied'));
      window.open(INSTAGRAM_DM, '_blank', 'noopener,noreferrer');
      setTimeout(() => setDmState(`${t('result.copied')} ${t('result.continueInstagram')}`), 400);
    } else {
      setDmState(t('result.copyFailed'));
      messageRef.current?.select();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3" role="status" aria-live="polite">
        {receipt.status === 'confirmed' ? (
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
        ) : (
          <Hourglass className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
        )}
        <div className="space-y-1">
          <h3 ref={headingRef} tabIndex={-1} className={cn(detailTitle, 'focus:outline-none')}>
            {headline}
          </h3>
          {receipt.status === 'confirmed' ? (
            <p className="text-base leading-6 text-ink">{t('result.confirmedHelp')}</p>
          ) : ended ? (
            <p className="text-base leading-6 text-ink">{t('result.endedHelp')}</p>
          ) : null}
        </div>
      </div>
      {receipt.status === 'confirmed' ? (
        // Only a reservation the server confirmed becomes a ticket: it holds the places.
        <div className="relative" data-ticket="">
          <Ticket tone="wash" stub={<TicketDate ms={session.startsAt} />}>
            <dl className="space-y-2">
              <div>
                {/* The number the door asks for: large enough to read across a counter. */}
                <dt className={cn(kicker, 'text-accent')}>{t('result.doorNumber')}</dt>
                <dd className={cn(doorNumber, 'text-ink')}>{receipt.reference}</dd>
                <dd className="mt-1 text-sm font-medium leading-5 text-ink">{t('result.doorHelp')}</dd>
              </div>
              <div>
                <dt className={cn(kicker, 'text-muted')}>{t('detail.when')}</dt>
                <dd className="text-sm leading-5 text-ink">
                  <WhenText session={session} />
                </dd>
              </div>
              <div>
                <dt className={cn(kicker, 'text-muted')}>{t('flow.step2')}</dt>
                <dd className={cn('text-sm leading-5 text-ink', numbers)}>{count}</dd>
              </div>
            </dl>
          </Ticket>
          <Popcorn active={celebrate} />
        </div>
      ) : (
        <dl className={cn(inset, 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2')}>
          <dt className={helper}>{t('result.reference')}</dt>
          <dd className={cn('text-base font-semibold leading-6 text-ink', numbers)}>{receipt.reference}</dd>
          <dt className={helper}>{t('detail.when')}</dt>
          <dd className="text-base leading-6 text-ink">
            <WhenText session={session} />
          </dd>
          <dt className={helper}>{t('flow.step2')}</dt>
          <dd className={cn('text-base leading-6 text-ink', numbers)}>{count}</dd>
        </dl>
      )}
      {manageUrl ? (
        <div className="space-y-2">
          <p className={sectionTitle}>{t('result.link')}</p>
          <p className="break-all rounded-2xl border border-stone-300 p-3 text-sm leading-5 text-ink">{manageUrl}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              onClick={async () =>
                setCopied((await copyText(manageUrl)) ? t('result.linkCopied') : t('result.copyFailed'))
              }
            >
              <Copy aria-hidden="true" />
              {t('result.copyLink')}
            </Button>
            <p role="status" aria-live="polite" className={helper}>
              {copied}
            </p>
          </div>
        </div>
      ) : null}
      <p className="text-sm font-medium leading-5 text-ink" data-message-line="">
        {messageLine}
      </p>
      <CalendarExport
        session={session}
        status={receipt.status}
        reference={receipt.reference}
        partySize={receipt.partySize}
        manageUrl={manageUrl}
      />
      <div className="border-t border-border/70 pt-4">
        <Disclosure summary={t('result.instagram')}>
          <div className="space-y-2">
            <p className={helper}>{t('result.instagramHelp')}</p>
            <Textarea ref={messageRef} readOnly value={dm} rows={3} aria-label={t('result.instagram')} />
            <Button onClick={copyDm}>
              <MessageCircle aria-hidden="true" />
              {t('result.copyAndOpen')}
            </Button>
            <p role="status" aria-live="polite" className={helper}>
              {dmState}
            </p>
          </div>
        </Disclosure>
      </div>
      {startOver}
    </div>
  );
}
