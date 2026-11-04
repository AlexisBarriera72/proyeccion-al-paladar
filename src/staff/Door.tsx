// The door, on "Esta noche": finding a guest by number, name or phone (Recepción), and guests who
// arrive without a reservation (walk-ins). A walk-in gets a booking number on the spot only when
// the server agrees: seats left, the session's limits, its terms accepted in person. The screen
// says only what the server answered.
import {useId, useState, type FormEvent} from 'react';
import {formatTime} from '../../shared/time.ts';
import {formatMoney, pick} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {doorNumber, kicker, numbers, sectionTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {Switch} from '../components/ui/tabs.tsx';
import {intOrNull, useWrite} from './api.ts';
import {
  Callout,
  CheckField,
  FormFooter,
  NoticeLine,
  SelectField,
  TextField,
  useOnOpen,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import type {StaffBookingRow, TonightSession} from './types.ts';

const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------ Recepción

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const alnum = (text: string) => plain(text).replace(/[^a-z0-9]/g, '');
const digits = (text: string) => text.replace(/\D/g, '');

/**
 * Today's bookings that match what the door typed: the booking number (with or without "PAP-",
 * any case or spacing), part of the name (accents ignored), or four or more digits of the phone.
 */
export function findArrivals(bookings: StaffBookingRow[], query: string): StaffBookingRow[] {
  const q = query.trim();
  if (!q) return [];
  const code = alnum(q);
  const name = plain(q);
  const phone = digits(q);
  return bookings.filter(b => {
    const reference = alnum(b.reference);
    if (code.length >= 3 && (reference.includes(code) || reference.replace(/^pap/, '').startsWith(code))) return true;
    if (name.length >= 2 && plain(b.lead_name).includes(name)) return true;
    return phone.length >= 4 && b.contact_kind === 'phone' && digits(b.contact_value).includes(phone);
  });
}

// ------------------------------------------------------------------ walk-ins

interface WalkInAnswer {
  outcome: {id: string; reference: string; status: string; checkedInAt: number | null};
}

const seatsFree = (s: TonightSession) => (s.capacity === null ? 0 : s.capacity - s.blocked_seats - s.seats_taken);

const blankWalkIn = (ready: TonightSession[]) => ({
  sessionId: ready.length === 1 ? ready[0].id : '',
  partySize: '2',
  leadName: '',
  contactKind: 'phone' as 'phone' | 'email',
  contactValue: '',
  note: '',
  accepted: false,
});

/** "Llegó sin reservación": a sheet that registers the guest and shows their number. */
export function WalkInSheet({
  open,
  onOpenChange,
  sessions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: TonightSession[];
  /** Reloads tonight's lists after a write (or after the terms turned out to have changed). */
  onSaved: () => void;
}) {
  const {t, lang} = useStaffT();
  const ids = useId();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  // Only sessions that can confirm anyone take walk-ins; the server checks again.
  const ready = sessions.filter(s => s.missing.length === 0);
  const [form, setForm] = useState(() => blankWalkIn(ready));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [answer, setAnswer] = useState<WalkInAnswer | null>(null);
  const reset = () => {
    setForm(blankWalkIn(ready));
    setErrors({});
    setNotice(null);
    setAnswer(null);
  };
  useOnOpen(open, reset);
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const session = ready.find(s => s.id === form.sessionId) ?? null;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problems: Record<string, string> = {};
    const size = intOrNull(form.partySize);
    if (!session) problems.sessionId = t('walk.pick');
    if (!size || Number.isNaN(size) || size > 60) problems.partySize = t('ses.invalidNumber');
    if (form.leadName.trim().length < 2) problems.leadName = t('error.name');
    const value = form.contactValue.trim();
    if (form.contactKind === 'phone' ? !PHONE.test(value) : !EMAIL.test(value)) {
      problems.contactValue = form.contactKind === 'phone' ? t('error.phone') : t('error.email');
    }
    if (!form.accepted) problems.accepted = t('walk.acceptRequired');
    setErrors(problems);
    if (Object.keys(problems).length || !session || !session.policy_version_id) return;
    const result = await run<WalkInAnswer & {ok: true}>('/api/equipo/walk-ins', {
      sessionId: session.id,
      partySize: size,
      leadName: form.leadName.trim(),
      contactKind: form.contactKind,
      contactValue: value,
      note: form.note.trim() || null,
      // The terms shown here: the server refuses if they changed in the meantime.
      terms: {
        policyVersionId: session.policy_version_id,
        priceStatus: session.price_status,
        unitPriceCents: session.price_cents,
        currency: session.currency,
      },
      acceptedTerms: form.accepted,
    });
    if (result.kind === 'ok') {
      setNotice(null);
      setAnswer(result.data);
      onSaved();
      return;
    }
    setNotice(outcome(result, ''));
    if (result.kind === 'error' && (result.code === 'terms_changed' || result.code === 'no_seats')) onSaved();
  };

  const price =
    session?.price_status === 'approved' && session.price_cents !== null && session.currency
      ? t('walk.price', {amount: formatMoney(session.price_cents, session.currency, lang)})
      : session?.price_status === 'not_charged'
        ? t('ses.price.not_charged')
        : null;

  const result = answer ? (
    <div className="flex flex-col gap-3" data-walk-in-result="">
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        <p className={cn(kicker, 'text-accent')}>{t('walk.number')}</p>
        <p className={cn(doorNumber, 'text-ink')}>{answer.outcome.reference}</p>
        <p className="text-base leading-6 text-ink">
          {answer.outcome.status === 'confirmed' && answer.outcome.checkedInAt !== null
            ? t('walk.confirmed', {time: formatTime(answer.outcome.checkedInAt, lang)})
            : t('walk.pending')}
        </p>
      </div>
      <Link
        to={`/equipo/reservaciones/${answer.outcome.id}/`}
        className={cn(buttonVariants({variant: 'link'}), 'inline-flex min-h-11 items-center self-start')}
      >
        {t('walk.openBooking')}
      </Link>
    </div>
  ) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="sheet"
      size="wide"
      title={t('walk.title')}
      description={t('walk.help')}
      closeLabel={t('staff.close')}
      footer={
        answer ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              {t('walk.another')}
            </Button>
            <Button variant="primary" onClick={() => onOpenChange(false)}>
              {t('walk.done')}
            </Button>
          </div>
        ) : ready.length ? (
          <div>
            <NoticeLine notice={notice} className="mb-3" />
            <FormFooter formId={formId} label={t('walk.save')} busy={busy} onCancel={() => onOpenChange(false)} />
          </div>
        ) : null
      }
    >
      {result ??
        (ready.length ? (
          <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <SelectField
                id={`${ids}-session`}
                label={t('walk.session')}
                value={form.sessionId}
                onChange={value => set({sessionId: value, accepted: false})}
                options={[
                  ...(ready.length > 1 ? [{value: '', label: t('walk.pick')}] : []),
                  ...ready.map(s => ({value: s.id, label: `${formatTime(s.starts_at, lang)} · ${s.title_es}`})),
                ]}
                // Under the field, so a phone's narrow select never cuts it off.
                help={
                  session
                    ? seatsFree(session) === 1
                      ? t('walk.seatsLeftOne')
                      : t('walk.seatsLeft', {count: seatsFree(session)})
                    : undefined
                }
              />
              {errors.sessionId ? (
                <p role="alert" className="text-sm font-medium leading-5 text-ink">
                  {errors.sessionId}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
              <TextField
                id={`${ids}-party`}
                label={t('bk.party')}
                inputMode="numeric"
                value={form.partySize}
                onChange={value => set({partySize: value})}
                error={errors.partySize}
              />
              <TextField
                id={`${ids}-name`}
                label={t('bk.lead')}
                value={form.leadName}
                onChange={value => set({leadName: value})}
                error={errors.leadName}
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium leading-5 text-ink">{t('bk.contactKind')}</span>
              <div>
                <Switch
                  value={form.contactKind}
                  onChange={value => set({contactKind: value})}
                  label={t('bk.contactKind')}
                  options={[
                    {value: 'phone', label: t('bk.phone')},
                    {value: 'email', label: t('bk.email')},
                  ]}
                />
              </div>
            </div>
            <TextField
              id={`${ids}-contact`}
              label={t('bk.contact')}
              type={form.contactKind === 'email' ? 'email' : 'tel'}
              inputMode={form.contactKind === 'email' ? 'email' : 'tel'}
              value={form.contactValue}
              onChange={value => set({contactValue: value})}
              error={errors.contactValue}
              maxLength={120}
            />
            <TextField
              id={`${ids}-note`}
              label={t('bk.note')}
              value={form.note}
              onChange={value => set({note: value})}
              multiline
              maxLength={280}
              counter
            />
            {session ? (
              <section aria-labelledby={`${ids}-terms`} className="flex flex-col gap-2 border-t border-border/70 pt-4">
                <h3 id={`${ids}-terms`} className={sectionTitle}>
                  {t('walk.terms')}
                </h3>
                {price ? <p className={cn('text-base leading-6 text-ink', numbers)}>{price}</p> : null}
                {session.policy ? (
                  <Disclosure variant="link" summary={t('walk.readTerms')}>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold leading-5 text-ink">{session.policy.title}</p>
                      <p className="whitespace-pre-line text-sm leading-5 text-ink">
                        {pick(session.policy.text, lang)}
                      </p>
                    </div>
                  </Disclosure>
                ) : null}
                {session.fullPayment === 1 ? <Callout>{t('walk.prepay')}</Callout> : null}
                <CheckField
                  id={`${ids}-accept`}
                  label={t('walk.accept')}
                  checked={form.accepted}
                  onChange={accepted => set({accepted})}
                />
                {errors.accepted ? (
                  <p role="alert" className="text-sm font-medium leading-5 text-ink">
                    {errors.accepted}
                  </p>
                ) : null}
              </section>
            ) : null}
          </form>
        ) : (
          <p className="text-base leading-6 text-ink">{t('walk.none')}</p>
        ))}
    </Dialog>
  );
}
