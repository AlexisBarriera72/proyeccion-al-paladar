// Staff queues: Excepciones, guest requests, tonight's check-in list and the audit history.
import {useEffect, useId, useRef, useState} from 'react';
import {motion} from 'motion/react';
import {ArrowLeftRight, CalendarX, CircleCheck, CircleX, Inbox, MessageSquareText, RotateCw} from 'lucide-react';
import {formatLongDate, formatShortDate, formatTime, prDateKey} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {helper, numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {Switch} from '../components/ui/tabs.tsx';
import {useQuery, useWrite} from './api.ts';
import {
  BookingStatus,
  Callout,
  Confirm,
  Demo,
  Empty,
  InputAction,
  Meter,
  NoticeLine,
  Page,
  PageHeader,
  Panel,
  QueryView,
  SelectField,
  StatusPill,
  When,
  flushList,
  rowItem,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {SessionPicker, useSessionOptions} from './rows.tsx';
import {AuditRow, historyType, type HistoryType} from './history.tsx';
import {useMe, useRefreshCounts} from './me.ts';
import type {AuditEvent, Catalog, StaffBookingRow} from './types.ts';

// ------------------------------------------------------------------ Excepciones

type Resolve = {action: 'resolve_same' | 'cancel'} | {action: 'resolve_other'; destination: string};

function ExceptionRow({
  booking,
  busy,
  onAct,
}: {
  booking: StaffBookingRow;
  busy: boolean;
  onAct: (booking: StaffBookingRow, body: Resolve) => Promise<boolean | Notice>;
}) {
  const {t, lang} = useStaffT();
  const ids = useId();
  const [destination, setDestination] = useState('');
  return (
    <li className={cn(rowItem, 'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between')}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/equipo/reservaciones/${booking.id}/`} className={buttonVariants({variant: 'link'})}>
            {booking.lead_name} · {booking.reference}
          </Link>
          <Demo synthetic={booking.synthetic} />
        </div>
        <p className={cn(helper, numbers)}>
          {booking.title_es} · <When ms={booking.starts_at ?? null} /> ·{' '}
          {booking.party_size === 1 ? t('bk.person') : t('bk.people', {count: booking.party_size})}
        </p>
        <p className={cn('flex flex-wrap gap-x-3 text-sm leading-5 text-ink', numbers)}>
          <span>{t('bk.net', {amount: formatMoney(booking.net, 'USD', lang)})}</span>
          {booking.exception_reason ? (
            <span>{t('bk.exceptionReason', {reason: t(`reason.${booking.exception_reason}`)})}</span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0 lg:justify-end">
        <Confirm
          variant="primary"
          trigger={t('exc.same')}
          title={t('exc.same')}
          body={t('bk.confirmBody')}
          confirmLabel={t('exc.same')}
          disabled={busy}
          onConfirm={() => onAct(booking, {action: 'resolve_same'})}
        />
        <InputAction
          label={t('exc.other')}
          disabled={busy}
          busy={busy}
          canSend={Boolean(destination)}
          onSend={() => onAct(booking, {action: 'resolve_other', destination})}
        >
          <SessionPicker
            id={`${ids}-destination`}
            label={t('bk.destination')}
            value={destination}
            onChange={setDestination}
            exclude={booking.session_id}
          />
          <p className={helper}>{t('bk.confirmBody')}</p>
        </InputAction>
        <Confirm
          trigger={t('exc.cancel')}
          title={t('bk.cancel')}
          body={t('bk.cancelBody')}
          confirmLabel={t('bk.cancel')}
          disabled={busy}
          onConfirm={() => onAct(booking, {action: 'cancel'})}
        />
      </div>
    </li>
  );
}

export function Exceptions() {
  const {t} = useStaffT();
  const outcome = useOutcome();
  const refreshCounts = useRefreshCounts();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<{exceptions: StaffBookingRow[]}>('/api/equipo/exceptions');
  const catalog = useQuery<Catalog>('/api/equipo/catalog');
  const setting = (key: string) =>
    catalog.query.state === 'ready' ? catalog.query.data.settings.find(s => s.key === key)?.value : undefined;
  const approved = setting('exception_process_approved') === '1';
  const processText = setting('exception_process_text');

  const act = async (booking: StaffBookingRow, body: Resolve) => {
    const result = await run(`/api/equipo/bookings/${booking.id}/actions`, {
      ...body,
      expectedVersion: booking.version,
    });
    const next = outcome(result, t('bk.done'));
    const shown: Notice =
      result.kind === 'ok' || body.action === 'cancel'
        ? next
        : {tone: 'problem', text: `${next?.text ?? ''} ${t('exc.failKept')}`};
    setNotice(shown);
    void reload(true);
    refreshCounts();
    // A refusal is also shown inside the dialog that asked, next to its buttons.
    return result.kind === 'ok' || (result.kind === 'error' && result.code === 'version_conflict') ? true : shown;
  };

  return (
    <Page>
      <PageHeader title={t('exc.title')} help={t('exc.help')} />
      {/* Nothing while loading. If the settings can't be read, the page says so rather than
          calling the process unapproved; the server still refuses a resolution without it. */}
      {catalog.query.state === 'error' ? (
        <Callout role="alert" className="mb-6">
          <p className="font-medium">{t('exc.processLoadError')}</p>
          <Button variant="secondary" className="self-start" onClick={() => void catalog.reload()}>
            <RotateCw aria-hidden="true" />
            {t('app.retry')}
          </Button>
        </Callout>
      ) : catalog.query.state === 'ready' ? (
        approved && processText ? (
          <Disclosure summary={t('exc.showProcess')} className="mb-6">
            <p className="whitespace-pre-line rounded-2xl border border-stone-300 bg-surface p-4 text-base leading-6 text-ink">
              {processText}
            </p>
          </Disclosure>
        ) : (
          <Callout className="mb-6">
            <p className="font-medium">{t('exc.processMissing')}</p>
            <Link
              to="/equipo/configuracion/?tab=reglas"
              className={cn(buttonVariants({variant: 'link'}), 'min-h-11 self-start')}
            >
              {t('exc.processLink')}
            </Link>
          </Callout>
        )
      ) : null}
      <NoticeLine notice={notice} />
      <QueryView query={query} onRetry={() => void reload()}>
        {({exceptions}) => (
          <Panel flush title={t('exc.pendingCount', {count: exceptions.length})}>
            {exceptions.length ? (
              <ul className={flushList}>
                {exceptions.map(booking => (
                  <ExceptionRow key={booking.id} booking={booking} busy={busy} onAct={act} />
                ))}
              </ul>
            ) : (
              <Empty flush icon={CircleCheck}>
                {t('exc.empty')}
              </Empty>
            )}
          </Panel>
        )}
      </QueryView>
    </Page>
  );
}

// ------------------------------------------------------------------ Pedidos

interface GuestRequest {
  id: string;
  booking_id: string;
  kind: 'cancel' | 'change';
  details: string | null;
  created_at: number;
  reference: string;
  lead_name: string;
  booking_status: string;
}

/** Long details stay clamped to two lines until "Ver todo". */
function Details({text}: {text: string}) {
  const {t} = useStaffT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const long = text.length > 140 || text.split('\n').length > 2;
  return (
    <div className="flex flex-col items-start">
      <p
        id={id}
        className={cn('whitespace-pre-line break-words text-base leading-6 text-ink', long && !open && 'line-clamp-2')}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(value => !value)}
          className="inline-flex min-h-11 items-center text-sm font-medium leading-5 text-accent underline underline-offset-4 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {open ? t('req.showLess') : t('req.showAll')}
        </button>
      ) : null}
    </div>
  );
}

export function Requests() {
  const {t, lang} = useStaffT();
  const outcome = useOutcome();
  const refreshCounts = useRefreshCounts();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<{requests: GuestRequest[]}>('/api/equipo/requests');
  return (
    <Page>
      <PageHeader title={t('req.title')} />
      <NoticeLine notice={notice} />
      <QueryView query={query} onRetry={() => void reload()}>
        {({requests}) => (
          <Panel flush title={t('req.openCount', {count: requests.length})}>
            {requests.length ? (
              <ul className={flushList}>
                {requests.map(r => (
                  <li
                    key={r.id}
                    className={cn(rowItem, 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between')}
                  >
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill icon={r.kind === 'cancel' ? CircleX : ArrowLeftRight} tone="normal">
                          {t(`req.kind.${r.kind}`)}
                        </StatusPill>
                        <Link
                          to={`/equipo/reservaciones/${r.booking_id}/`}
                          className={buttonVariants({variant: 'link'})}
                        >
                          {r.lead_name} · {r.reference}
                        </Link>
                        <BookingStatus status={r.booking_status} />
                      </div>
                      {r.details ? <Details text={r.details} /> : null}
                      <p className={cn(helper, numbers)}>
                        {formatShortDate(r.created_at, lang)} {formatTime(r.created_at, lang)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto sm:shrink-0"
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
                  </li>
                ))}
              </ul>
            ) : (
              <Empty flush icon={Inbox}>
                {t('req.empty')}
              </Empty>
            )}
          </Panel>
        )}
      </QueryView>
    </Page>
  );
}

// ------------------------------------------------------------------ Esta noche

type Arrivals = 'waiting' | 'arrived' | 'all';

export function Tonight() {
  const {t, lang} = useStaffT();
  const me = useMe();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const [filter, setFilter] = useState<Arrivals>('waiting');
  const {query, reload} = useQuery<{bookings: StaffBookingRow[]; dayStart: number}>('/api/equipo/tonight');

  // A check-in can take its row out of the list ("Por llegar"), so focus moves on to the next
  // guest's button, or the previous one, or the summary line, instead of falling to the page.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const order = useRef<string[]>([]);
  const summary = useRef<HTMLParagraphElement>(null);
  const pendingFocus = useRef<string[] | null>(null);
  useEffect(() => {
    const candidates = pendingFocus.current;
    if (!candidates || busy) return;
    pendingFocus.current = null;
    const target = candidates.map(id => buttons.current.get(id)).find(button => button?.isConnected);
    (target ?? summary.current)?.focus();
  });
  const buttonRef = (id: string) => (button: HTMLButtonElement | null) => {
    if (button) buttons.current.set(id, button);
    else buttons.current.delete(id);
  };

  const toggle = async (b: StaffBookingRow) => {
    const at = order.current.indexOf(b.id);
    const after = order.current.slice(at + 1);
    const before = order.current.slice(0, Math.max(0, at)).reverse();
    // In "Todas" the row stays, with its other button; elsewhere it leaves the list.
    pendingFocus.current = filter === 'all' ? [b.id, ...after, ...before] : [...after, ...before];
    const result = await run(`/api/equipo/bookings/${b.id}/actions`, {
      action: b.checked_in_at ? 'undo_check_in' : 'check_in',
      expectedVersion: b.version,
    });
    setNotice(outcome(result, t('bk.done')));
    void reload(true);
  };

  return (
    <Page className="max-w-2xl">
      <PageHeader
        title={t('ton.title')}
        help={<span className="block first-letter:uppercase">{formatLongDate(me.now, lang)}</span>}
      />
      <NoticeLine notice={notice} />
      <QueryView query={query} onRetry={() => void reload()}>
        {({bookings}) => {
          if (!bookings.length) {
            return (
              <Panel>
                <Empty
                  icon={CalendarX}
                  action={
                    <Link to="/equipo/" className={buttonVariants({variant: 'secondary'})}>
                      {t('ton.viewCalendar')}
                    </Link>
                  }
                >
                  {t('ton.empty')}
                </Empty>
              </Panel>
            );
          }
          const counted = (list: StaffBookingRow[]) => list.reduce((sum, b) => sum + b.party_size, 0);
          const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'fulfilled');
          const total = counted(confirmed);
          const arrived = counted(confirmed.filter(b => b.checked_in_at));
          const waiting = bookings.filter(b => b.status === 'confirmed' && !b.checked_in_at);
          const came = bookings.filter(b => Boolean(b.checked_in_at));
          const shown = filter === 'waiting' ? waiting : filter === 'arrived' ? came : bookings;
          const groups = new Map<string, StaffBookingRow[]>();
          for (const b of shown) groups.set(b.session_id, [...(groups.get(b.session_id) ?? []), b]);
          order.current = [...groups.values()].flat().map(b => b.id);
          return (
            <div className="flex flex-col gap-6">
              <Panel>
                <div className="flex flex-col gap-3">
                  <p
                    ref={summary}
                    tabIndex={-1}
                    className={cn('text-base font-semibold leading-6 text-ink focus:outline-none', numbers)}
                    aria-live="polite"
                  >
                    {t('ton.summary', {arrived, total})}
                  </p>
                  <Meter value={arrived} max={total} className="w-full" />
                </div>
              </Panel>
              <div>
                <Switch
                  value={filter}
                  onChange={setFilter}
                  label={t('ton.view')}
                  options={[
                    {
                      value: 'waiting',
                      label: <span className={numbers}>{t('ton.waiting', {count: waiting.length})}</span>,
                    },
                    {
                      value: 'arrived',
                      label: <span className={numbers}>{t('ton.arrivedTab', {count: came.length})}</span>,
                    },
                    {value: 'all', label: t('ton.all')},
                  ]}
                />
              </div>
              {/* A filter change shows its groups at once (no replayed entry). */}
              <motion.div initial={false} animate="show" className="flex flex-col gap-6">
                {groups.size ? (
                  [...groups.values()].map(list => {
                    const first = list[0];
                    const all = bookings.filter(b => b.session_id === first.session_id);
                    const sessionConfirmed = all.filter(b => b.status === 'confirmed' || b.status === 'fulfilled');
                    return (
                      <Panel
                        key={first.session_id}
                        flush
                        title={
                          <span className={numbers}>
                            {first.starts_at ? `${formatTime(first.starts_at, lang)} · ` : ''}
                            {first.title_es}
                          </span>
                        }
                        actions={
                          <span className={cn(helper, numbers)}>
                            {t('ton.sessionArrived', {
                              arrived: counted(sessionConfirmed.filter(b => b.checked_in_at)),
                              total: counted(sessionConfirmed),
                            })}
                          </span>
                        }
                      >
                        <ul className={flushList}>
                          {list.map(b => (
                            <li
                              key={b.id}
                              className={cn(
                                rowItem,
                                // Phones stack the row, so the name, reference and note keep the width.
                                'flex min-h-16 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between',
                              )}
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    to={`/equipo/reservaciones/${b.id}/`}
                                    className="break-words text-base font-medium leading-6 text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                  >
                                    {b.lead_name}
                                  </Link>
                                  <Demo synthetic={b.synthetic} />
                                </div>
                                <p className={cn(helper, numbers)}>
                                  <span className="whitespace-nowrap">
                                    {b.party_size === 1 ? t('bk.person') : t('bk.people', {count: b.party_size})} ·
                                  </span>{' '}
                                  <span className="whitespace-nowrap">{b.reference}</span>
                                </p>
                                {b.note ? (
                                  <p className="flex items-start gap-1.5 text-sm leading-5 text-ink">
                                    <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    <span className="line-clamp-2 break-words">{b.note}</span>
                                  </p>
                                ) : null}
                              </div>
                              {b.status === 'confirmed' ? (
                                b.checked_in_at ? (
                                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                    <span
                                      className={cn(
                                        'inline-flex items-center gap-1.5 text-sm font-medium leading-5 text-ink',
                                        numbers,
                                      )}
                                    >
                                      <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                                      {t('bk.checkedIn', {time: formatTime(b.checked_in_at, lang)})}
                                    </span>
                                    <Button
                                      ref={buttonRef(b.id)}
                                      variant="secondary"
                                      className="w-full sm:w-auto"
                                      disabled={busy}
                                      onClick={() => void toggle(b)}
                                    >
                                      {t('bk.undoCheckIn')}
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    ref={buttonRef(b.id)}
                                    variant="primary"
                                    className="w-full sm:w-auto"
                                    disabled={busy}
                                    onClick={() => void toggle(b)}
                                  >
                                    {t('bk.checkIn')}
                                  </Button>
                                )
                              ) : (
                                <span className="self-start sm:self-auto">
                                  <BookingStatus status={b.status} />
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    );
                  })
                ) : (
                  <Panel>
                    <Empty>{t('ton.noneHere')}</Empty>
                  </Panel>
                )}
              </motion.div>
            </div>
          );
        }}
      </QueryView>
    </Page>
  );
}

// ------------------------------------------------------------------ Historial

type TypeFilter = 'all' | HistoryType;
const TYPES: [TypeFilter, string][] = [
  ['all', 'hist.type.all'],
  ['bookings', 'hist.type.bookings'],
  ['sessions', 'hist.type.sessions'],
  ['payments', 'hist.type.payments'],
  ['settings', 'hist.type.settings'],
];

export function History() {
  const {t, lang} = useStaffT();
  const ids = useId();
  const [type, setType] = useState<TypeFilter>('all');
  const {query, reload} = useQuery<{events: AuditEvent[]}>('/api/equipo/audit?limit=200');
  // One session list for the page, so links read as a date and title rather than an id.
  const sessions = useSessionOptions();
  const sessionName = (id: string) => {
    const session = sessions.list.find(s => s.id === id);
    return session ? sessions.label(session) : undefined;
  };
  return (
    <Page>
      <PageHeader title={t('hist.title')} />
      <Panel flush>
        <div className="px-4 pt-4 sm:px-6 sm:pt-5">
          <SelectField
            id={`${ids}-type`}
            label={t('hist.type')}
            value={type}
            onChange={setType}
            className="max-w-xs"
            options={TYPES.map(([value, key]) => ({value, label: t(key)}))}
          />
        </div>
        <QueryView query={query} onRetry={() => void reload()}>
          {({events}) => {
            if (!events.length) return <Empty flush>{t('hist.empty')}</Empty>;
            const shown = type === 'all' ? events : events.filter(event => historyType(event) === type);
            if (!shown.length) return <Empty flush>{t('hist.noneOfType')}</Empty>;
            const days = new Map<string, AuditEvent[]>();
            for (const event of shown) {
              const key = prDateKey(event.at);
              days.set(key, [...(days.get(key) ?? []), event]);
            }
            return (
              <div className="flex flex-col gap-4">
                {[...days.entries()].map(([key, list]) => (
                  <div key={key}>
                    <h2 className="px-4 pb-2 text-sm font-semibold leading-5 text-muted first-letter:uppercase sm:px-6">
                      {formatLongDate(list[0].at, lang)}
                    </h2>
                    <ul className={flushList}>
                      {list.map(event => (
                        <AuditRow key={event.mutation_id} event={event} sessionName={sessionName} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          }}
        </QueryView>
      </Panel>
    </Page>
  );
}
