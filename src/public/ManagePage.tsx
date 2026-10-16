// "/reservacion/:token/": the guest's own page. The token in the path is the only key; the
// server answers with the booking it belongs to, or says the link is no longer valid. Every
// action sends a mutation ID kept in this tab, so a lost response can be retried safely.
import {useCallback, useEffect, useId, useState, type FormEvent} from 'react';
import {motion} from 'motion/react';
import {CalendarDays, CircleX, ExternalLink, MapPin, MessageSquareText, RotateCw, Users} from 'lucide-react';
import type {ManageProposal, ManageView, PublicSession, PublicTerms} from '../../shared/types.ts';
import {formatLongDate} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {postJson} from '../lib/api.ts';
import {newMutationId} from '../lib/ids.ts';
import {readJson, remove, writeJson} from '../lib/storage.ts';
import {formatMoney, pick} from '../lib/format.ts';
import {useEntry} from '../lib/motion.ts';
import {Link} from '../lib/router.tsx';
import {helper, numbers, pageTitle, panel, sectionTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {Field, Textarea, describedBy} from '../components/ui/field.tsx';
import {Choices} from '../components/ui/choice.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {BookingStatus} from '../components/Status.tsx';
import {Price} from '../components/Price.tsx';
import {PolicyBlock, WhenText} from './SessionDetail.tsx';
import {CalendarExport} from './CalendarExport.tsx';

const INSTAGRAM = 'https://www.instagram.com/proyeccionalpaladarpr/';

// The token's shape (shared/schemas.ts TOKEN), repeated here to keep zod out of the guest bundle.
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

type Load = {state: 'loading'} | {state: 'invalid'} | {state: 'error'} | {state: 'ready'; booking: ManageView};
type Notice = {text: string; tone: 'ok' | 'problem'} | null;

/** One mutation ID per intent (the same request body), kept until the server settles it. */
function pendingId(key: string, body: unknown): string {
  const fingerprint = JSON.stringify(body);
  const stored = readJson<{id: string; fingerprint: string}>('session', key);
  if (stored?.fingerprint === fingerprint) return stored.id;
  const id = newMutationId();
  writeJson('session', key, {id, fingerprint});
  return id;
}

function termsPrice(
  terms: Pick<PublicTerms, 'priceStatus' | 'unitPriceCents' | 'currency'>,
  t: (k: string, v?: Record<string, string | number>) => string,
  lang: 'es' | 'en',
) {
  if (terms.priceStatus === 'not_charged') return t('price.free');
  if (terms.unitPriceCents !== null && terms.currency) {
    return t('price.perPerson', {amount: formatMoney(terms.unitPriceCents, terms.currency, lang)});
  }
  return t('price.tbd');
}

function NoticeText({notice}: {notice: NonNullable<Notice>}) {
  return (
    <p
      className={cn(
        'rounded-2xl border p-3 text-base leading-6 text-ink',
        notice.tone === 'ok' ? 'border-stone-400 bg-stone-50' : 'border-2 border-ink',
      )}
    >
      {notice.text}
    </p>
  );
}

const fact = 'space-y-0.5 py-3';
const factLabel = 'flex items-center gap-2 text-sm leading-5 text-muted [&_svg]:size-4 [&_svg]:shrink-0';

function SessionSummary({session, partySize}: {session: PublicSession; partySize: number}) {
  const {t, lang} = useT();
  return (
    <div className="space-y-1 border-t border-border/70 pt-4">
      <p className="text-base font-medium leading-6 text-ink">{pick(session.title, lang)}</p>
      <dl className="divide-y divide-border/70 text-base leading-6">
        <div className={fact}>
          <dt className={factLabel}>
            <CalendarDays aria-hidden="true" />
            {t('detail.when')}
          </dt>
          <dd className="pl-6 text-ink">
            <WhenText session={session} />
          </dd>
        </div>
        <div className={fact}>
          <dt className={factLabel}>
            <MapPin aria-hidden="true" />
            {t('detail.where')}
          </dt>
          <dd className="pl-6 text-ink">
            {session.venue ? (
              <>
                {session.venue.name}
                {session.venue.address ? (
                  <span className="block text-sm leading-5 text-muted">{session.venue.address}</span>
                ) : null}
              </>
            ) : (
              t('venue.tbd')
            )}
          </dd>
        </div>
        <div className={cn(fact, 'pb-0')}>
          <dt className={factLabel}>
            <Users aria-hidden="true" />
            {t('manage.group')}
          </dt>
          <dd className={cn('pl-6 text-ink', numbers)}>
            {partySize === 1 ? t('flow.person') : t('flow.people', {count: partySize})}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Proposal({proposal, onAccept, busy}: {proposal: ManageProposal; onAccept: () => void; busy: boolean}) {
  const {t, lang} = useT();
  return (
    <section
      aria-labelledby={`proposal-${proposal.id}`}
      className="space-y-4 rounded-2xl border-2 border-accent bg-surface p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id={`proposal-${proposal.id}`} className={sectionTitle}>
          {t('manage.proposal')}
        </h2>
        <p className={helper}>{t('manage.proposalHelp')}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-base leading-6">
        <div>
          <dt className={helper}>{t('flow.step1')}</dt>
          <dd className="font-medium text-ink">{pick(proposal.session.title, lang)}</dd>
        </div>
        <div>
          <dt className={helper}>{t('detail.when')}</dt>
          <dd className="text-ink">
            <WhenText session={proposal.session} />
          </dd>
        </div>
        <div>
          <dt className={helper}>{t('detail.price')}</dt>
          <dd className={cn('text-ink', numbers)}>{termsPrice(proposal.terms, t, lang)}</dd>
        </div>
      </dl>
      <PolicyBlock policy={proposal.session.policy} />
      <Button variant="primary" onClick={onAccept} disabled={busy}>
        {busy ? t('flow.sending') : t('manage.acceptProposal')}
      </Button>
    </section>
  );
}

export function ManagePage({token}: {token: string}) {
  const {t, lang} = useT();
  const entry = useEntry();
  const ids = useId();
  const [load, setLoad] = useState<Load>({state: 'loading'});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const config = useConfig();
  const [askKind, setAskKind] = useState<'cancel' | 'change'>('change');
  const [askDetails, setAskDetails] = useState('');
  const [askError, setAskError] = useState<string | null>(null);
  const valid = TOKEN.test(token);

  const fetchView = useCallback(async () => {
    if (!valid) {
      setLoad({state: 'invalid'});
      return;
    }
    const result = await postJson<{booking: ManageView}>('/api/public/manage', {token});
    if (result.kind === 'ok') setLoad({state: 'ready', booking: result.data.booking});
    else if (result.kind === 'error' && result.code === 'link_invalid') setLoad({state: 'invalid'});
    else setLoad(current => (current.state === 'ready' ? current : {state: 'error'}));
  }, [token, valid]);

  useEffect(() => {
    void fetchView();
  }, [fetchView]);

  const booking = load.state === 'ready' ? load.booking : null;
  const isRequest = booking ? ['inquiry', 'pending_payment', 'exception'].includes(booking.status) : false;

  useEffect(() => {
    document.title = `${isRequest ? t('manage.titleRequest') : t('manage.titleReservation')} · ${t('app.name')}`;
  }, [isRequest, t]);

  /** Runs one guest action; keeps its mutation ID for a retry until the server answers. */
  const act = async (key: string, path: string, body: Record<string, unknown>, done: string) => {
    if (!navigator.onLine) {
      setNotice({text: t('error.offline'), tone: 'problem'});
      return false;
    }
    setBusy(key);
    setNotice(null);
    const storageKey = `pap-act:${token.slice(0, 12)}:${key}`;
    const result = await postJson(path, {token, ...body}, pendingId(storageKey, body));
    setBusy(null);
    if (result.kind === 'lost') {
      setNotice({text: t('error.lost'), tone: 'problem'});
      return false;
    }
    remove('session', storageKey);
    if (result.kind === 'ok') {
      setNotice({text: done, tone: 'ok'});
      await fetchView();
      return true;
    }
    if (result.code === 'link_invalid') setLoad({state: 'invalid'});
    else if (
      result.code === 'version_conflict' ||
      result.code === 'status_not_allowed' ||
      result.code === 'has_payment'
    ) {
      setNotice({text: t('manage.changed'), tone: 'problem'});
      await fetchView();
    } else if (result.code === 'too_many_requests') setNotice({text: t('manage.tooMany'), tone: 'problem'});
    else if (result.code === 'rate_limited') setNotice({text: t('error.rate'), tone: 'problem'});
    else if (result.code === 'proposal_not_open') {
      setNotice({text: t('manage.changed'), tone: 'problem'});
      await fetchView();
    } else setNotice({text: t('error.generic'), tone: 'problem'});
    return false;
  };

  const withdraw = async () => {
    if (!booking) return;
    setConfirmWithdraw(false);
    await act(
      `withdraw-${booking.version}`,
      '/api/public/manage/withdraw',
      {expectedVersion: booking.version},
      t('manage.withdrawn'),
    );
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (askDetails.length > 400) {
      setAskError(t('error.note'));
      return;
    }
    setAskError(null);
    const ok = await act(
      'ask',
      '/api/public/manage/request',
      {kind: askKind, details: askDetails.trim() || null},
      t('manage.askSent'),
    );
    if (ok) {
      setAskDetails('');
      setAskOpen(false);
    }
  };

  if (load.state === 'loading') {
    return (
      <div aria-busy="true" className="max-w-3xl space-y-4">
        <p className="sr-only">{t('app.loading')}</p>
        <div className="h-10 w-2/3 rounded-xl bg-stone-200" />
        <div className="h-64 rounded-2xl bg-stone-100" />
      </div>
    );
  }

  if (load.state === 'invalid' || load.state === 'error') {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
          {t('manage.titleReservation')}
        </h1>
        <div role="alert" className={cn(panel, 'space-y-4')}>
          <p className="text-base leading-6 text-ink">
            {load.state === 'invalid' ? t('manage.invalid') : t('manage.loadError')}
          </p>
          {load.state === 'error' ? (
            <Button variant="secondary" onClick={() => void fetchView()}>
              <RotateCw aria-hidden="true" />
              {t('app.retry')}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <a
                href={config?.instagramUrl ?? INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({variant: 'secondary'})}
              >
                <ExternalLink aria-hidden="true" />
                {t('cal.openInstagram')}
              </a>
              <Link to="/" className={buttonVariants({variant: 'ghost'})}>
                {t('notFound.back')}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const b = load.booking;
  const locked = b.locked;
  const currency = locked.currency ?? b.session.price.currency ?? 'USD';
  const active = ['inquiry', 'pending_payment', 'confirmed', 'exception'].includes(b.status);
  const canAsk = active && !b.canWithdraw;
  const kindId = `${ids}-kind`;
  const detailsId = `${ids}-details`;
  const askForm = `${ids}-ask-form`;
  const hasExport = b.session.startsAt !== null && b.status !== 'cancelled';

  return (
    <motion.div variants={entry.page} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={entry.item} className="space-y-2">
        <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
          {isRequest ? t('manage.titleRequest') : t('manage.titleReservation')}
        </h1>
        <p className={cn('text-base leading-6 text-ink', numbers)}>
          {t('manage.reference')}: <span className="font-semibold">{b.reference}</span>
        </p>
      </motion.div>

      {/* A proposal waits for the guest, so it comes first. */}
      {b.proposals.map(proposal => (
        <motion.div key={proposal.id} variants={entry.item}>
          <Proposal
            proposal={proposal}
            busy={busy === `accept-${proposal.id}`}
            onAccept={() =>
              void act(
                `accept-${proposal.id}`,
                '/api/public/manage/accept',
                {proposalId: proposal.id},
                t('manage.accepted'),
              )
            }
          />
        </motion.div>
      ))}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <motion.section
          variants={entry.item}
          aria-labelledby={`${ids}-status`}
          className={cn(panel, 'space-y-5 lg:col-start-1')}
        >
          <div className="space-y-1">
            <h2 id={`${ids}-status`} className={helper}>
              {t('manage.status')}
            </h2>
            <BookingStatus status={b.status} />
            <p className="text-base leading-6 text-ink">{t(`bhelp.${b.status}`)}</p>
          </div>
          <div role="status" aria-live="polite">
            {notice ? <NoticeText notice={notice} /> : null}
          </div>
          <SessionSummary session={b.session} partySize={b.partySize} />
        </motion.section>

        {hasExport || b.canWithdraw || canAsk ? (
          <motion.section
            variants={entry.item}
            aria-labelledby={`${ids}-actions`}
            className={cn(panel, 'space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1')}
          >
            <h2 id={`${ids}-actions`} className={sectionTitle}>
              {t('manage.actions')}
            </h2>
            <CalendarExport
              session={b.session}
              status={b.status}
              reference={b.reference}
              partySize={b.partySize}
              manageUrl={`${location.origin}/reservacion/${token}/`}
              full
            />
            {canAsk ? (
              <div className="space-y-2 border-t border-border/70 pt-4">
                <Button variant="secondary" width="full" onClick={() => setAskOpen(true)} disabled={busy !== null}>
                  <MessageSquareText aria-hidden="true" />
                  {t('manage.ask')}
                </Button>
                {b.openRequests.length ? (
                  <p className={cn(helper, numbers)}>{t('manage.openRequests', {count: b.openRequests.length})}</p>
                ) : null}
              </div>
            ) : null}
            {b.canWithdraw ? (
              <div className="border-t border-border/70 pt-4">
                <Button variant="quiet" width="full" onClick={() => setConfirmWithdraw(true)} disabled={busy !== null}>
                  <CircleX aria-hidden="true" />
                  {t('manage.withdraw')}
                </Button>
              </div>
            ) : null}
          </motion.section>
        ) : null}

        <motion.section
          variants={entry.item}
          aria-labelledby={`${ids}-terms`}
          className={cn(panel, 'space-y-3 lg:col-start-1')}
        >
          <h2 id={`${ids}-terms`} className={sectionTitle}>
            {t('manage.terms')}
          </h2>
          {locked.acceptedAt !== null ? (
            <>
              <p className={helper}>{t('manage.acceptedOn', {date: formatLongDate(locked.acceptedAt, lang)})}</p>
              {locked.priceStatus ? (
                <div>
                  <p className={helper}>{t('manage.price')}</p>
                  <p className={cn('text-base leading-6 text-ink', numbers)}>
                    {termsPrice(
                      {
                        priceStatus: locked.priceStatus,
                        unitPriceCents: locked.unitPriceCents,
                        currency: locked.currency,
                      },
                      t,
                      lang,
                    )}
                  </p>
                  {locked.priceStatus === 'approved' && locked.unitPriceCents !== null && locked.currency ? (
                    <p className={cn(helper, numbers)}>
                      {t('flow.total', {
                        amount: formatMoney(locked.unitPriceCents * b.partySize, locked.currency, lang),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <Disclosure summary={t('manage.readTerms')}>
                <PolicyBlock policy={locked.policy} quoteOpen />
              </Disclosure>
            </>
          ) : (
            <>
              <p className="text-base leading-6 text-ink">{t('manage.noTerms')}</p>
              <div>
                <p className={helper}>{t('detail.price')}</p>
                <p className={cn('text-base leading-6 text-ink', numbers)}>
                  <Price price={b.session.price} />
                </p>
              </div>
            </>
          )}
          {b.netPaidCents > 0 ? (
            <p className={cn('text-base leading-6 text-ink', numbers)}>
              {t('manage.paid', {amount: formatMoney(b.netPaidCents, currency, lang)})}
            </p>
          ) : null}
        </motion.section>
      </div>

      <Dialog
        open={confirmWithdraw}
        onOpenChange={setConfirmWithdraw}
        title={t('manage.withdraw')}
        description={t('manage.withdrawConfirm')}
        closeLabel={t('app.close')}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmWithdraw(false)}>
              {t('manage.keep')}
            </Button>
            <Button variant="quiet" onClick={() => void withdraw()}>
              {t('manage.withdrawYes')}
            </Button>
          </div>
        }
      >
        <p className={cn('text-base leading-6 text-ink', numbers)}>
          {t('manage.reference')}: <span className="font-semibold">{b.reference}</span>
        </p>
      </Dialog>

      <Dialog
        kind="sheet"
        open={askOpen}
        onOpenChange={setAskOpen}
        title={t('manage.ask')}
        description={t('manage.askHelp')}
        closeLabel={t('app.close')}
        footer={
          <div className="flex gap-3">
            <Button onClick={() => setAskOpen(false)}>{t('manage.keep')}</Button>
            <Button type="submit" form={askForm} variant="primary" className="flex-1" disabled={busy !== null}>
              {busy === 'ask' ? t('flow.sending') : t('manage.askSend')}
            </Button>
          </div>
        }
      >
        <form id={askForm} onSubmit={ask} className="space-y-4" noValidate>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-5 text-ink">{t('manage.kind')}</legend>
            <Choices
              name={kindId}
              label={t('manage.kind')}
              value={askKind}
              onChange={value => setAskKind(value)}
              options={[
                {value: 'change', label: t('manage.askChange')},
                {value: 'cancel', label: t('manage.askCancel')},
              ]}
            />
          </fieldset>
          {askKind === 'cancel' ? <p className={helper}>{t('manage.policyNote')}</p> : null}
          <Field id={detailsId} label={t('manage.askDetails')} error={askError ?? undefined}>
            <Textarea
              id={detailsId}
              value={askDetails}
              maxLength={400}
              onChange={event => setAskDetails(event.target.value)}
              aria-invalid={askError ? true : undefined}
              aria-describedby={describedBy(detailsId, false, Boolean(askError))}
            />
          </Field>
          {notice?.tone === 'problem' ? (
            <div role="alert">
              <NoticeText notice={notice} />
            </div>
          ) : null}
        </form>
      </Dialog>
    </motion.div>
  );
}
