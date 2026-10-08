// Staff: reservations. Search, a request entered by hand (with a duplicate warning), and one
// booking's page: its actions by status, the exception resolutions, payments and refunds on any
// status, link reissue and a reply helper built from the real status.
import {useEffect, useId, useMemo, useRef, useState, type FormEvent} from 'react';
import {ChevronLeft, Copy, Plus} from 'lucide-react';
import type {PublicPolicy} from '../../shared/types.ts';
import {formatLongDate, formatShortDate, formatTime, prDateKey} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {copyText} from '../lib/copy.ts';
import {newToken} from '../lib/ids.ts';
import {Link, navigate, useLocation} from '../lib/router.tsx';
import {helper, numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {intOrNull, parseMoney, useQuery, useWrite} from './api.ts';
import {
  BookingStatus,
  Card,
  Confirm,
  Demo,
  NoticeLine,
  Pill,
  QueryView,
  SelectField,
  TextField,
  When,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {BookingTable, PageHeading, type StaffBookingRow, type StaffSession} from './Sessions.tsx';
import {useMe} from './me.ts';

const STATUSES = ['inquiry', 'pending_payment', 'confirmed', 'exception', 'cancelled', 'fulfilled', 'no_show'] as const;
const ACTIVE = ['inquiry', 'pending_payment', 'confirmed', 'exception'];
const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useDebounced<T>(value: T, ms: number): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return current;
}

/** Published sessions a booking can go to (for moves, proposals and new requests). */
function useSessionOptions() {
  const {query} = useQuery<{sessions: StaffSession[]}>('/api/equipo/sessions');
  const {lang} = useStaffT();
  return useMemo(() => {
    const list = query.state === 'ready' ? query.data.sessions : [];
    const label = (s: StaffSession) =>
      `${s.title_es ?? s.id} · ${s.starts_at === null ? '—' : `${formatShortDate(s.starts_at, lang)} ${formatTime(s.starts_at, lang)}`}`;
    return {list, label, published: list.filter(s => s.state === 'published')};
  }, [query, lang]);
}

export function BookingsList() {
  const {t} = useStaffT();
  const ids = useId();
  const {search: params} = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(params.get('status') ?? 'all');
  const [sessionId, setSessionId] = useState(params.get('session') ?? '');
  const sessions = useSessionOptions();
  const q = useDebounced(search, 300);
  const query = new URLSearchParams();
  if (q.trim()) query.set('q', q.trim());
  if (status !== 'all') query.set('status', status);
  if (sessionId) query.set('session', sessionId);
  const {query: result, reload} = useQuery<{bookings: StaffBookingRow[]}>(`/api/equipo/bookings?${query}`);
  return (
    <>
      <PageHeading
        actions={
          <Link
            to={`/equipo/reservaciones/nueva/${sessionId ? `?session=${sessionId}` : ''}`}
            className={buttonVariants({variant: 'primary'})}
          >
            <Plus aria-hidden="true" />
            {t('bk.new')}
          </Link>
        }
      >
        {t('nav.bookings')}
      </PageHeading>
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField
            id={`${ids}-q`}
            label={t('bk.search')}
            value={search}
            onChange={setSearch}
            inputMode="search"
            type="search"
          />
          <SelectField
            id={`${ids}-status`}
            label={t('bk.status')}
            value={status}
            onChange={setStatus}
            options={[
              {value: 'all', label: t('bk.allStatuses')},
              ...STATUSES.map(s => ({value: s, label: t(`bstatus.${s}`)})),
            ]}
          />
          <SelectField
            id={`${ids}-session`}
            label={t('bk.session')}
            value={sessionId}
            onChange={setSessionId}
            options={[
              {value: '', label: t('bk.allSessions')},
              ...sessions.list.map(s => ({value: s.id, label: sessions.label(s)})),
            ]}
          />
        </div>
        <QueryView query={result} onRetry={() => void reload()}>
          {({bookings}) =>
            bookings.length ? (
              <BookingTable bookings={bookings} showSession />
            ) : (
              <p className="text-base leading-6 text-ink">{t('bk.empty')}</p>
            )
          }
        </QueryView>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ manual entry

export function ManualEntry({sessionId}: {sessionId: string | null}) {
  const {t} = useStaffT();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const sessions = useSessionOptions();
  const [notice, setNotice] = useState<Notice>(null);
  const [form, setForm] = useState({
    sessionId: sessionId ?? '',
    partySize: '2',
    leadName: '',
    contactKind: 'phone' as 'phone' | 'email',
    contactValue: '',
    note: '',
    source: 'instagram_dm' as 'instagram_dm' | 'phone' | 'in_person' | 'other',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const name = useDebounced(form.leadName.trim().toLowerCase(), 400);
  const contact = useDebounced(form.contactValue.trim().toLowerCase(), 400);
  const dupPath =
    form.sessionId && (name.length > 1 || contact.length > 2)
      ? `/api/equipo/bookings/duplicates?${new URLSearchParams({session: form.sessionId, name, contact})}`
      : null;
  const duplicates = useQuery<{duplicates: StaffBookingRow[]}>(dupPath);
  const found = dupPath && duplicates.query.state === 'ready' ? duplicates.query.data.duplicates : [];

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    const size = intOrNull(form.partySize);
    if (!form.sessionId) found.sessionId = t('bk.pickSession');
    if (!size || Number.isNaN(size) || size > 60) found.partySize = t('ses.invalidNumber');
    if (form.leadName.trim().length < 2) found.leadName = t('error.name');
    const value = form.contactValue.trim();
    if (form.contactKind === 'phone' ? !PHONE.test(value) : !EMAIL.test(value)) {
      found.contactValue = form.contactKind === 'phone' ? t('error.phone') : t('error.email');
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    const result = await run('/api/equipo/bookings', {
      sessionId: form.sessionId,
      partySize: size,
      leadName: form.leadName.trim(),
      contactKind: form.contactKind,
      contactValue: value,
      note: form.note.trim() || null,
      source: form.source,
    });
    setNotice(outcome(result, t('bk.savedInquiry')));
    const id = result.kind === 'ok' ? (result.data.outcome as {id?: string} | null)?.id : null;
    if (id) navigate(`/equipo/reservaciones/${id}/`);
  };

  return (
    <>
      <PageHeading>{t('bk.new')}</PageHeading>
      <div className="max-w-2xl space-y-4">
        <p className="text-base leading-6 text-ink">{t('bk.newHelp')}</p>
        <NoticeLine notice={notice} />
        <Card>
          <form onSubmit={save} noValidate className="space-y-4">
            <SelectField
              id={`${ids}-session`}
              label={t('bk.session')}
              value={form.sessionId}
              onChange={value => set({sessionId: value})}
              options={[
                {value: '', label: t('bk.pickSession')},
                ...sessions.published.map(s => ({value: s.id, label: sessions.label(s)})),
              ]}
            />
            {errors.sessionId ? (
              <p role="alert" className="text-sm font-medium leading-5 text-ink">
                {errors.sessionId}
              </p>
            ) : null}
            <SelectField
              id={`${ids}-source`}
              label={t('bk.source')}
              value={form.source}
              onChange={value => set({source: value})}
              options={(['instagram_dm', 'phone', 'in_person', 'other'] as const).map(s => ({
                value: s,
                label: t(`source.${s}`),
              }))}
            />
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
            <SelectField
              id={`${ids}-kind`}
              label={t('bk.contactKind')}
              value={form.contactKind}
              onChange={value => set({contactKind: value})}
              options={[
                {value: 'phone', label: t('bk.phone')},
                {value: 'email', label: t('bk.email')},
              ]}
            />
            <TextField
              id={`${ids}-contact`}
              label={t('bk.contact')}
              type={form.contactKind === 'email' ? 'email' : 'tel'}
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
            />
            {found.length ? (
              <div role="status" className="space-y-2 rounded-2xl border-2 border-ink p-3">
                <p className="text-sm font-semibold leading-5 text-ink">{t('bk.duplicates')}</p>
                <ul className="space-y-1">
                  {found.map(d => (
                    <li key={d.id}>
                      <Link to={`/equipo/reservaciones/${d.id}/`} className={buttonVariants({variant: 'link'})}>
                        {d.reference} · {d.lead_name} · {t(`bstatus.${d.status}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? t('flow.sending') : t('bk.saveInquiry')}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ one booking

interface Payment {
  id: string;
  kind: 'payment' | 'refund' | 'reversal';
  method: string;
  amount_cents: number;
  currency: string;
  external_reference: string | null;
  reverses_payment_id: string | null;
  note: string | null;
  recorded_by: string;
  recorded_at: number;
}

interface BookingData {
  booking: StaffBookingRow & {
    accepted_policy_version_id: string | null;
    accepted_at: number | null;
    terms_price_status: 'approved' | 'not_charged' | null;
    unit_price_cents: number | null;
    currency: string | null;
    has_link: number;
    updated_at: number;
  };
  session: (StaffSession & {title_es: string; seats_taken: number}) | null;
  payments: Payment[];
  acceptances: {
    id: string;
    session_id: string;
    policy_version_id: string;
    price_status: string;
    unit_price_cents: number | null;
    currency: string | null;
    accepted_at: number;
  }[];
  proposals: {
    id: string;
    session_id: string;
    status: 'open' | 'accepted' | 'withdrawn';
    created_at: number;
    created_by: string;
  }[];
  requests: {
    id: string;
    kind: 'cancel' | 'change';
    details: string | null;
    status: 'open' | 'resolved';
    created_at: number;
  }[];
  audit: {mutation_id: string; actor: string; action: string; at: number}[];
  lockedPolicy: PublicPolicy | null;
  lockedRules: {
    state: string;
    fullPayment: number | null;
    refundFractionBp: number | null;
    cutoffRule: string | null;
  } | null;
}

function Detail({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div>
      <dt className={helper}>{label}</dt>
      <dd className="text-base leading-6 text-ink">{children}</dd>
    </div>
  );
}

function SessionPicker({
  id,
  label,
  value,
  onChange,
  exclude,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  exclude: string;
}) {
  const {t} = useStaffT();
  const sessions = useSessionOptions();
  return (
    <SelectField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={[
        {value: '', label: t('bk.pickSession')},
        ...sessions.published.filter(s => s.id !== exclude).map(s => ({value: s.id, label: sessions.label(s)})),
      ]}
    />
  );
}

/** An action that needs one more input (a size or a session) before it is sent. */
function InputAction({
  label,
  disabled,
  children,
  canSend,
  onSend,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  canSend: boolean;
  onSend: () => Promise<boolean>;
}) {
  const {t} = useStaffT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={label} closeLabel={t('staff.close')}>
        <form
          className="space-y-4"
          onSubmit={async event => {
            event.preventDefault();
            if (await onSend()) setOpen(false);
          }}
        >
          {children}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('staff.cancelAction')}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSend || disabled}>
              {label}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function BookingPage({id}: {id: string}) {
  const {t, lang} = useStaffT();
  const me = useMe();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const {query, reload} = useQuery<BookingData>(`/api/equipo/bookings/${id}`);
  const sessions = useSessionOptions();
  const [notice, setNotice] = useState<Notice>(null);
  const [size, setSize] = useState('');
  const [destination, setDestination] = useState('');
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // A reissue whose answer was lost is retried with the same token (and so the same intent).
  const pendingToken = useRef<string | null>(null);

  return (
    <QueryView query={query} onRetry={() => void reload()}>
      {data => {
        const b = data.booking;
        const session = data.session;
        const status = b.status;
        const people = b.party_size === 1 ? t('bk.person') : t('bk.people', {count: b.party_size});
        const today = session?.starts_at != null && prDateKey(session.starts_at) === prDateKey(me.now);
        const started = session?.starts_at != null && session.starts_at <= me.now;

        const act = async (body: Record<string, unknown>, ok: string) => {
          const result = await run(`/api/equipo/bookings/${b.id}/actions`, {expectedVersion: b.version, ...body});
          let next = outcome(result, ok);
          if (result.kind === 'ok') {
            const after = result.data.outcome as {status?: string} | null;
            if (after?.status === 'exception' && status !== 'exception')
              next = {tone: 'problem', text: t('bk.toException')};
          } else if (status === 'exception' && (body.action === 'resolve_same' || body.action === 'resolve_other')) {
            next = {tone: 'problem', text: `${next?.text ?? ''} ${t('exc.failKept')}`};
          }
          setNotice(next);
          void reload(true);
          return result.kind === 'ok';
        };

        const reissue = async () => {
          const token = pendingToken.current ?? newToken();
          pendingToken.current = token;
          const result = await run(`/api/equipo/bookings/${b.id}/actions`, {
            action: 'reissue_link',
            expectedVersion: b.version,
            token,
          });
          if (result.kind !== 'lost') pendingToken.current = null;
          setNotice(outcome(result, t('bk.reissueDone')));
          if (result.kind === 'ok') setFreshLink(`${location.origin}/reservacion/${token}/`);
          void reload(true);
        };

        const copy = async (text: string, key: string) => {
          setCopied((await copyText(text)) ? key : `fail:${key}`);
        };

        const when =
          session?.starts_at != null
            ? `${formatLongDate(session.starts_at, lang)}, ${formatTime(session.starts_at, lang)}`
            : t('staff.dateTbd');
        const buildReply = () => {
          const text = t(`reply.${status}`, {name: b.lead_name, reference: b.reference, when, people});
          setReply(freshLink ? `${text} ${t('reply.link', {url: freshLink})}` : text);
        };

        const seatsLeft =
          session && session.capacity !== null ? session.capacity - session.blocked_seats - session.seats_taken : null;
        const lockedPrice =
          b.terms_price_status === 'not_charged'
            ? t('ses.price.not_charged')
            : b.unit_price_cents !== null && b.currency
              ? formatMoney(b.unit_price_cents, b.currency, lang)
              : null;
        const refundCalc =
          status === 'cancelled' &&
          b.net > 0 &&
          data.lockedRules?.refundFractionBp != null &&
          data.lockedRules.state !== 'draft'
            ? Math.floor((b.net * data.lockedRules.refundFractionBp) / 10000)
            : null;
        const sessionTitle = (sid: string) => sessions.list.find(s => s.id === sid)?.title_es ?? sid;

        return (
          <>
            <Link to="/equipo/reservaciones/" className={cn(buttonVariants({variant: 'ghost'}), '-ml-3 mb-2')}>
              <ChevronLeft aria-hidden="true" />
              {t('bk.back')}
            </Link>
            <PageHeading>{`${b.lead_name} · ${b.reference}`}</PageHeading>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Demo synthetic={b.synthetic} />
              <BookingStatus status={status} />
              {b.exception_reason ? (
                <Pill strong>{t('bk.exceptionReason', {reason: t(`reason.${b.exception_reason}`)})}</Pill>
              ) : null}
              <span className={cn('text-sm leading-5 text-ink', numbers)}>{people}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-4">
                <NoticeLine notice={notice} />
                {freshLink ? (
                  <Card title={t('bk.reissue')}>
                    <p className="text-sm font-medium leading-5 text-ink">{t('bk.reissueDone')}</p>
                    <p className="break-all rounded-xl border border-stone-300 bg-stone-50 p-3 font-mono text-sm leading-5 text-ink">
                      {freshLink}
                    </p>
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" onClick={() => void copy(freshLink, 'link')}>
                        <Copy aria-hidden="true" />
                        {t('bk.copy')}
                      </Button>
                      <span role="status" className={helper}>
                        {copied === 'link' ? t('bk.copied') : copied === 'fail:link' ? t('bk.copyFailed') : ''}
                      </span>
                    </div>
                  </Card>
                ) : null}

                <Card title={t('bk.actions')}>
                  {status === 'exception' ? <p className="text-sm leading-5 text-ink">{t('exc.help')}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {status === 'inquiry' || status === 'pending_payment' ? (
                      <Confirm
                        variant="primary"
                        trigger={t('bk.confirm')}
                        title={t('bk.confirm')}
                        body={t('bk.confirmBody')}
                        confirmLabel={t('bk.confirm')}
                        disabled={busy}
                        onConfirm={() => act({action: 'confirm'}, t('bk.done'))}
                      />
                    ) : null}
                    {status === 'exception' ? (
                      <>
                        <Confirm
                          variant="primary"
                          trigger={t('exc.same')}
                          title={t('exc.same')}
                          body={t('bk.confirmBody')}
                          confirmLabel={t('exc.same')}
                          disabled={busy}
                          onConfirm={() => act({action: 'resolve_same'}, t('bk.done'))}
                        />
                        <InputAction
                          label={t('exc.other')}
                          disabled={busy}
                          canSend={Boolean(destination)}
                          onSend={() => act({action: 'resolve_other', destination}, t('bk.done'))}
                        >
                          <SessionPicker
                            id={`${ids}-resolve`}
                            label={t('bk.destination')}
                            value={destination}
                            onChange={setDestination}
                            exclude={b.session_id}
                          />
                          <p className={helper}>{t('bk.confirmBody')}</p>
                        </InputAction>
                      </>
                    ) : null}
                    {status === 'confirmed' ? (
                      <InputAction
                        label={t('bk.resize')}
                        disabled={busy}
                        canSend={Boolean(intOrNull(size))}
                        onSend={() => act({action: 'resize', partySize: intOrNull(size)}, t('bk.done'))}
                      >
                        <TextField
                          id={`${ids}-size`}
                          label={t('bk.party')}
                          inputMode="numeric"
                          value={size || String(b.party_size)}
                          onChange={setSize}
                        />
                      </InputAction>
                    ) : null}
                    {status === 'confirmed' || status === 'inquiry' || status === 'pending_payment' ? (
                      <InputAction
                        label={t('bk.move')}
                        disabled={busy}
                        canSend={Boolean(destination)}
                        onSend={() => act({action: 'move', destination}, t('bk.done'))}
                      >
                        <SessionPicker
                          id={`${ids}-move`}
                          label={t('bk.destination')}
                          value={destination}
                          onChange={setDestination}
                          exclude={b.session_id}
                        />
                      </InputAction>
                    ) : null}
                    {ACTIVE.includes(status) ? (
                      <InputAction
                        label={t('bk.propose')}
                        disabled={busy}
                        canSend={Boolean(destination)}
                        onSend={() => act({action: 'propose_terms', sessionId: destination}, t('bk.done'))}
                      >
                        <SessionPicker
                          id={`${ids}-propose`}
                          label={t('ses.policy')}
                          value={destination}
                          onChange={setDestination}
                          exclude=""
                        />
                        <p className={helper}>{t('bk.proposeHelp')}</p>
                      </InputAction>
                    ) : null}
                    {status === 'inquiry' || status === 'pending_payment' ? (
                      <EditBooking booking={b} onSent={act} busy={busy} />
                    ) : null}
                    {status === 'confirmed' && today && !b.checked_in_at ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void act({action: 'check_in'}, t('bk.done'))}
                      >
                        {t('bk.checkIn')}
                      </Button>
                    ) : null}
                    {status === 'confirmed' && today && b.checked_in_at ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void act({action: 'undo_check_in'}, t('bk.done'))}
                      >
                        {t('bk.undoCheckIn')}
                      </Button>
                    ) : null}
                    {status === 'confirmed' && started ? (
                      <>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void act({action: 'fulfilled'}, t('bk.done'))}
                        >
                          {t('bk.fulfilled')}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void act({action: 'no_show'}, t('bk.done'))}
                        >
                          {t('bk.noShow')}
                        </Button>
                      </>
                    ) : null}
                    {ACTIVE.includes(status) ? (
                      <Confirm
                        trigger={status === 'exception' ? t('exc.cancel') : t('bk.cancel')}
                        title={t('bk.cancel')}
                        body={t('bk.cancelBody')}
                        confirmLabel={t('bk.cancel')}
                        disabled={busy}
                        onConfirm={() => act({action: 'cancel'}, t('bk.done'))}
                      />
                    ) : null}
                    <Confirm
                      variant="secondary"
                      trigger={t('bk.reissue')}
                      title={t('bk.reissue')}
                      body={t('bk.reissueBody')}
                      confirmLabel={t('bk.reissue')}
                      disabled={busy}
                      onConfirm={reissue}
                    />
                  </div>
                  {!b.has_link ? <p className={helper}>{t('bk.noLink')}</p> : null}
                </Card>

                <Payments
                  data={data}
                  onRecorded={() => void reload(true)}
                  setNotice={setNotice}
                  seatsLeft={seatsLeft}
                  refundCalc={refundCalc}
                />

                <Card title={t('bk.reply')}>
                  <p className={helper}>{t('bk.replyHelp')}</p>
                  <Button variant="secondary" onClick={buildReply}>
                    {t('bk.reply')}
                  </Button>
                  {reply ? (
                    <div className="space-y-2">
                      <textarea
                        readOnly
                        value={reply}
                        aria-label={t('bk.reply')}
                        className="block min-h-24 w-full rounded-2xl border border-stone-500 bg-surface p-3 text-base leading-6 text-ink"
                      />
                      <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => void copy(reply, 'reply')}>
                          <Copy aria-hidden="true" />
                          {t('bk.copy')}
                        </Button>
                        <span role="status" className={helper}>
                          {copied === 'reply' ? t('bk.copied') : copied === 'fail:reply' ? t('bk.copyFailed') : ''}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <dl className="space-y-3">
                    <Detail label={t('ses.experience')}>
                      {session ? (
                        <Link to={`/equipo/sesiones/${session.id}/`} className={buttonVariants({variant: 'link'})}>
                          {session.title_es}
                        </Link>
                      ) : null}
                      <span className="block text-sm leading-5">
                        <When ms={session?.starts_at ?? null} />
                      </span>
                    </Detail>
                    <Detail label={t('bk.contact')}>
                      {t(b.contact_kind === 'phone' ? 'bk.phone' : 'bk.email')}: {b.contact_value}
                    </Detail>
                    {b.note ? <Detail label={t('bk.note')}>{b.note}</Detail> : null}
                    <Detail label={t('bk.source')}>{t(`source.${b.source}`)}</Detail>
                    <Detail label={t('bk.reference')}>
                      <span className={numbers}>{b.reference}</span>
                    </Detail>
                    {b.checked_in_at ? (
                      <Detail label={t('ton.arrived')}>
                        {t('bk.checkedIn', {time: formatTime(b.checked_in_at, lang)})}
                      </Detail>
                    ) : null}
                    <p className={helper}>{t('bk.created', {date: formatLongDate(b.created_at, lang)})}</p>
                  </dl>
                </Card>
                <Card title={t('bk.locked')}>
                  {b.accepted_at ? (
                    <div className="space-y-2 text-sm leading-5 text-ink">
                      <p>{data.lockedPolicy?.title}</p>
                      {lockedPrice ? <p className={numbers}>{t('bk.lockedPrice', {price: lockedPrice})}</p> : null}
                      <p className={helper}>{t('bk.acceptedOn', {date: formatLongDate(b.accepted_at, lang)})}</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-5 text-ink">{t('bk.lockedNone')}</p>
                  )}
                </Card>
                {data.proposals.length ? (
                  <Card title={t('bk.proposals')}>
                    <ul className="space-y-2 text-sm leading-5 text-ink">
                      {data.proposals.map(p => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {sessionTitle(p.session_id)} · {formatShortDate(p.created_at, lang)}
                          </span>
                          <Pill strong={p.status === 'open'}>{t(`bk.proposal.${p.status}`)}</Pill>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
                {data.requests.length ? (
                  <Card title={t('bk.requests')}>
                    <ul className="space-y-3">
                      {data.requests.map(r => (
                        <li key={r.id} className="space-y-1 text-sm leading-5 text-ink">
                          <p className="font-semibold">
                            {t(`req.kind.${r.kind}`)} · {formatShortDate(r.created_at, lang)}
                          </p>
                          {r.details ? <p>{r.details}</p> : null}
                          {r.status === 'open' ? (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={async () => {
                                const result = await run(`/api/equipo/requests/${r.id}/resolve`, {});
                                setNotice(outcome(result, t('req.resolved')));
                                void reload(true);
                              }}
                            >
                              {t('bk.resolve')}
                            </Button>
                          ) : (
                            <Pill>{t('req.resolved')}</Pill>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
                <Card title={t('bk.history')}>
                  <ul className="space-y-2 text-sm leading-5 text-ink">
                    {data.audit.map(event => (
                      <li key={event.mutation_id}>
                        <span className="font-medium">{event.action}</span>
                        <span className={cn('block', helper)}>
                          {t('hist.by', {
                            who: event.actor,
                            date: `${formatShortDate(event.at, lang)} ${formatTime(event.at, lang)}`,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </QueryView>
  );
}

function EditBooking({
  booking,
  onSent,
  busy,
}: {
  booking: StaffBookingRow;
  onSent: (body: Record<string, unknown>, ok: string) => Promise<boolean>;
  busy: boolean;
}) {
  const {t} = useStaffT();
  const ids = useId();
  const [form, setForm] = useState({
    partySize: String(booking.party_size),
    leadName: booking.lead_name,
    contactKind: booking.contact_kind,
    contactValue: booking.contact_value,
    note: booking.note ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const size = intOrNull(form.partySize);
  const valid =
    Boolean(size) &&
    !Number.isNaN(size) &&
    form.leadName.trim().length >= 2 &&
    (form.contactKind === 'phone' ? PHONE.test(form.contactValue.trim()) : EMAIL.test(form.contactValue.trim()));
  return (
    <InputAction
      label={t('bk.edit')}
      disabled={busy}
      canSend={valid}
      onSend={() =>
        onSent(
          {
            action: 'edit',
            partySize: size,
            leadName: form.leadName.trim(),
            contactKind: form.contactKind,
            contactValue: form.contactValue.trim(),
            note: form.note.trim() || null,
          },
          t('bk.done'),
        )
      }
    >
      <TextField
        id={`${ids}-party`}
        label={t('bk.party')}
        inputMode="numeric"
        value={form.partySize}
        onChange={value => set({partySize: value})}
      />
      <TextField
        id={`${ids}-name`}
        label={t('bk.lead')}
        value={form.leadName}
        onChange={value => set({leadName: value})}
      />
      <SelectField
        id={`${ids}-kind`}
        label={t('bk.contactKind')}
        value={form.contactKind}
        onChange={value => set({contactKind: value})}
        options={[
          {value: 'phone', label: t('bk.phone')},
          {value: 'email', label: t('bk.email')},
        ]}
      />
      <TextField
        id={`${ids}-contact`}
        label={t('bk.contact')}
        value={form.contactValue}
        onChange={value => set({contactValue: value})}
      />
      <TextField
        id={`${ids}-note`}
        label={t('bk.note')}
        value={form.note}
        onChange={value => set({note: value})}
        multiline
        maxLength={280}
      />
    </InputAction>
  );
}

function Payments({
  data,
  onRecorded,
  setNotice,
  seatsLeft,
  refundCalc,
}: {
  data: BookingData;
  onRecorded: () => void;
  setNotice: (notice: Notice) => void;
  seatsLeft: number | null;
  refundCalc: number | null;
}) {
  const {t, lang} = useStaffT();
  const me = useMe();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const b = data.booking;
  const [kind, setKind] = useState<'payment' | 'refund' | 'reversal'>('payment');
  const [method, setMethod] = useState<string>(me.demo ? 'prueba' : 'ath_movil');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [reverses, setReverses] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reversed = new Set(data.payments.map(p => p.reverses_payment_id).filter(Boolean));
  const reversible = data.payments.filter(p => p.kind !== 'reversal' && !reversed.has(p.id));
  const methods = [
    'ath_movil',
    'efectivo',
    'tarjeta',
    'transferencia',
    'otro',
    ...(me.environment === 'production' ? [] : ['prueba']),
  ];
  const shortOfSeats = b.status === 'pending_payment' && seatsLeft !== null && seatsLeft < b.party_size;

  const record = async (event: FormEvent) => {
    event.preventDefault();
    const original = data.payments.find(p => p.id === reverses);
    const cents = kind === 'reversal' ? (original?.amount_cents ?? null) : parseMoney(amount);
    if (!cents) {
      setError(t('ses.invalidAmount'));
      return;
    }
    setError(null);
    const result = await run(`/api/equipo/bookings/${b.id}/payments`, {
      kind,
      method: kind === 'reversal' ? (original?.method ?? method) : method,
      amountCents: cents,
      currency: 'USD',
      externalReference: kind === 'reversal' ? null : reference.trim() || null,
      reversesPaymentId: kind === 'reversal' ? reverses || null : null,
      note: note.trim() || null,
    });
    const after = result.kind === 'ok' ? (result.data.outcome as {status?: string} | null) : null;
    setNotice(
      after?.status === 'exception' && b.status !== 'exception'
        ? {tone: 'problem', text: t('bk.toException')}
        : outcome(result, t('bk.recorded')),
    );
    if (result.kind === 'ok') {
      setAmount('');
      setReference('');
      setNote('');
      setReverses('');
    }
    onRecorded();
  };

  return (
    <Card title={t('bk.payments')}>
      <p className={cn('text-base font-medium leading-6 text-ink', numbers)}>
        {t('bk.net', {amount: formatMoney(b.net, 'USD', lang)})}
      </p>
      {refundCalc !== null ? (
        <p className={cn('text-sm leading-5 text-ink', numbers)}>
          {t('bk.calcRefund', {amount: formatMoney(refundCalc, 'USD', lang)})}
        </p>
      ) : null}
      {data.payments.length ? (
        <ul className="divide-y divide-border/70">
          {data.payments.map(p => (
            <li key={p.id} className="space-y-0.5 py-2 text-sm leading-5 text-ink">
              <p className={cn('font-medium', numbers)}>
                {t(`kind.${p.kind}`)}: {formatMoney(p.amount_cents, p.currency, lang)} · {t(`method.${p.method}`)}
                {p.external_reference ? ` · ${p.external_reference}` : ''}
              </p>
              <p className={helper}>
                {t('bk.payBy', {who: p.recorded_by, date: formatShortDate(p.recorded_at, lang)})}
              </p>
              {p.note ? <p className={helper}>{p.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-5 text-ink">{t('bk.noPayments')}</p>
      )}
      <form onSubmit={record} noValidate className="space-y-4 border-t border-border/70 pt-4">
        <h3 className="text-sm font-semibold leading-5 text-ink">{t('bk.record')}</h3>
        {shortOfSeats && kind === 'payment' ? (
          <p role="status" className="rounded-2xl border-2 border-ink p-3 text-sm font-medium leading-5 text-ink">
            {t('bk.seatsWarning')}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id={`${ids}-kind`}
            label={t('bk.kind')}
            value={kind}
            onChange={setKind}
            options={(['payment', 'refund', 'reversal'] as const).map(k => ({value: k, label: t(`kind.${k}`)}))}
          />
          {kind === 'reversal' ? (
            <SelectField
              id={`${ids}-reverses`}
              label={t('bk.reverses')}
              value={reverses}
              onChange={setReverses}
              options={[
                {value: '', label: '—'},
                ...reversible.map(p => ({
                  value: p.id,
                  label: `${t(`kind.${p.kind}`)} · ${formatMoney(p.amount_cents, p.currency, lang)} · ${formatShortDate(p.recorded_at, lang)}`,
                })),
              ]}
            />
          ) : (
            <>
              <SelectField
                id={`${ids}-method`}
                label={t('bk.method')}
                value={method}
                onChange={setMethod}
                options={methods.map(m => ({value: m, label: t(`method.${m}`)}))}
              />
              <TextField
                id={`${ids}-amount`}
                label={t('bk.amount')}
                inputMode="decimal"
                value={amount}
                onChange={setAmount}
                error={error}
              />
              <TextField
                id={`${ids}-ref`}
                label={t('bk.extRef')}
                value={reference}
                onChange={setReference}
                maxLength={80}
              />
            </>
          )}
        </div>
        <TextField id={`${ids}-note`} label={t('bk.payNote')} value={note} onChange={setNote} maxLength={280} />
        <Button type="submit" variant="primary" disabled={busy || (kind === 'reversal' && !reverses)}>
          {busy ? t('flow.sending') : t('bk.record')}
        </Button>
      </form>
    </Card>
  );
}
