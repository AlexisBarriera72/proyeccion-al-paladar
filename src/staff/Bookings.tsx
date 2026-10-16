// Staff: reservations. Search and filters, a request entered by hand (a sheet, with a duplicate
// warning), and one booking's page: the status's next step stays visible, the rest sits behind
// "Más acciones" and opens its own dialog. Payments and refunds are recorded in a dialog; the
// ledger and the net amount stay on the page. A reply draft is built from the real status.
import {useId, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {
  ArrowLeftRight,
  ArrowRightLeft,
  ChevronLeft,
  CircleX,
  Copy,
  Link2,
  Pencil,
  Plus,
  Send,
  SlidersHorizontal,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {formatLongDate, formatShortDate, formatTime, prDateKey} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {copyText} from '../lib/copy.ts';
import {newToken} from '../lib/ids.ts';
import {Link, navigate, useLocation} from '../lib/router.tsx';
import {helper, numbers, rows, workspace} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {Menu, type MenuAction} from '../components/ui/menu.tsx';
import {Switch} from '../components/ui/tabs.tsx';
import {intOrNull, parseMoney, useQuery, useWrite} from './api.ts';
import {
  BookingStatus,
  Callout,
  Confirm,
  ConfirmDialog,
  Demo,
  Empty,
  Facts,
  FormFooter,
  InputAction,
  InputDialog,
  NoticeLine,
  Page,
  PageHeader,
  Panel,
  Pill,
  QueryView,
  SelectField,
  TextField,
  flushList,
  rowItem,
  useDebounced,
  useOnOpen,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {BookingColumns, BookingRows, SessionPicker, useSessionOptions} from './rows.tsx';
import {AuditRow} from './history.tsx';
import {useMe, useRefreshCounts} from './me.ts';
import type {BookingData, StaffBookingRow} from './types.ts';

const STATUSES = ['inquiry', 'pending_payment', 'confirmed', 'exception', 'cancelled', 'fulfilled', 'no_show'] as const;
const ACTIVE = ['inquiry', 'pending_payment', 'confirmed', 'exception'];
const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------ the list

export function BookingsList({entry}: {entry?: {sessionId: string | null}}) {
  const {t} = useStaffT();
  const ids = useId();
  const {search: params} = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(params.get('status') ?? 'all');
  const [sessionId, setSessionId] = useState(entry ? '' : (params.get('session') ?? ''));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const sessions = useSessionOptions();
  const q = useDebounced(search, 300);
  const query = new URLSearchParams();
  if (q.trim()) query.set('q', q.trim());
  if (status !== 'all') query.set('status', status);
  if (sessionId) query.set('session', sessionId);
  const {query: result, reload} = useQuery<{bookings: StaffBookingRow[]}>(`/api/equipo/bookings?${query}`);
  const active = (status !== 'all' ? 1 : 0) + (sessionId ? 1 : 0);
  const clear = () => {
    setStatus('all');
    setSessionId('');
  };
  const sessionLabel = (sid: string) => {
    const found = sessions.list.find(s => s.id === sid);
    return found ? sessions.label(found) : sid;
  };
  const statusOptions = [
    {value: 'all', label: t('bk.allStatuses')},
    ...STATUSES.map(s => ({value: s, label: t(`bstatus.${s}`)})),
  ];
  const sessionOptions = [
    {value: '', label: t('bk.allSessions')},
    ...sessions.list.map(s => ({value: s.id, label: sessions.label(s)})),
  ];
  const chips: {key: string; text: string; remove: () => void}[] = [
    ...(status !== 'all'
      ? [{key: 'status', text: `${t('bk.status')}: ${t(`bstatus.${status}`)}`, remove: () => setStatus('all')}]
      : []),
    ...(sessionId
      ? [{key: 'session', text: `${t('bk.session')}: ${sessionLabel(sessionId)}`, remove: () => setSessionId('')}]
      : []),
  ];

  return (
    <Page>
      <PageHeader
        title={t('nav.bookings')}
        primary={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            {t('bk.new')}
          </Button>
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex flex-wrap items-end gap-3 lg:flex-nowrap">
            <TextField
              id={`${ids}-q`}
              label={t('bk.search')}
              value={search}
              onChange={setSearch}
              inputMode="search"
              type="search"
              className="min-w-0 flex-1 basis-48"
            />
            <Button variant="secondary" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal aria-hidden="true" />
              {t('bk.filters')}
              {active ? (
                <>
                  <span
                    aria-hidden="true"
                    className={cn('inline-flex min-w-5 justify-center rounded-full bg-ink px-1.5 text-white', numbers)}
                  >
                    {active}
                  </span>
                  <span className="sr-only">{t('bk.filtersOn', {count: active})}</span>
                </>
              ) : null}
            </Button>
            <SelectField
              id={`${ids}-status`}
              label={t('bk.status')}
              value={status}
              onChange={setStatus}
              options={statusOptions}
              className="hidden shrink-0 lg:flex lg:w-48"
            />
            <SelectField
              id={`${ids}-session`}
              label={t('bk.session')}
              value={sessionId}
              onChange={setSessionId}
              options={sessionOptions}
              className="hidden shrink-0 lg:flex lg:w-72"
            />
          </div>
          {chips.length ? (
            <ul className="flex flex-wrap gap-2 lg:hidden">
              {chips.map(chip => (
                <li key={chip.key} className="max-w-full">
                  <button
                    type="button"
                    onClick={chip.remove}
                    aria-label={t('bk.removeFilter', {name: chip.text})}
                    className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-stone-500 bg-surface px-3 text-left text-sm leading-5 text-ink hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="min-w-0 break-words">{chip.text}</span>
                    <X className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <QueryView query={result} onRetry={() => void reload()}>
          {({bookings}) =>
            bookings.length ? (
              <div>
                <BookingColumns showSession />
                <BookingRows bookings={bookings} showSession columns />
              </div>
            ) : (
              <Empty
                flush
                action={
                  active || search ? (
                    <Button
                      variant="ghost"
                      className="-ml-3"
                      onClick={() => {
                        clear();
                        setSearch('');
                      }}
                    >
                      {t('bk.clearFilters')}
                    </Button>
                  ) : null
                }
              >
                {t('bk.empty')}
              </Empty>
            )
          }
        </QueryView>
      </Panel>

      <Dialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        kind="sheet"
        title={t('bk.filters')}
        closeLabel={t('staff.close')}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={clear}>
              {t('bk.clearFilters')}
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              {t('bk.showResults')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            id={`${ids}-status-sheet`}
            label={t('bk.status')}
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
          <SelectField
            id={`${ids}-session-sheet`}
            label={t('bk.session')}
            value={sessionId}
            onChange={setSessionId}
            options={sessionOptions}
          />
        </div>
      </Dialog>

      <ManualEntrySheet
        open={Boolean(entry) || creating}
        onOpenChange={next => {
          if (next) return;
          if (entry) navigate('/equipo/reservaciones/');
          setCreating(false);
        }}
        sessionId={entry ? entry.sessionId : sessionId || null}
      />
    </Page>
  );
}

// ------------------------------------------------------------------ manual entry (a sheet)

type Source = 'instagram_dm' | 'phone' | 'in_person' | 'other';
const blankEntry = (sessionId: string | null) => ({
  sessionId: sessionId ?? '',
  partySize: '2',
  leadName: '',
  contactKind: 'phone' as 'phone' | 'email',
  contactValue: '',
  note: '',
  source: 'instagram_dm' as Source,
});

/**
 * "Entrar solicitud a mano": for requests that arrive by Instagram, phone or in person. Saved as
 * a request. `locked` shows the session as text (opened from that session's page).
 */
export function ManualEntrySheet({
  open,
  onOpenChange,
  sessionId,
  locked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  locked?: boolean;
}) {
  const {t} = useStaffT();
  const ids = useId();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const sessions = useSessionOptions(open);
  const [notice, setNotice] = useState<Notice>(null);
  const [form, setForm] = useState(() => blankEntry(sessionId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  useOnOpen(open, () => {
    setForm(blankEntry(sessionId));
    setErrors({});
    setNotice(null);
  });
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const name = useDebounced(form.leadName.trim().toLowerCase(), 400);
  const contact = useDebounced(form.contactValue.trim().toLowerCase(), 400);
  const dupPath =
    open && form.sessionId && (name.length > 1 || contact.length > 2)
      ? `/api/equipo/bookings/duplicates?${new URLSearchParams({session: form.sessionId, name, contact})}`
      : null;
  const duplicates = useQuery<{duplicates: StaffBookingRow[]}>(dupPath);
  const found = dupPath && duplicates.query.state === 'ready' ? duplicates.query.data.duplicates : [];
  const lockedSession = sessions.list.find(s => s.id === form.sessionId);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problems: Record<string, string> = {};
    const size = intOrNull(form.partySize);
    if (!form.sessionId) problems.sessionId = t('bk.pickSession');
    if (!size || Number.isNaN(size) || size > 60) problems.partySize = t('ses.invalidNumber');
    if (form.leadName.trim().length < 2) problems.leadName = t('error.name');
    const value = form.contactValue.trim();
    if (form.contactKind === 'phone' ? !PHONE.test(value) : !EMAIL.test(value)) {
      problems.contactValue = form.contactKind === 'phone' ? t('error.phone') : t('error.email');
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
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
    if (id) {
      onOpenChange(false);
      navigate(`/equipo/reservaciones/${id}/`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="sheet"
      size="wide"
      title={t('bk.new')}
      description={t('bk.newHelp')}
      closeLabel={t('staff.close')}
      footer={
        <div>
          <NoticeLine notice={notice} className="mb-3" />
          <FormFooter formId={formId} label={t('bk.saveInquiry')} busy={busy} onCancel={() => onOpenChange(false)} />
        </div>
      }
    >
      <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
        {locked ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-5 text-ink">{t('bk.session')}</p>
            <p className="text-base leading-6 text-ink">
              {lockedSession ? sessions.label(lockedSession) : form.sessionId}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
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
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-4">
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
        </div>
        <TextField
          id={`${ids}-name`}
          label={t('bk.lead')}
          value={form.leadName}
          onChange={value => set({leadName: value})}
          error={errors.leadName}
          maxLength={80}
        />
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
        {found.length ? (
          <Callout role="status">
            <p className="font-semibold">{t('bk.duplicates')}</p>
            <ul className="flex flex-col gap-1">
              {found.map(d => (
                <li key={d.id}>
                  <Link to={`/equipo/reservaciones/${d.id}/`} className={buttonVariants({variant: 'link'})}>
                    {d.reference} · {d.lead_name} · {t(`bstatus.${d.status}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------ one booking

type BookingDialog = 'resize' | 'move' | 'propose' | 'edit' | 'reissue' | 'cancel' | 'reply' | 'payment';

export function BookingPage({id}: {id: string}) {
  const {t, lang} = useStaffT();
  const me = useMe();
  const ids = useId();
  const outcome = useOutcome();
  const refreshCounts = useRefreshCounts();
  const {run, busy} = useWrite();
  const {query, reload} = useQuery<BookingData>(`/api/equipo/bookings/${id}`);
  const sessions = useSessionOptions();
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<BookingDialog | null>(null);
  const [size, setSize] = useState('');
  const [destination, setDestination] = useState('');
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // A reissue whose answer was lost is retried with the same token (and so the same intent).
  const pendingToken = useRef<string | null>(null);

  const openDialog = (next: BookingDialog) => {
    setDestination('');
    setSize('');
    setDialog(next);
  };
  const dialogProps = (name: BookingDialog) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

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
          refreshCounts();
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
          if (result.kind === 'ok') {
            setCopied(null);
            setFreshLink(`${location.origin}/reservacion/${token}/`);
          }
          void reload(true);
        };

        const copyLink = async (text: string) => {
          setCopied((await copyText(text)) ? 'link' : 'fail:link');
        };

        const when =
          session?.starts_at != null
            ? `${formatLongDate(session.starts_at, lang)}, ${formatTime(session.starts_at, lang)}`
            : t('staff.dateTbd');
        const replyText = () => {
          const text = t(`reply.${status}`, {name: b.lead_name, reference: b.reference, when, people});
          return freshLink ? `${text} ${t('reply.link', {url: freshLink})}` : text;
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
        const openRequests = data.requests.filter(r => r.status === 'open');
        const doneRequests = data.requests.filter(r => r.status !== 'open');

        const summary: [string, ReactNode][] = [
          [
            t('bk.contact'),
            <span className="flex flex-col items-start gap-2">
              <span className="break-all">
                {t(b.contact_kind === 'phone' ? 'bk.phone' : 'bk.email')}: {b.contact_value}
              </span>
              <Button variant="secondary" onClick={() => openDialog('reply')}>
                <Pencil aria-hidden="true" />
                {t('bk.buildReply')}
              </Button>
            </span>,
          ],
        ];
        if (b.note) summary.push([t('bk.note'), <span className="whitespace-pre-line">{b.note}</span>]);
        summary.push([t('bk.source'), t(`source.${b.source}`)]);
        if (b.checked_in_at)
          summary.push([t('ton.arrived'), t('bk.checkedIn', {time: formatTime(b.checked_in_at, lang)})]);

        // The status's next step stays visible; one primary at most.
        const checkIn = status === 'confirmed' && today && !b.checked_in_at;
        const undoCheckIn = status === 'confirmed' && today && Boolean(b.checked_in_at);
        const complete = status === 'confirmed' && started;

        const more: MenuAction[] = [
          ...(status === 'confirmed'
            ? [{key: 'resize', label: t('bk.resize'), icon: Users, onSelect: () => openDialog('resize')}]
            : []),
          ...(status === 'confirmed' || status === 'inquiry' || status === 'pending_payment'
            ? [{key: 'move', label: t('bk.move'), icon: ArrowRightLeft, onSelect: () => openDialog('move')}]
            : []),
          ...(ACTIVE.includes(status)
            ? [{key: 'propose', label: t('bk.propose'), icon: Send, onSelect: () => openDialog('propose')}]
            : []),
          ...(status === 'inquiry' || status === 'pending_payment'
            ? [{key: 'edit', label: t('bk.edit'), icon: Pencil, onSelect: () => openDialog('edit')}]
            : []),
          {key: 'reissue', label: t('bk.reissue'), icon: Link2, onSelect: () => openDialog('reissue')},
          ...(complete
            ? [
                {
                  key: 'noShow',
                  label: t('bk.noShow'),
                  icon: UserX,
                  disabled: busy,
                  onSelect: () => void act({action: 'no_show'}, t('bk.done')),
                },
              ]
            : []),
          ...(ACTIVE.includes(status)
            ? [
                {
                  key: 'cancel',
                  label: t('bk.cancel'),
                  icon: CircleX,
                  destructive: true,
                  onSelect: () => openDialog('cancel'),
                },
              ]
            : []),
        ];

        return (
          <Page>
            <PageHeader
              back={
                <Link to="/equipo/reservaciones/" className={buttonVariants({variant: 'ghost'})}>
                  <ChevronLeft aria-hidden="true" />
                  {t('bk.back')}
                </Link>
              }
              title={b.lead_name}
              meta={
                <>
                  <Demo synthetic={b.synthetic} />
                  <BookingStatus status={status} />
                  {b.exception_reason ? (
                    <Pill strong>{t('bk.exceptionReason', {reason: t(`reason.${b.exception_reason}`)})}</Pill>
                  ) : null}
                  <span className={cn('text-sm leading-5 text-ink', numbers)}>{b.reference}</span>
                  <span className={cn('text-sm leading-5 text-ink', numbers)}>{people}</span>
                  {session ? (
                    <span className="text-sm leading-5 text-ink">
                      <Link to={`/equipo/sesiones/${session.id}/`} className={buttonVariants({variant: 'link'})}>
                        {session.title_es}
                      </Link>
                      {' · '}
                      <span className={numbers}>
                        {session.starts_at === null
                          ? t('staff.dateTbd')
                          : `${formatShortDate(session.starts_at, lang)}, ${formatTime(session.starts_at, lang)}`}
                      </span>
                    </span>
                  ) : null}
                </>
              }
              actions={
                <>
                  {status === 'inquiry' || status === 'pending_payment' ? (
                    <Confirm
                      variant="primary"
                      className="w-full sm:w-auto"
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
                        className="w-full sm:w-auto"
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
                        busy={busy}
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
                  {checkIn ? (
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      disabled={busy}
                      onClick={() => void act({action: 'check_in'}, t('bk.done'))}
                    >
                      {t('bk.checkIn')}
                    </Button>
                  ) : null}
                  {undoCheckIn ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void act({action: 'undo_check_in'}, t('bk.done'))}
                    >
                      {t('bk.undoCheckIn')}
                    </Button>
                  ) : null}
                  {complete ? (
                    <Button
                      variant={checkIn ? 'secondary' : 'primary'}
                      disabled={busy}
                      onClick={() => void act({action: 'fulfilled'}, t('bk.done'))}
                    >
                      {t('bk.fulfilled')}
                    </Button>
                  ) : null}
                  <Menu label={t('staff.more')} actions={more} />
                </>
              }
            />
            <NoticeLine notice={notice} />

            {openRequests.length || freshLink ? (
              <div className="mb-6 flex flex-col gap-3">
                {openRequests.map(r => (
                  <Callout key={r.id} icon={r.kind === 'cancel' ? CircleX : ArrowLeftRight}>
                    <p className="font-semibold">
                      {t('bk.openRequest', {kind: t(`req.kind.${r.kind}`), date: formatShortDate(r.created_at, lang)})}
                    </p>
                    {r.details ? <p className="whitespace-pre-line break-words">{r.details}</p> : null}
                    <Button
                      variant="secondary"
                      className="self-start"
                      disabled={busy}
                      onClick={async () => {
                        const result = await run(`/api/equipo/requests/${r.id}/resolve`, {});
                        setNotice(outcome(result, t('req.resolved')));
                        void reload(true);
                        refreshCounts();
                      }}
                    >
                      {t('bk.resolve')}
                    </Button>
                  </Callout>
                ))}
                {freshLink ? (
                  <Callout icon={Link2}>
                    <p className="font-medium">{t('bk.reissueDone')}</p>
                    <p className="break-all rounded-2xl border border-stone-300 bg-stone-50 p-3 font-mono">
                      {freshLink}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="secondary" onClick={() => void copyLink(freshLink)}>
                        <Copy aria-hidden="true" />
                        {t('bk.copy')}
                      </Button>
                      <span role="status" className={helper}>
                        {copied === 'link' ? t('bk.copied') : copied === 'fail:link' ? t('bk.copyFailed') : ''}
                      </span>
                    </div>
                  </Callout>
                ) : null}
              </div>
            ) : null}

            <div className={cn(workspace, 'items-start')}>
              <div className="flex min-w-0 flex-col gap-6">
                <Panel title={t('bk.summary')}>
                  <Facts items={summary} />
                  <div className="flex flex-col gap-1">
                    <p className={helper}>{t('bk.created', {date: formatLongDate(b.created_at, lang)})}</p>
                    {!b.has_link ? <p className={helper}>{t('bk.noLink')}</p> : null}
                  </div>
                </Panel>
                <Payments
                  data={data}
                  open={dialog === 'payment'}
                  onOpenChange={open => setDialog(open ? 'payment' : null)}
                  onRecorded={next => {
                    setNotice(next);
                    void reload(true);
                    refreshCounts();
                  }}
                  seatsLeft={seatsLeft}
                  refundCalc={refundCalc}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                <Panel title={t('bk.locked')}>
                  {b.accepted_at ? (
                    <div className="flex flex-col gap-2 text-sm leading-5 text-ink">
                      <p>{data.lockedPolicy?.title}</p>
                      {lockedPrice ? <p className={numbers}>{t('bk.lockedPrice', {price: lockedPrice})}</p> : null}
                      <p className={helper}>{t('bk.acceptedOn', {date: formatLongDate(b.accepted_at, lang)})}</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-5 text-ink">{t('bk.lockedNone')}</p>
                  )}
                </Panel>
                {data.proposals.length ? (
                  <Panel title={t('bk.proposals')}>
                    <ul className="flex flex-col gap-2 text-sm leading-5 text-ink">
                      {data.proposals.map(p => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className={numbers}>
                            {sessionTitle(p.session_id)} · {formatShortDate(p.created_at, lang)}
                          </span>
                          <Pill strong={p.status === 'open'}>{t(`bk.proposal.${p.status}`)}</Pill>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : null}
                {doneRequests.length ? (
                  <Panel title={t('bk.requests')}>
                    <ul className="flex flex-col gap-3 text-sm leading-5 text-ink">
                      {doneRequests.map(r => (
                        <li key={r.id} className="flex flex-col gap-1">
                          <p className="font-semibold">
                            {t(`req.kind.${r.kind}`)} · {formatShortDate(r.created_at, lang)}
                          </p>
                          {r.details ? <p className="break-words">{r.details}</p> : null}
                          <span className="self-start">
                            <Pill>{t('req.resolved')}</Pill>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : null}
                <Panel>
                  <Disclosure summary={t('bk.historyCount', {count: data.audit.length})}>
                    {data.audit.length ? (
                      <ul className={rows}>
                        {data.audit.map(event => (
                          <AuditRow
                            key={event.mutation_id}
                            event={event}
                            showRecord={false}
                            withDate
                            className="px-0 sm:px-0"
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-5 text-ink">{t('hist.empty')}</p>
                    )}
                  </Disclosure>
                </Panel>
              </div>
            </div>

            <InputDialog
              {...dialogProps('resize')}
              label={t('bk.resize')}
              busy={busy}
              // Only a new size can be sent: an unchanged one would record a change that didn't happen.
              canSend={Boolean(intOrNull(size)) && intOrNull(size) !== b.party_size}
              onSend={() => act({action: 'resize', partySize: intOrNull(size)}, t('bk.done'))}
            >
              <TextField
                id={`${ids}-size`}
                label={t('bk.party')}
                inputMode="numeric"
                value={size || String(b.party_size)}
                onChange={setSize}
              />
            </InputDialog>
            <InputDialog
              {...dialogProps('move')}
              label={t('bk.move')}
              busy={busy}
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
            </InputDialog>
            <InputDialog
              {...dialogProps('propose')}
              label={t('bk.propose')}
              description={t('bk.proposeHelp')}
              busy={busy}
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
            </InputDialog>
            <EditBooking {...dialogProps('edit')} booking={b} onSent={act} busy={busy} />
            <ConfirmDialog
              {...dialogProps('reissue')}
              title={t('bk.reissue')}
              body={t('bk.reissueBody')}
              confirmLabel={t('bk.reissue')}
              onConfirm={reissue}
            />
            <ConfirmDialog
              {...dialogProps('cancel')}
              title={t('bk.cancel')}
              body={t('bk.cancelBody')}
              confirmLabel={t('bk.cancel')}
              onConfirm={() => act({action: 'cancel'}, t('bk.done'))}
            />
            <ReplyDialog {...dialogProps('reply')} text={replyText()} />
          </Page>
        );
      }}
    </QueryView>
  );
}

/** "Respuesta para el cliente": a draft built from the real status, to copy and review. */
function ReplyDialog({open, onOpenChange, text}: {open: boolean; onOpenChange: (open: boolean) => void; text: string}) {
  const {t} = useStaffT();
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) setCopied(null);
        onOpenChange(next);
      }}
      title={t('bk.replyTitle')}
      description={t('bk.replyHelp')}
      closeLabel={t('staff.close')}
    >
      <div className="flex flex-col gap-3">
        <textarea
          readOnly
          value={text}
          aria-label={t('bk.replyTitle')}
          className="block min-h-32 w-full rounded-2xl border border-stone-500 bg-surface p-3 text-base leading-6 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={async () => setCopied((await copyText(text)) ? 'ok' : 'fail')}>
            <Copy aria-hidden="true" />
            {t('bk.copy')}
          </Button>
          <span role="status" className={helper}>
            {copied === 'ok' ? t('bk.copied') : copied === 'fail' ? t('bk.copyFailed') : ''}
          </span>
        </div>
      </div>
    </Dialog>
  );
}

function EditBooking({
  open,
  onOpenChange,
  booking,
  onSent,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: StaffBookingRow;
  onSent: (body: Record<string, unknown>, ok: string) => Promise<boolean>;
  busy: boolean;
}) {
  const {t} = useStaffT();
  const ids = useId();
  const initial = () => ({
    partySize: String(booking.party_size),
    leadName: booking.lead_name,
    contactKind: booking.contact_kind,
    contactValue: booking.contact_value,
    note: booking.note ?? '',
  });
  const [form, setForm] = useState(initial);
  useOnOpen(open, () => setForm(initial()));
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const size = intOrNull(form.partySize);
  const valid =
    Boolean(size) &&
    !Number.isNaN(size) &&
    form.leadName.trim().length >= 2 &&
    (form.contactKind === 'phone' ? PHONE.test(form.contactValue.trim()) : EMAIL.test(form.contactValue.trim()));
  return (
    <InputDialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('bk.edit')}
      busy={busy}
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
        counter
      />
    </InputDialog>
  );
}

/**
 * Pagos y reembolsos: the net received, a calculated refund (never shown as issued) and the
 * ledger stay on the page; "Registrar movimiento" opens the form in a dialog.
 */
function Payments({
  data,
  open,
  onOpenChange,
  onRecorded,
  seatsLeft,
  refundCalc,
}: {
  data: BookingData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: (notice: Notice) => void;
  seatsLeft: number | null;
  refundCalc: number | null;
}) {
  const {t, lang} = useStaffT();
  const me = useMe();
  const ids = useId();
  const formId = useId();
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
  const [problem, setProblem] = useState<Notice>(null);
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
    if (result.kind !== 'ok') {
      // The dialog stays open, with what failed and why next to its button.
      setProblem(outcome(result, ''));
      return;
    }
    const after = result.data.outcome as {status?: string} | null;
    setProblem(null);
    setAmount('');
    setReference('');
    setNote('');
    setReverses('');
    onOpenChange(false);
    onRecorded(
      after?.status === 'exception' && b.status !== 'exception'
        ? {tone: 'problem', text: t('bk.toException')}
        : {tone: 'ok', text: t('bk.recorded')},
    );
  };

  return (
    <Panel
      flush
      title={t('bk.payments')}
      actions={
        <Button variant="secondary" onClick={() => onOpenChange(true)}>
          <Plus aria-hidden="true" />
          {t('bk.record')}
        </Button>
      }
    >
      <div className="flex flex-col gap-1 px-4 sm:px-6">
        <p className={cn('text-base font-semibold leading-6 text-ink', numbers)}>
          {t('bk.net', {amount: formatMoney(b.net, 'USD', lang)})}
        </p>
        {refundCalc !== null ? (
          <p className={cn('text-sm leading-5 text-ink', numbers)}>
            {t('bk.calcRefund', {amount: formatMoney(refundCalc, 'USD', lang)})}
          </p>
        ) : null}
      </div>
      {data.payments.length ? (
        <ul className={flushList}>
          {data.payments.map(p => (
            <li key={p.id} className={cn(rowItem, 'flex flex-col gap-0.5 text-sm leading-5 text-ink')}>
              <p className={cn('font-medium', numbers)}>
                {t(`kind.${p.kind}`)}: {formatMoney(p.amount_cents, p.currency, lang)} · {t(`method.${p.method}`)}
                {p.external_reference ? ` · ${p.external_reference}` : ''}
              </p>
              <p className={cn(helper, numbers)}>
                {t('bk.payBy', {who: p.recorded_by, date: formatShortDate(p.recorded_at, lang)})}
              </p>
              {p.note ? <p className={helper}>{p.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty flush>{t('bk.noPayments')}</Empty>
      )}

      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next) {
            setProblem(null);
            setError(null);
          }
          onOpenChange(next);
        }}
        title={t('bk.record')}
        closeLabel={t('staff.close')}
        footer={
          <div>
            <NoticeLine notice={problem} className="mb-3" />
            <FormFooter
              formId={formId}
              label={t('bk.record')}
              busy={busy}
              disabled={kind === 'reversal' && !reverses}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        }
      >
        <form id={formId} onSubmit={record} noValidate className="flex flex-col gap-4">
          {shortOfSeats && kind === 'payment' ? (
            <Callout role="status">
              <p className="font-medium">{t('bk.seatsWarning')}</p>
            </Callout>
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
              <SelectField
                id={`${ids}-method`}
                label={t('bk.method')}
                value={method}
                onChange={setMethod}
                options={methods.map(m => ({value: m, label: t(`method.${m}`)}))}
              />
            )}
          </div>
          {kind === 'reversal' ? null : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          )}
          <TextField id={`${ids}-note`} label={t('bk.payNote')} value={note} onChange={setNote} maxLength={280} />
        </form>
      </Dialog>
    </Panel>
  );
}
