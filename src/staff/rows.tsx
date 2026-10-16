// Flush list rows shared by the staff pages (one link per row; color and border only, nothing
// moves), plus the session options that the pickers and filters use.
import {useMemo} from 'react';
import {ChevronRight} from 'lucide-react';
import {formatShortDate, formatTime} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {helper, numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {useQuery} from './api.ts';
import {
  BookingStatus,
  CountChips,
  Demo,
  SelectField,
  SessionState,
  Seats,
  flushList,
  rowLink,
  useStaffT,
} from './ui.tsx';
import type {StaffBookingRow, StaffSession} from './types.ts';

/** Sessions a booking can go to (moves, proposals, new requests), and a label for each. */
export function useSessionOptions(enabled = true) {
  const {query} = useQuery<{sessions: StaffSession[]}>(enabled ? '/api/equipo/sessions' : null);
  const {t, lang} = useStaffT();
  return useMemo(() => {
    const list = query.state === 'ready' ? query.data.sessions : [];
    // The date first: a narrow select cuts the end, and sessions often share a title.
    const label = (s: StaffSession) =>
      `${s.starts_at === null ? t('staff.dateTbd') : `${formatShortDate(s.starts_at, lang)}, ${formatTime(s.starts_at, lang)}`} · ${s.title_es ?? s.id}`;
    return {list, label, published: list.filter(s => s.state === 'published')};
  }, [query, lang, t]);
}

export function SessionPicker({
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

// ------------------------------------------------------------------ sessions

const SESSION_COLUMNS = 'lg:grid-cols-[10rem_minmax(0,1fr)_9rem_12rem_minmax(0,12rem)_1rem]';

/** The column names over a session list on computers (the rows say the same in words). */
export function SessionColumns() {
  const {t} = useStaffT();
  return (
    <div
      aria-hidden="true"
      className={cn('hidden gap-x-4 px-4 pb-2 text-sm leading-5 text-muted sm:px-6 lg:grid', SESSION_COLUMNS)}
    >
      <span>{t('ses.date')}</span>
      <span>{t('ses.experience')}</span>
      <span>{t('ses.state')}</span>
      <span>{t('ses.seatsLabel')}</span>
      <span>{t('ses.attention')}</span>
      <span />
    </div>
  );
}

/**
 * One session. Phones (and `columns` off): the date, the title, then the pills on a second line.
 * With `columns`, computers lay the same parts out in columns under SessionColumns.
 */
export function SessionRow({
  session,
  columns,
  timeOnly,
}: {
  session: StaffSession;
  columns?: boolean;
  timeOnly?: boolean;
}) {
  const {t, lang} = useStaffT();
  const when =
    session.starts_at === null
      ? t('staff.dateTbd')
      : timeOnly
        ? formatTime(session.starts_at, lang)
        : `${formatShortDate(session.starts_at, lang)}, ${formatTime(session.starts_at, lang)}`;
  return (
    <li>
      <Link
        to={`/equipo/sesiones/${session.id}/`}
        className={cn(
          rowLink,
          'grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1',
          columns && cn('lg:gap-x-4', SESSION_COLUMNS),
        )}
      >
        {/* Under a "Fecha por confirmar" heading, the row doesn't say it again. */}
        {session.starts_at === null && timeOnly ? null : (
          <span className={cn('col-start-1 text-sm font-semibold leading-5', numbers, columns && 'lg:row-start-1')}>
            {when}
          </span>
        )}
        <span
          className={cn(
            'col-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1',
            columns && 'lg:col-start-2 lg:row-start-1',
          )}
        >
          <Demo synthetic={session.synthetic} />
          <span className="min-w-0 break-words text-base font-medium leading-6">{session.title_es}</span>
        </span>
        <span className={cn('col-start-1 flex flex-wrap items-center gap-2', columns && 'lg:contents')}>
          <span className={cn('flex flex-wrap items-center gap-2', columns && 'lg:col-start-3 lg:row-start-1')}>
            <SessionState state={session.state} />
          </span>
          <span className={cn(columns && 'lg:col-start-4 lg:row-start-1')}>
            <Seats session={session} long />
          </span>
          <span className={cn('flex flex-wrap items-center gap-2', columns && 'lg:col-start-5 lg:row-start-1')}>
            <CountChips inquiries={session.inquiries} pending={session.pending} exceptions={session.exceptions} />
          </span>
        </span>
        <ChevronRight
          className={cn(
            'col-start-2 row-span-3 row-start-1 size-4 text-muted',
            columns && 'lg:col-start-6 lg:row-span-1',
          )}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function SessionRows({
  sessions,
  columns,
  timeOnly,
}: {
  sessions: StaffSession[];
  columns?: boolean;
  timeOnly?: boolean;
}) {
  return (
    <ul className={flushList}>
      {sessions.map(session => (
        <SessionRow key={session.id} session={session} columns={columns} timeOnly={timeOnly} />
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ bookings

const WITH_SESSION = 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_6rem_12rem_1rem]';
const WITHOUT_SESSION = 'lg:grid-cols-[minmax(0,1fr)_6rem_6rem_12rem_1rem]';

export function BookingColumns({showSession}: {showSession?: boolean}) {
  const {t} = useStaffT();
  return (
    <div
      aria-hidden="true"
      className={cn(
        'hidden gap-x-4 px-4 pb-2 text-sm leading-5 text-muted sm:px-6 lg:grid',
        showSession ? WITH_SESSION : WITHOUT_SESSION,
      )}
    >
      <span>{t('bk.lead')}</span>
      {showSession ? <span>{t('bk.session')}</span> : null}
      <span>{t('bk.party')}</span>
      <span>{t('bk.netShort')}</span>
      <span>{t('bk.status')}</span>
      <span />
    </div>
  );
}

/**
 * One reservation, as one link. Phones: the name and reference, the session, then people,
 * amount and status. With `columns`, computers show the same parts in columns.
 */
export function BookingRow({
  booking,
  showSession,
  columns,
}: {
  booking: StaffBookingRow;
  showSession?: boolean;
  columns?: boolean;
}) {
  const {t, lang} = useStaffT();
  const people = booking.party_size === 1 ? t('bk.person') : t('bk.people', {count: booking.party_size});
  const col = (n: number) =>
    columns
      ? ([
          '',
          'lg:col-start-1',
          'lg:col-start-2',
          'lg:col-start-3',
          'lg:col-start-4',
          'lg:col-start-5',
          'lg:col-start-6',
        ][n] ?? '')
      : '';
  const shift = showSession ? 1 : 0;
  return (
    <li>
      <Link
        to={`/equipo/reservaciones/${booking.id}/`}
        className={cn(
          rowLink,
          'grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1',
          columns && cn('lg:gap-x-4', showSession ? WITH_SESSION : WITHOUT_SESSION),
        )}
      >
        <span className={cn('col-start-1 flex min-w-0 flex-col', columns && 'lg:row-start-1')}>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Demo synthetic={booking.synthetic} />
            <span className="min-w-0 break-words text-base font-medium leading-6">{booking.lead_name}</span>
          </span>
          <span className={cn(helper, numbers)}>{booking.reference}</span>
        </span>
        {showSession ? (
          <span className={cn('col-start-1 flex min-w-0 flex-col', helper, columns && 'lg:col-start-2 lg:row-start-1')}>
            <span className="line-clamp-1 text-ink lg:line-clamp-2">{booking.title_es}</span>
            <When ms={booking.starts_at ?? null} />
          </span>
        ) : null}
        <span className={cn('col-start-1 flex flex-wrap items-center gap-x-3 gap-y-2', columns && 'lg:contents')}>
          <span className={cn('text-sm leading-5', numbers, col(2 + shift), columns && 'lg:row-start-1')}>
            {people}
          </span>
          {booking.net > 0 ? (
            <span className={cn('text-sm leading-5', numbers, col(3 + shift), columns && 'lg:row-start-1')}>
              {formatMoney(booking.net, 'USD', lang)}
            </span>
          ) : null}
          <span className={cn('flex flex-wrap items-center gap-2', col(4 + shift), columns && 'lg:row-start-1')}>
            <BookingStatus status={booking.status} />
          </span>
        </span>
        <ChevronRight
          className={cn(
            'col-start-2 row-start-1 size-4 text-muted',
            showSession ? 'row-span-3' : 'row-span-2',
            columns && cn(col(5 + shift), 'lg:row-span-1'),
          )}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function When({ms}: {ms: number | null}) {
  const {t, lang} = useStaffT();
  if (ms === null) return <span>{t('staff.dateTbd')}</span>;
  return (
    <span className={numbers}>
      {formatShortDate(ms, lang)}, <span className="whitespace-nowrap">{formatTime(ms, lang)}</span>
    </span>
  );
}

export function BookingRows({
  bookings,
  showSession,
  columns,
}: {
  bookings: StaffBookingRow[];
  showSession?: boolean;
  columns?: boolean;
}) {
  return (
    <ul className={flushList}>
      {bookings.map(booking => (
        <BookingRow key={booking.id} booking={booking} showSession={showSession} columns={columns} />
      ))}
    </ul>
  );
}
