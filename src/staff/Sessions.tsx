// Staff: the calendar (month grid or list, with a preview panel on computers), the sessions list
// by status, and one session's page: its reservations, the publishing checklist driven by the
// server's own checks, read-only details, and the edit sheet. State changes and the CSV sit
// behind "Más acciones"; each still opens its confirmation.
import {useId, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Download,
  List,
  Pencil,
  Plus,
  Undo2,
} from 'lucide-react';
import {
  addMonths,
  formatLongDate,
  formatMonth,
  formatShortDate,
  formatTime,
  monthGrid,
  parsePrLocal,
  prDateKey,
  prDateParts,
  prMonthBounds,
  toPrLocalFields,
} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {Link, navigate} from '../lib/router.tsx';
import {useMediaQuery} from '../lib/media.ts';
import {SPRING} from '../lib/motion.ts';
import {readJson, writeJson} from '../lib/storage.ts';
import {helper, numbers, rows, sectionTitle, workspace} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {Menu, type MenuAction} from '../components/ui/menu.tsx';
import {Switch} from '../components/ui/tabs.tsx';
import {centsText, intOrNull, parseMoney, useQuery, useWrite} from './api.ts';
import {
  BookingStatus,
  CheckField,
  Chip,
  Confirm,
  ConfirmDialog,
  CountChips,
  Demo,
  Empty,
  Facts,
  FieldGroup,
  FormFooter,
  NoticeLine,
  Page,
  PageHeader,
  Panel,
  QueryView,
  SESSION_STATE,
  Seats,
  SelectField,
  SessionState,
  TextField,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {BookingColumns, BookingRows, SessionColumns, SessionRows} from './rows.tsx';
import {ManualEntrySheet} from './Bookings.tsx';
import {useMe} from './me.ts';
import type {Catalog, SessionData, StaffSession} from './types.ts';

export type {Catalog, StaffBookingRow, StaffSession} from './types.ts';

type View = 'grid' | 'list';
type Month = {year: number; month: number};

function NewSessionButton({onClick}: {onClick: () => void}) {
  const {t} = useStaffT();
  return (
    <Button variant="primary" onClick={onClick}>
      <Plus aria-hidden="true" />
      {t('ses.new')}
    </Button>
  );
}

// ------------------------------------------------------------------ calendar

/** Computers: the month as a table; each session is a compact button that fills the preview. */
function StaffMonthGrid({
  month,
  sessions,
  selectedId,
  todayKey,
  onSelect,
}: {
  month: Month;
  sessions: StaffSession[];
  selectedId: string | null;
  todayKey: string;
  onSelect: (session: StaffSession) => void;
}) {
  const {t, lang} = useStaffT();
  const weekdays = t('cal.weekdays').split(',');
  const byDay = new Map<string, StaffSession[]>();
  for (const session of sessions) {
    if (session.starts_at === null) continue;
    const key = prDateKey(session.starts_at);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const cells = monthGrid(month.year, month.month);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const keyOf = (day: number) =>
    `${month.year}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{formatMonth(month.year, month.month, lang)}</caption>
      <thead>
        <tr>
          {weekdays.map(day => (
            <th key={day} scope="col" className="pb-2 text-left text-sm font-medium leading-5 text-muted">
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, w) => (
          <tr key={w}>
            {week.map((day, d) => {
              if (day === null) return <td key={d} className="h-28 border border-border/60 bg-canvas" />;
              const key = keyOf(day);
              const list = byDay.get(key) ?? [];
              return (
                <td key={d} className="h-28 border border-border/60 p-1.5 align-top">
                  <span
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-full text-sm leading-5',
                      numbers,
                      key === todayKey ? 'bg-ink font-semibold text-white' : 'text-ink',
                    )}
                  >
                    {day}
                  </span>
                  <ul className="mt-1 flex flex-col gap-1">
                    {list.map(session => {
                      const selected = session.id === selectedId;
                      const [Icon, tone] = SESSION_STATE[session.state];
                      const seats =
                        session.capacity === null
                          ? t('ses.capacityTbd')
                          : t('ses.seatsLong', {
                              taken: session.seats_taken,
                              capacity: session.capacity - session.blocked_seats,
                            });
                      const label = `${formatShortDate(session.starts_at!, lang)}, ${formatTime(session.starts_at!, lang)}. ${session.title_es ?? ''}. ${t(`ses.state.${session.state}`)}. ${seats}.${session.synthetic ? ` ${t('staff.synthetic')}.` : ''}`;
                      return (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(session)}
                            aria-label={label}
                            aria-pressed={selected}
                            className={cn(
                              'relative block w-full rounded-lg border px-1.5 py-1 text-left text-sm leading-5 hover:bg-stone-100',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                              selected ? 'border-transparent' : 'border-stone-300',
                              tone === 'ended' ? 'text-muted' : 'text-ink',
                            )}
                          >
                            {selected ? (
                              <motion.span
                                layoutId="staff-selected-session"
                                transition={SPRING}
                                aria-hidden="true"
                                className="absolute inset-0 rounded-lg border-2 border-ink"
                              />
                            ) : null}
                            <span className={cn('flex min-w-0 items-center gap-1 font-semibold', numbers)}>
                              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{formatTime(session.starts_at!, lang)}</span>
                            </span>
                            <span className="block truncate">{session.title_es}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Phones' calendar option: days with sessions are buttons; choosing one filters the list. */
function MiniMonth({
  month,
  sessions,
  todayKey,
  day,
  onDay,
}: {
  month: Month;
  sessions: StaffSession[];
  todayKey: string;
  day: string | null;
  onDay: (key: string | null) => void;
}) {
  const {t, lang} = useStaffT();
  const counts = new Map<string, number>();
  for (const session of sessions) {
    if (session.starts_at === null) continue;
    const key = prDateKey(session.starts_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const cells = monthGrid(month.year, month.month);
  const weekdays = t('cal.weekdays').split(',');
  const keyOf = (d: number) => `${month.year}-${String(month.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{formatMonth(month.year, month.month, lang)}</caption>
      <thead>
        <tr>
          {weekdays.map(name => (
            <th key={name} scope="col" className="pb-1 text-center text-sm font-medium leading-5 text-muted">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, w) => (
          <tr key={w}>
            {week.map((d, i) => {
              if (d === null) return <td key={i} />;
              const key = keyOf(d);
              const count = counts.get(key) ?? 0;
              if (!count) {
                return (
                  <td key={i} className="h-11 text-center">
                    <span
                      className={cn(
                        'text-sm leading-5',
                        numbers,
                        key === todayKey ? 'font-semibold text-ink underline' : 'text-muted',
                      )}
                    >
                      {d}
                    </span>
                  </td>
                );
              }
              const date = formatLongDate(new Date(`${key}T16:00:00Z`).getTime(), lang);
              return (
                <td key={i} className="h-11 p-0.5 text-center">
                  <button
                    type="button"
                    aria-pressed={day === key}
                    aria-label={count === 1 ? t('cal.sessionOn', {date}) : t('cal.sessionsOn', {count, date})}
                    onClick={() => onDay(day === key ? null : key)}
                    className={cn(
                      'flex size-full min-h-11 flex-col items-center justify-center rounded-xl border text-sm font-semibold leading-5',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                      numbers,
                      day === key ? 'border-2 border-ink text-ink' : 'border-stone-300 text-ink hover:bg-stone-100',
                    )}
                  >
                    {d}
                    <span aria-hidden="true" className="mt-0.5 block size-1.5 rounded-full bg-ink" />
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Sessions grouped by day, as flush rows (the list view, and the phone agenda). */
function DayGroups({sessions}: {sessions: StaffSession[]}) {
  const {t, lang} = useStaffT();
  const groups = new Map<string, StaffSession[]>();
  for (const session of sessions) {
    const key = session.starts_at === null ? 'tbd' : prDateKey(session.starts_at);
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  return (
    <div className="-mx-4 flex flex-col gap-4 sm:-mx-6">
      {[...groups.entries()].map(([key, list]) => (
        <div key={key}>
          <h3 className="px-4 pb-2 text-sm font-semibold leading-5 text-muted first-letter:uppercase sm:px-6">
            {key === 'tbd' ? t('staff.dateTbd') : formatLongDate(list[0].starts_at!, lang)}
          </h3>
          <SessionRows sessions={list} timeOnly={key !== 'tbd'} />
        </div>
      ))}
    </div>
  );
}

/** The 360px panel on computers: the chosen session (or the next one), with its first bookings. */
function Preview({
  session,
  chosen,
  onEntry,
}: {
  session: StaffSession;
  chosen: boolean;
  onEntry: (sessionId: string) => void;
}) {
  const {t, lang} = useStaffT();
  const one = useQuery<SessionData>(`/api/equipo/sessions/${session.id}`);
  return (
    <Panel className="lg:self-start">
      <div className="flex flex-col gap-2">
        <p className={helper}>{chosen ? t('ses.chosen') : t('ses.nextUp')}</p>
        <h2 className={sectionTitle}>{session.title_es}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Demo synthetic={session.synthetic} />
          <SessionState state={session.state} />
        </div>
        <p className={cn('text-sm leading-5 text-ink first-letter:uppercase', numbers)}>
          {session.starts_at === null
            ? t('staff.dateTbd')
            : `${formatLongDate(session.starts_at, lang)}, ${formatTime(session.starts_at, lang)}`}
        </p>
        <Seats session={session} long />
        <div className="flex flex-wrap gap-2 empty:hidden">
          <CountChips inquiries={session.inquiries} pending={session.pending} exceptions={session.exceptions} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
        <h3 className="text-sm font-semibold leading-5 text-ink">{t('nav.bookings')}</h3>
        <QueryView query={one.query} onRetry={() => void one.reload()}>
          {({bookings}) =>
            bookings.length ? (
              <>
                <ul className={rows}>
                  {bookings.slice(0, 5).map(booking => (
                    <li key={booking.id}>
                      <Link
                        to={`/equipo/reservaciones/${booking.id}/`}
                        className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-ink hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-5">{booking.lead_name}</span>
                          <span className={cn('block', helper, numbers)}>
                            {booking.party_size === 1 ? t('bk.person') : t('bk.people', {count: booking.party_size})}
                          </span>
                        </span>
                        <BookingStatus status={booking.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {bookings.length > 5 ? (
                  <Link
                    to={`/equipo/sesiones/${session.id}/`}
                    className={cn(buttonVariants({variant: 'link'}), 'self-start')}
                  >
                    {t('ses.viewAll', {count: bookings.length})}
                  </Link>
                ) : null}
              </>
            ) : (
              <p className={helper}>{t('ses.noBookings')}</p>
            )
          }
        </QueryView>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/equipo/sesiones/${session.id}/`} className={buttonVariants({variant: 'primary'})}>
          {t('ses.openSession')}
        </Link>
        {session.state === 'published' ? (
          <Button variant="secondary" onClick={() => onEntry(session.id)}>
            <Plus aria-hidden="true" />
            {t('bk.new')}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

export function CalendarView() {
  const {t, lang} = useStaffT();
  const me = useMe();
  const wide = useMediaQuery('(min-width: 1024px)');
  const today = prDateParts(me.now);
  const todayKey = prDateKey(me.now);
  const [month, setMonth] = useState<Month>({year: today.year, month: today.month});
  const [viewPref, setViewPref] = useState<View | null>(() => readJson<View>('session', 'pap-staff-view'));
  const view: View = viewPref ?? (wide ? 'grid' : 'list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [experience, setExperience] = useState('all');
  const [creating, setCreating] = useState(false);
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [from, to] = prMonthBounds(month.year, month.month);
  const {query, reload} = useQuery<{sessions: StaffSession[]}>(`/api/equipo/sessions?from=${from}&to=${to}`);
  const sessions = useMemo(() => (query.state === 'ready' ? query.data.sessions : []), [query]);

  const experiences = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions)
      if (!seen.has(session.experience_id)) seen.set(session.experience_id, session.title_es ?? session.experience_id);
    return [...seen.entries()].map(([value, label]) => ({value, label}));
  }, [sessions]);
  const filtered = experience === 'all' ? sessions : sessions.filter(s => s.experience_id === experience);
  const dated = filtered.filter(s => s.starts_at !== null);
  const undated = filtered.filter(s => s.starts_at === null);
  const next = dated.find(s => s.starts_at! >= me.now) ?? dated[0] ?? undated[0] ?? null;
  const selected = filtered.find(s => s.id === selectedId) ?? null;
  const shown = selected ?? next;

  const changeMonth = (delta: number) => {
    setDay(null);
    setSelectedId(null);
    setMonth(m => addMonths(m.year, m.month, delta));
  };
  const chooseView = (nextView: View) => {
    setViewPref(nextView);
    writeJson('session', 'pap-staff-view', nextView);
  };

  // Phones: three rows (month; Hoy and the switch; the filter). Computers: one row.
  const controls = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
        <Button variant="ghost" aria-label={t('ses.prev')} className="w-11 px-0" onClick={() => changeMonth(-1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2
          aria-live="polite"
          className={cn(
            'min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-ink first-letter:uppercase sm:min-w-44 sm:flex-none',
            numbers,
          )}
        >
          {formatMonth(month.year, month.month, lang)}
        </h2>
        <Button variant="ghost" aria-label={t('ses.next')} className="w-11 px-0" onClick={() => changeMonth(1)}>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setDay(null);
          setSelectedId(null);
          setMonth({year: today.year, month: today.month});
        }}
      >
        {t('ses.today')}
      </Button>
      <Switch
        value={view}
        onChange={chooseView}
        label={t('cal.viewLabel')}
        options={[
          {
            value: 'grid',
            label: (
              <>
                <CalendarDays aria-hidden="true" />
                {t('cal.viewGrid')}
              </>
            ),
          },
          {
            value: 'list',
            label: (
              <>
                <List aria-hidden="true" />
                {t('cal.viewList')}
              </>
            ),
          },
        ]}
      />
      {experiences.length > 1 ? (
        <label className="relative flex w-full sm:ml-auto sm:w-48">
          <span className="sr-only">{t('ses.experience')}</span>
          <select
            value={experience}
            onChange={event => {
              setExperience(event.target.value);
              setDay(null);
            }}
            className="min-h-11 w-full appearance-none rounded-2xl border border-stone-500 bg-surface py-2 pl-4 pr-10 text-sm font-medium leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="all">{`${t('ses.experience')}: ${t('cal.filterAll')}`}</option>
            {experiences.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink"
          />
        </label>
      ) : null}
    </div>
  );

  const body = (
    <QueryView query={query} onRetry={() => void reload()}>
      {() => {
        if (!filtered.length) return <Empty>{t('ses.empty')}</Empty>;
        if (view === 'grid' && wide) {
          return (
            <div className="flex flex-col gap-4">
              <StaffMonthGrid
                month={month}
                sessions={dated}
                selectedId={shown?.id ?? null}
                todayKey={todayKey}
                onSelect={session => setSelectedId(session.id)}
              />
              {undated.length ? <DayGroups sessions={undated} /> : null}
            </div>
          );
        }
        if (view === 'grid') {
          const onDay = day ? dated.filter(s => prDateKey(s.starts_at!) === day) : dated;
          return (
            <div className="flex flex-col gap-4">
              <MiniMonth month={month} sessions={dated} todayKey={todayKey} day={day} onDay={setDay} />
              {day ? (
                <Button variant="ghost" onClick={() => setDay(null)} className="-ml-3 self-start">
                  {t('cal.showMonth')}
                </Button>
              ) : null}
              {onDay.length ? <DayGroups sessions={onDay} /> : null}
              {!day && undated.length ? <DayGroups sessions={undated} /> : null}
            </div>
          );
        }
        return <DayGroups sessions={filtered} />;
      }}
    </QueryView>
  );

  return (
    <Page>
      <PageHeader
        title={t('nav.calendar')}
        help={t('cal.tz')}
        primary={<NewSessionButton onClick={() => setCreating(true)} />}
      />
      <div className={cn(workspace, 'items-start')}>
        <Panel className="gap-5">
          {controls}
          {body}
        </Panel>
        {wide && shown ? (
          <Preview key={shown.id} session={shown} chosen={Boolean(selected)} onEntry={setEntryFor} />
        ) : null}
      </div>
      <SessionSheet
        open={creating}
        onOpenChange={setCreating}
        row={null}
        onSaved={id => navigate(`/equipo/sesiones/${id}/`)}
      />
      <ManualEntrySheet
        open={entryFor !== null}
        onOpenChange={open => {
          if (!open) setEntryFor(null);
        }}
        sessionId={entryFor}
      />
    </Page>
  );
}

// ------------------------------------------------------------------ sessions list

type StateFilter = 'all' | StaffSession['state'];
const FILTERS: [StateFilter, string][] = [
  ['all', 'ses.filter.all'],
  ['draft', 'ses.filter.draft'],
  ['published', 'ses.filter.published'],
  ['cancelled', 'ses.filter.cancelled'],
  ['archived', 'ses.filter.archived'],
];

export function SessionsList({creating}: {creating?: boolean}) {
  const {t} = useStaffT();
  const ids = useId();
  const [state, setState] = useState<StateFilter>('all');
  const [open, setOpen] = useState(false);
  const {query, reload} = useQuery<{sessions: StaffSession[]}>('/api/equipo/sessions');
  const sessions = query.state === 'ready' ? query.data.sessions : [];
  const count = (filter: StateFilter) =>
    filter === 'all' ? sessions.length : sessions.filter(s => s.state === filter).length;
  const label = (filter: StateFilter, key: string) =>
    query.state === 'ready' ? `${t(key)} (${count(filter)})` : t(key);
  const shown = state === 'all' ? sessions : sessions.filter(s => s.state === state);
  return (
    <Page>
      <PageHeader title={t('nav.sessions')} primary={<NewSessionButton onClick={() => setOpen(true)} />} />
      <Panel flush>
        <div className="px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="hidden lg:block">
            <Switch
              value={state}
              onChange={setState}
              label={t('ses.state')}
              options={FILTERS.map(([value, key]) => ({
                value,
                label: <span className={numbers}>{label(value, key)}</span>,
              }))}
            />
          </div>
          <SelectField
            id={`${ids}-state`}
            label={t('ses.state')}
            value={state}
            onChange={setState}
            className="max-w-xs lg:hidden"
            options={FILTERS.map(([value, key]) => ({value, label: label(value, key)}))}
          />
        </div>
        <QueryView query={query} onRetry={() => void reload()}>
          {() =>
            shown.length ? (
              <div>
                <SessionColumns />
                <SessionRows sessions={shown} columns />
              </div>
            ) : (
              <Empty flush>{t('ses.filterEmpty')}</Empty>
            )
          }
        </QueryView>
      </Panel>
      <SessionSheet
        open={Boolean(creating) || open}
        onOpenChange={next => {
          if (next) return;
          if (creating) navigate('/equipo/sesiones/');
          setOpen(false);
        }}
        row={null}
        onSaved={id => navigate(`/equipo/sesiones/${id}/`)}
      />
    </Page>
  );
}

// ------------------------------------------------------------------ the session form (a sheet)

interface Form {
  experienceId: string;
  venueId: string;
  tbd: boolean;
  date: string;
  start: string;
  end: string;
  capacity: string;
  blocked: string;
  partyMin: string;
  partyMax: string;
  bookingMode: 'inquiry' | 'confirmed';
  priceStatus: 'unset' | 'approved' | 'not_charged';
  amount: string;
  policyId: string;
  threshold: string;
}

function toForm(row: StaffSession | null, now: number): Form {
  const start = row?.starts_at ?? null;
  const fields = start === null ? toPrLocalFields(now + 14 * 24 * 60 * 60 * 1000) : toPrLocalFields(start);
  return {
    experienceId: row?.experience_id ?? '',
    venueId: row?.venue_id ?? '',
    tbd: row ? start === null : false,
    date: fields.date,
    start: start === null ? '19:00' : fields.time,
    end: row?.ends_at ? toPrLocalFields(row.ends_at).time : '',
    capacity: row?.capacity === null || row?.capacity === undefined ? '' : String(row.capacity),
    blocked: String(row?.blocked_seats ?? 0),
    partyMin: row?.party_min ? String(row.party_min) : '',
    partyMax: row?.party_max ? String(row.party_max) : '',
    bookingMode: row?.booking_mode ?? 'inquiry',
    priceStatus: row?.price_status ?? 'unset',
    amount: centsText(row?.price_cents ?? null),
    policyId: row?.policy_version_id ?? '',
    threshold: row?.low_seats_threshold ? String(row.low_seats_threshold) : '',
  };
}

type Errors = Partial<Record<keyof Form, string>>;

function toFields(form: Form, t: (key: string) => string): {fields: Record<string, unknown>} | {errors: Errors} {
  const errors: Errors = {};
  let startsAt: number | null = null;
  let endsAt: number | null = null;
  if (!form.experienceId) errors.experienceId = t('ses.pickExperience');
  if (!form.tbd) {
    startsAt = parsePrLocal(form.date, form.start);
    if (startsAt === null) errors.date = t('ses.invalidDate');
    if (form.end) {
      endsAt = parsePrLocal(form.date, form.end);
      if (endsAt === null) errors.end = t('ses.invalidDate');
      else if (startsAt !== null && endsAt <= startsAt) errors.end = t('ses.invalidEnd');
    }
  }
  const numbersOf = {
    capacity: intOrNull(form.capacity),
    partyMin: intOrNull(form.partyMin),
    partyMax: intOrNull(form.partyMax),
    threshold: intOrNull(form.threshold),
  };
  const blocked = intOrNull(form.blocked) ?? 0;
  for (const [key, value] of Object.entries(numbersOf)) {
    if (Number.isNaN(value) || (value === 0 && key !== 'capacity')) errors[key as keyof Form] = t('ses.invalidNumber');
  }
  if (Number.isNaN(blocked)) errors.blocked = t('ses.invalidNumber');
  if (numbersOf.partyMin && numbersOf.partyMax && numbersOf.partyMin > numbersOf.partyMax)
    errors.partyMax = t('ses.invalidParty');
  let priceCents: number | null = null;
  if (form.priceStatus === 'approved') {
    priceCents = parseMoney(form.amount);
    if (priceCents === null) errors.amount = t('ses.invalidAmount');
  }
  if (Object.keys(errors).length) return {errors};
  return {
    fields: {
      experienceId: form.experienceId,
      venueId: form.venueId || null,
      startsAt,
      endsAt,
      capacity: numbersOf.capacity,
      blockedSeats: blocked,
      partyMin: numbersOf.partyMin,
      partyMax: numbersOf.partyMax,
      bookingMode: form.bookingMode,
      priceStatus: form.priceStatus,
      priceCents,
      currency: form.priceStatus === 'approved' ? 'USD' : null,
      policyVersionId: form.policyId || null,
      lowSeatsThreshold: numbersOf.threshold,
    },
  };
}

function SessionForm({
  formId,
  row,
  catalog,
  onSubmit,
}: {
  formId: string;
  row: StaffSession | null;
  catalog: Catalog;
  onSubmit: (fields: Record<string, unknown>) => void;
}) {
  const {t} = useStaffT();
  const me = useMe();
  const ids = useId();
  const [form, setFormState] = useState<Form>(() => toForm(row, me.now));
  const [errors, setErrors] = useState<Errors>({});
  const set = (patch: Partial<Form>) => setFormState(current => ({...current, ...patch}));
  const owner = me.role === 'owner';
  const id = (name: string) => `${ids}-${name}`;
  const experiences = catalog.experiences.filter(e => e.status !== 'archived' || e.id === form.experienceId);
  const policies = catalog.policies.filter(p => p.state !== 'retired' || p.id === form.policyId);
  const pair = 'grid grid-cols-1 gap-4 min-[22rem]:grid-cols-2';

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault();
        const built = toFields(form, t);
        if ('errors' in built) {
          setErrors(built.errors);
          return;
        }
        setErrors({});
        onSubmit(built.fields);
      }}
    >
      <div className="flex flex-col gap-2">
        <SelectField
          id={id('experience')}
          label={t('ses.experience')}
          value={form.experienceId}
          onChange={value => set({experienceId: value})}
          options={[
            {value: '', label: t('ses.pickExperience')},
            ...experiences.map(e => ({value: e.id, label: `${e.title_es} · ${t(`exp.status.${e.status}`)}`})),
          ]}
        />
        {errors.experienceId ? (
          <p role="alert" className="text-sm font-medium leading-5 text-ink">
            {errors.experienceId}
          </p>
        ) : null}
      </div>
      <FieldGroup legend={t('ses.when')}>
        <CheckField id={id('tbd')} label={t('ses.tbd')} checked={form.tbd} onChange={value => set({tbd: value})} />
        {form.tbd ? null : (
          <>
            <TextField
              id={id('date')}
              type="date"
              label={t('ses.date')}
              value={form.date}
              onChange={value => set({date: value})}
              error={errors.date}
              help={t('ses.tzHelp')}
            />
            <div className={pair}>
              <TextField
                id={id('start')}
                type="time"
                label={t('ses.start')}
                value={form.start}
                onChange={value => set({start: value})}
              />
              <TextField
                id={id('end')}
                type="time"
                label={t('ses.end')}
                value={form.end}
                onChange={value => set({end: value})}
                error={errors.end}
              />
            </div>
          </>
        )}
      </FieldGroup>
      <FieldGroup legend={t('ses.placeSeats')}>
        <SelectField
          id={id('venue')}
          label={t('ses.venue')}
          value={form.venueId}
          onChange={value => set({venueId: value})}
          options={[
            {value: '', label: t('ses.noVenue')},
            ...catalog.venues.map(v => ({
              value: v.id,
              label: `${v.name} · ${v.approved ? t('venue.ok') : t('venue.pending')}`,
            })),
          ]}
        />
        <div className={pair}>
          <TextField
            id={id('capacity')}
            label={t('ses.capacity')}
            inputMode="numeric"
            value={form.capacity}
            onChange={value => set({capacity: value})}
            error={errors.capacity}
            disabled={!owner}
            help={owner ? t('ses.capacityHelp') : t('ses.ownerOnly')}
          />
          <TextField
            id={id('blocked')}
            label={t('ses.blocked')}
            inputMode="numeric"
            value={form.blocked}
            onChange={value => set({blocked: value})}
            error={errors.blocked}
            disabled={!owner}
          />
          <TextField
            id={id('min')}
            label={t('ses.partyMin')}
            inputMode="numeric"
            value={form.partyMin}
            onChange={value => set({partyMin: value})}
            error={errors.partyMin}
          />
          <TextField
            id={id('max')}
            label={t('ses.partyMax')}
            inputMode="numeric"
            value={form.partyMax}
            onChange={value => set({partyMax: value})}
            error={errors.partyMax}
          />
        </div>
        <TextField
          id={id('threshold')}
          label={t('ses.threshold')}
          inputMode="numeric"
          value={form.threshold}
          onChange={value => set({threshold: value})}
          error={errors.threshold}
          help={t('ses.thresholdHelp')}
        />
      </FieldGroup>
      <FieldGroup legend={t('ses.bookingPrice')}>
        <SelectField
          id={id('mode')}
          label={t('ses.mode')}
          value={form.bookingMode}
          onChange={value => set({bookingMode: value})}
          options={[
            {value: 'inquiry', label: t('ses.mode.inquiry')},
            {value: 'confirmed', label: t('ses.mode.confirmed')},
          ]}
        />
        <div className={pair}>
          <SelectField
            id={id('price')}
            label={t('ses.price')}
            value={form.priceStatus}
            onChange={value => set({priceStatus: value})}
            options={[
              {value: 'unset', label: t('ses.price.unset')},
              {value: 'approved', label: t('ses.price.approved')},
              {value: 'not_charged', label: t('ses.price.not_charged')},
            ]}
          />
          {form.priceStatus === 'approved' ? (
            <TextField
              id={id('amount')}
              label={t('ses.amount')}
              inputMode="decimal"
              value={form.amount}
              onChange={value => set({amount: value})}
              error={errors.amount}
            />
          ) : null}
        </div>
        <SelectField
          id={id('policy')}
          label={t('ses.policy')}
          value={form.policyId}
          onChange={value => set({policyId: value})}
          options={[
            {value: '', label: t('ses.noPolicy')},
            ...policies.map(p => ({value: p.id, label: `${p.title} · ${t(`pol.state.${p.state}`)}`})),
          ]}
        />
      </FieldGroup>
    </form>
  );
}

/**
 * "Nueva sesión" or "Editar sesión": the form in a wide sheet, with the save in the footer.
 * Validation and a version conflict show inside the sheet, next to the save.
 */
function SessionSheet({
  open,
  onOpenChange,
  row,
  onSaved,
  onReloadCurrent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: StaffSession | null;
  onSaved: (id: string) => void;
  onReloadCurrent?: () => void;
}) {
  const {t} = useStaffT();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const catalog = useQuery<Catalog>(open ? '/api/equipo/catalog' : null);
  const [notice, setNotice] = useState<Notice>(null);
  const [stale, setStale] = useState(false);

  const save = async (fields: Record<string, unknown>) => {
    const result = row
      ? await run(`/api/equipo/sessions/${row.id}`, {expectedVersion: row.version, fields})
      : await run('/api/equipo/sessions', {fields});
    if (result.kind === 'error' && result.code === 'version_conflict') {
      setStale(true);
      setNotice({tone: 'problem', text: t('ses.stale')});
      return;
    }
    if (result.kind !== 'ok') {
      setNotice(outcome(result, ''));
      return;
    }
    setNotice(null);
    const saved = (result.data.outcome as {id?: string} | null)?.id ?? row?.id;
    if (saved) onSaved(saved);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          setNotice(null);
          setStale(false);
        }
        onOpenChange(next);
      }}
      kind="sheet"
      size="wide"
      title={row ? t('ses.editSession') : t('ses.new')}
      closeLabel={t('staff.close')}
      footer={
        <div>
          <NoticeLine notice={notice} className="mb-3" />
          {stale && onReloadCurrent ? (
            <Button
              variant="secondary"
              className="mb-3"
              onClick={() => {
                setStale(false);
                setNotice(null);
                onReloadCurrent();
              }}
            >
              {t('ses.loadCurrent')}
            </Button>
          ) : null}
          <FormFooter
            formId={formId}
            label={t('ses.save')}
            busy={busy}
            disabled={catalog.query.state !== 'ready'}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      }
    >
      <QueryView query={catalog.query} onRetry={() => void catalog.reload()}>
        {data => (
          <SessionForm
            key={row ? `${row.id}:${row.version}` : 'new'}
            formId={formId}
            row={row}
            catalog={data}
            onSubmit={fields => void save(fields)}
          />
        )}
      </QueryView>
    </Dialog>
  );
}

// ------------------------------------------------------------------ one session

/** Missing items stay in view (bold, CircleX); the done ones sit behind a disclosure. */
function Checklist({items}: {items: {code: string; ok: boolean}[]}) {
  const {t} = useStaffT();
  const missing = items.filter(item => !item.ok);
  const done = items.filter(item => item.ok);
  return (
    <div className="flex flex-col gap-3">
      {missing.length ? (
        <ul className="flex flex-col gap-2">
          {missing.map(item => (
            <li key={item.code} className="flex items-start gap-2 text-sm font-semibold leading-5 text-ink">
              <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">{t('ses.checkMissing')}: </span>
                {t(`check.${item.code}`)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {done.length ? (
        <Disclosure summary={t('ses.showReady', {count: done.length})}>
          <ul className="flex flex-col gap-2">
            {done.map(item => (
              <li key={item.code} className="flex items-start gap-2 text-sm leading-5 text-ink">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="sr-only">{t('ses.checkOk')}: </span>
                  {t(`check.${item.code}`)}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}

const readyCount = (items: {ok: boolean}[]) => items.filter(item => item.ok).length;

export function SessionPage({id}: {id: string}) {
  const {t, lang} = useStaffT();
  const me = useMe();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState(false);
  const [confirm, setConfirm] = useState<null | 'unpublish' | 'archive' | 'cancel'>(null);
  const catalog = useQuery<Catalog>('/api/equipo/catalog');
  const one = useQuery<SessionData>(`/api/equipo/sessions/${id}`);

  const transition = async (session: StaffSession, to: 'publish' | 'unpublish' | 'cancel' | 'archive') => {
    const result = await run(`/api/equipo/sessions/${session.id}/state`, {
      expectedVersion: session.version,
      transition: to,
    });
    setNotice(outcome(result, t('ses.stateDone')));
    void one.reload(true);
  };

  return (
    <QueryView query={one.query} onRetry={() => void one.reload()}>
      {({session, bookings, checklist}) => {
        const data = catalog.query.state === 'ready' ? catalog.query.data : null;
        const experience = data?.experiences.find(e => e.id === session.experience_id);
        const venue = data?.venues.find(v => v.id === session.venue_id);
        const policy = data?.policies.find(p => p.id === session.policy_version_id);
        const title = experience?.title_es ?? t('nav.sessions');
        const price =
          session.price_status === 'approved' && session.price_cents !== null && session.currency
            ? formatMoney(session.price_cents, session.currency, lang)
            : t(`ses.price.${session.price_status}`);
        const open = session.state === 'draft' || session.state === 'published';
        const canArchive =
          session.state === 'cancelled' ||
          (session.state === 'published' && session.starts_at !== null && session.starts_at < me.now);
        const download = () => {
          const link = document.createElement('a');
          link.href = `/api/equipo/export.csv?session=${encodeURIComponent(session.id)}`;
          link.download = '';
          document.body.append(link);
          link.click();
          link.remove();
        };
        const more: MenuAction[] = [
          ...(session.state === 'published'
            ? [{key: 'unpublish', label: t('ses.unpublish'), icon: Undo2, onSelect: () => setConfirm('unpublish')}]
            : []),
          ...(canArchive
            ? [{key: 'archive', label: t('ses.archive'), icon: Archive, onSelect: () => setConfirm('archive')}]
            : []),
          {key: 'csv', label: t('ses.export'), icon: Download, onSelect: download},
          ...(open
            ? [
                {
                  key: 'cancel',
                  label: t('ses.cancel'),
                  icon: CircleX,
                  destructive: true,
                  onSelect: () => setConfirm('cancel'),
                },
              ]
            : []),
        ];
        const count = (status: string) => bookings.filter(b => b.status === status);
        const confirmed = count('confirmed');
        const people = confirmed.reduce((sum, b) => sum + b.party_size, 0);
        const group =
          session.party_min === null && session.party_max === null
            ? t('ses.notSet')
            : t('ses.groupRange', {min: session.party_min ?? '—', max: session.party_max ?? '—'});

        return (
          <Page>
            <PageHeader
              back={
                <Link to="/equipo/sesiones/" className={buttonVariants({variant: 'ghost'})}>
                  <ChevronLeft aria-hidden="true" />
                  {t('ses.back')}
                </Link>
              }
              title={title}
              meta={
                <>
                  <Demo synthetic={session.synthetic} />
                  <SessionState state={session.state} />
                  <span className="text-sm leading-5 text-ink">
                    {session.starts_at === null ? (
                      t('staff.dateTbd')
                    ) : (
                      <span className={numbers}>
                        {formatShortDate(session.starts_at, lang)}, {formatTime(session.starts_at, lang)}
                      </span>
                    )}
                  </span>
                  <Seats session={session} long />
                  <span className={cn('text-sm leading-5 text-ink', numbers)}>{price}</span>
                </>
              }
              actions={
                <>
                  {session.state === 'draft' ? (
                    <Confirm
                      variant="primary"
                      className="w-full sm:w-auto"
                      trigger={t('ses.publish')}
                      title={t('ses.publish')}
                      body={t('ses.publishBody')}
                      confirmLabel={t('ses.publish')}
                      disabled={busy}
                      onConfirm={() => transition(session, 'publish')}
                    />
                  ) : null}
                  {open ? (
                    <Button variant="secondary" onClick={() => setEditing(true)}>
                      <Pencil aria-hidden="true" />
                      {t('ses.editSession')}
                    </Button>
                  ) : null}
                  <Menu label={t('staff.more')} actions={more} />
                </>
              }
            />
            <NoticeLine notice={notice} />
            <div className={cn(workspace, 'items-start lg:grid-rows-[auto_1fr]')}>
              <Panel
                title={t('ses.checklist')}
                actions={
                  <span className={cn(helper, numbers)}>
                    {t('ses.readyCount', {ok: readyCount(checklist.publish), total: checklist.publish.length})}
                  </span>
                }
                className="lg:col-start-2 lg:row-start-1"
              >
                <Checklist items={checklist.publish} />
                <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className={sectionTitle}>{t('ses.checklistConfirm')}</h3>
                    <span className={cn(helper, numbers)}>
                      {t('ses.readyCount', {
                        ok: readyCount(checklist.confirmable),
                        total: checklist.confirmable.length,
                      })}
                    </span>
                  </div>
                  <Checklist items={checklist.confirmable} />
                </div>
              </Panel>
              <Panel
                flush
                title={t('ses.bookingsCount', {count: bookings.length})}
                actions={
                  session.state === 'published' ? (
                    <Button variant="secondary" onClick={() => setEntry(true)}>
                      <Plus aria-hidden="true" />
                      {t('bk.new')}
                    </Button>
                  ) : null
                }
                className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
              >
                {bookings.length ? (
                  <>
                    <div className="flex flex-wrap gap-2 px-4 empty:hidden sm:px-6">
                      {confirmed.length ? (
                        <Chip>{t('ses.summaryConfirmed', {groups: confirmed.length, people})}</Chip>
                      ) : null}
                      <CountChips
                        inquiries={count('inquiry').length}
                        pending={count('pending_payment').length}
                        exceptions={count('exception').length}
                      />
                    </div>
                    <div>
                      <BookingColumns />
                      <BookingRows bookings={bookings} columns />
                    </div>
                  </>
                ) : (
                  <Empty flush>{t('ses.noBookings')}</Empty>
                )}
              </Panel>
              <Panel title={t('ses.details')} className="lg:col-start-2 lg:row-start-2">
                <Facts
                  columns={1}
                  items={[
                    [
                      t('ses.venue'),
                      venue
                        ? `${venue.name} · ${venue.approved ? t('venue.ok') : t('venue.pending')}`
                        : t('ses.noVenue'),
                    ],
                    [
                      t('ses.capacity'),
                      session.capacity === null ? (
                        t('ses.capacityTbd')
                      ) : (
                        <span className={numbers}>{session.capacity}</span>
                      ),
                    ],
                    [t('ses.blocked'), <span className={numbers}>{session.blocked_seats}</span>],
                    [t('ses.party'), group],
                    [
                      t('ses.mode'),
                      t(session.booking_mode === 'confirmed' ? 'ses.mode.confirmed' : 'ses.mode.inquiry'),
                    ],
                    [t('ses.price'), price],
                    [
                      t('ses.policy'),
                      policy ? `${policy.title} · ${t(`pol.state.${policy.state}`)}` : t('ses.noPolicy'),
                    ],
                    [
                      t('ses.threshold'),
                      session.low_seats_threshold === null ? t('ses.notSet') : String(session.low_seats_threshold),
                    ],
                  ]}
                />
              </Panel>
            </div>

            <SessionSheet
              open={editing}
              onOpenChange={setEditing}
              row={session}
              onReloadCurrent={() => void one.reload(true)}
              onSaved={() => {
                setEditing(false);
                setNotice({tone: 'ok', text: t('ses.saved')});
                void one.reload(true);
              }}
            />
            <ManualEntrySheet open={entry} onOpenChange={setEntry} sessionId={session.id} locked />
            <ConfirmDialog
              open={confirm === 'unpublish'}
              onOpenChange={next => setConfirm(next ? 'unpublish' : null)}
              title={t('ses.unpublish')}
              body={t('ses.unpublishBody')}
              confirmLabel={t('ses.unpublish')}
              onConfirm={() => transition(session, 'unpublish')}
            />
            <ConfirmDialog
              open={confirm === 'archive'}
              onOpenChange={next => setConfirm(next ? 'archive' : null)}
              title={t('ses.archive')}
              body={t('ses.archiveBody')}
              confirmLabel={t('ses.archive')}
              onConfirm={() => transition(session, 'archive')}
            />
            <ConfirmDialog
              open={confirm === 'cancel'}
              onOpenChange={next => setConfirm(next ? 'cancel' : null)}
              title={t('ses.cancel')}
              body={t('ses.cancelBody')}
              confirmLabel={t('ses.cancel')}
              onConfirm={() => transition(session, 'cancel')}
            />
          </Page>
        );
      }}
    </QueryView>
  );
}
