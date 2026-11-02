// The calendar: "/" and "/funciones/:id/". The dark band holds the title and their phrase; on
// paper below, computers get the month grid (or the list) with a 360px panel for the selected
// session or the next date, and phones get the agenda first, while a session opens on its own
// page. When no date is left this month, it opens on the next date's month and says so.
// Loading keeps its size; errors offer a retry; empty states say so.
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {motion} from 'motion/react';
import {CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, List, RotateCw} from 'lucide-react';
import type {PublicSession} from '../../shared/types.ts';
import {
  addMonths,
  formatLongDate,
  formatMonth,
  formatTime,
  monthGrid,
  prDateKey,
  prDateParts,
  prMonthBounds,
} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {useMediaQuery} from '../lib/media.ts';
import {useEntry} from '../lib/motion.ts';
import {navigate, Link} from '../lib/router.tsx';
import {readJson, writeJson} from '../lib/storage.ts';
import {pick} from '../lib/format.ts';
import {detailTitle, helper, inset, kicker, motto, numbers, pageTitle, panel, workspace} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {Switch} from '../components/ui/tabs.tsx';
import {Photo} from '../components/Photo.tsx';
import {AvailabilityBadge} from '../components/Status.tsx';
import {Ticket, TicketDate} from '../components/Ticket.tsx';
import {PageBand, PageSheet} from '../components/Band.tsx';
import {MonthGrid} from './MonthGrid.tsx';
import {Agenda} from './Agenda.tsx';
import {SessionDetail} from './SessionDetail.tsx';
import {fetchSession, useSessions} from './data.ts';

type View = 'grid' | 'list';
type Month = {year: number; month: number};
type Selected =
  | {state: 'none'}
  | {state: 'loading'}
  | {state: 'missing'}
  | {state: 'error'}
  | {state: 'ready'; session: PublicSession};

const INSTAGRAM = 'https://www.instagram.com/proyeccionalpaladarpr/';
// The calendar is a panel from sm up; on phones it sits on the page, so its cards aren't nested.
const panelWide =
  'sm:rounded-2xl sm:border sm:border-border/50 sm:bg-surface sm:p-6 sm:shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]';
const inMonth = (ms: number, m: Month) => {
  const p = prDateParts(ms);
  return p.year === m.year && p.month === m.month;
};

/** The selected session: from the loaded list, or fetched on its own (a past or older date). */
function useSelected(id: string | null, list: PublicSession[] | null, listLoading: boolean): [Selected, () => void] {
  const fromList = id && list ? (list.find(session => session.id === id) ?? null) : null;
  const [fetched, setFetched] = useState<{id: string; value: PublicSession | null | 'error'} | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!id || fromList || listLoading) return;
    let alive = true;
    setFetched(null);
    void fetchSession(id).then(value => {
      if (alive) setFetched({id, value});
    });
    return () => {
      alive = false;
    };
  }, [id, fromList, listLoading, tick]);
  const refresh = () => setTick(n => n + 1);
  if (!id) return [{state: 'none'}, refresh];
  if (fromList) return [{state: 'ready', session: fromList}, refresh];
  if (listLoading || !fetched || fetched.id !== id) return [{state: 'loading'}, refresh];
  if (fetched.value === 'error') return [{state: 'error'}, refresh];
  return [fetched.value ? {state: 'ready', session: fetched.value} : {state: 'missing'}, refresh];
}

function Problem({message, onRetry}: {message: string; onRetry: () => void}) {
  const {t} = useT();
  return (
    <div role="alert" className="space-y-3 rounded-2xl border border-stone-400 bg-surface p-4">
      <p className="text-base leading-6 text-ink">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        {t('app.retry')}
      </Button>
    </div>
  );
}

function DetailState({
  selected,
  variant,
  onRetry,
  onChanged,
}: {
  selected: Selected;
  variant: 'panel' | 'page';
  onRetry: () => void;
  onChanged: () => void;
}) {
  const {t} = useT();
  const entry = useEntry();
  if (selected.state === 'ready')
    // One instance per session: a sheet's draft and receipt belong to the session they were made for.
    return (
      <SessionDetail key={selected.session.id} session={selected.session} variant={variant} onChanged={onChanged} />
    );
  if (selected.state === 'none') return null;

  let body: ReactNode;
  if (selected.state === 'loading') {
    body = (
      <div aria-busy="true" className="space-y-4">
        <p className="sr-only">{t('app.loading')}</p>
        {variant === 'panel' ? (
          <>
            <div className="h-8 w-3/4 rounded-xl bg-stone-200" />
            <div className="h-6 w-1/3 rounded-full bg-stone-200" />
          </>
        ) : null}
        <div className="h-40 rounded-2xl bg-stone-200" />
        <div className="h-24 rounded-2xl bg-stone-100" />
      </div>
    );
  } else if (selected.state === 'error') {
    body = <Problem message={t('detail.loadError')} onRetry={onRetry} />;
  } else {
    body =
      variant === 'panel' ? (
        <div className="space-y-4">
          <h2 data-focus tabIndex={-1} className={cn(detailTitle, 'focus:outline-none')}>
            {t('detail.notFound')}
          </h2>
          <Link to="/" scroll={false} className={buttonVariants({variant: 'secondary'})}>
            {t('detail.back')}
          </Link>
        </div>
      ) : null;
  }
  if (variant === 'panel') return body;

  // A page of its own (phones): the band with the way back, then the state on paper.
  return (
    <>
      <PageBand>
        <motion.div variants={entry.item} className="space-y-4">
          <Link to="/" className={cn(buttonVariants({variant: 'onSala'}), '-ml-3')}>
            <ChevronLeft aria-hidden="true" />
            {t('detail.back')}
          </Link>
          {selected.state === 'missing' ? (
            <h1 data-focus tabIndex={-1} className={cn(pageTitle, 'text-on-sala focus:outline-none')}>
              {t('detail.notFound')}
            </h1>
          ) : selected.state === 'loading' ? (
            <div aria-hidden="true" className="h-10 w-3/4 rounded-xl bg-sala-raised" />
          ) : null}
        </motion.div>
      </PageBand>
      {body ? (
        <PageSheet>
          <motion.div variants={entry.item} className="max-w-2xl">
            {body}
          </motion.div>
        </PageSheet>
      ) : null}
    </>
  );
}

/** Phones' calendar option: days with sessions are buttons; choosing one filters the agenda. */
function MiniMonth({
  month,
  sessions,
  todayKey,
  day,
  onDay,
}: {
  month: Month;
  sessions: PublicSession[];
  todayKey: string;
  day: string | null;
  onDay: (key: string | null) => void;
}) {
  const {t, lang} = useT();
  const counts = new Map<string, number>();
  for (const session of sessions) {
    if (session.startsAt !== null)
      counts.set(prDateKey(session.startsAt), (counts.get(prDateKey(session.startsAt)) ?? 0) + 1);
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
              const today = key === todayKey;
              if (!count) {
                return (
                  <td key={i} className="h-11 text-center">
                    <span
                      className={cn(
                        'text-sm leading-5',
                        numbers,
                        today ? 'font-semibold text-ink underline' : 'text-muted',
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
                      day === key ? 'border-2 border-accent text-ink' : 'border-stone-300 text-ink hover:bg-stone-100',
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

/** The next date, as a ticket. Its height is fixed, so the panel doesn't move when it arrives. */
function NextTicket({next, onOpen}: {next: PublicSession; onOpen: (session: PublicSession) => void}) {
  const {t, lang} = useT();
  return (
    <Ticket
      tone="wash"
      stub={<TicketDate ms={next.startsAt} />}
      className="h-[192px]"
      bodyClassName="flex flex-col justify-between gap-3"
    >
      <div className="min-w-0 space-y-1">
        <p className={cn(kicker, 'text-accent')}>{t('intro.next')}</p>
        <p className="line-clamp-2 font-display text-[20px] font-semibold leading-6 text-ink">
          {pick(next.title, lang)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {next.startsAt !== null ? (
            <p className={cn('text-sm font-semibold leading-5 text-ink', numbers)}>
              <span className="sr-only">{formatLongDate(next.startsAt, lang)}, </span>
              {formatTime(next.startsAt, lang)}
            </p>
          ) : null}
          <AvailabilityBadge availability={next.availability} />
        </div>
      </div>
      <Button variant="primary" onClick={() => onOpen(next)} className="self-start">
        {t('action.view')}
      </Button>
    </Ticket>
  );
}

/** Their phrase, quoted and attributed: in the band on wider screens, under the photo on phones. */
function Motto({tone}: {tone: 'sala' | 'paper'}) {
  const {t} = useT();
  return (
    <figure className="space-y-1">
      {/* Their own words, in Spanish on the English page too. */}
      <blockquote lang="es" className={cn(motto, tone === 'sala' ? 'text-on-sala' : 'text-ink')}>
        {t('app.motto')}
      </blockquote>
      <figcaption className={tone === 'sala' ? 'text-sm leading-5 text-on-sala-muted' : helper}>
        {t('intro.quoteSource')}
      </figcaption>
    </figure>
  );
}

/**
 * Computers, when no session is chosen: the next date (its place kept while the dates load,
 * so nothing shifts), then the A18 photo with its caption, and how to choose.
 */
function SideIntro({next, onOpen}: {next: PublicSession | null | 'loading'; onOpen: (session: PublicSession) => void}) {
  const {t} = useT();
  return (
    <section aria-label={t('intro.next')} className="space-y-5">
      {next === 'loading' ? (
        <div aria-hidden="true" className="h-[192px] rounded-2xl bg-wash" />
      ) : next ? (
        <NextTicket next={next} onOpen={onOpen} />
      ) : null}
      <Photo slot="room" sizes="312px" priority aspect="4 / 3" />
      <p className={helper}>{t('intro.pick')}</p>
    </section>
  );
}

/** Phones and tablets, after the agenda: the photo, their phrase and their wording. */
function PhoneIntro() {
  const {t} = useT();
  return (
    <section aria-label={t('app.motto')} className="space-y-4">
      <Photo slot="room" sizes="(min-width: 640px) 560px, 100vw" aspect="4 / 3" />
      {/* From 640px the phrase is in the band. */}
      <div className="sm:hidden">
        <Motto tone="paper" />
      </div>
      <p className="text-base leading-6 text-ink">{t('intro.body')}</p>
    </section>
  );
}

export function CalendarPage({sessionId}: {sessionId: string | null}) {
  const {t, lang} = useT();
  const config = useConfig();
  const entry = useEntry();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [clientNow] = useState(() => Date.now());
  const now = config?.now ?? clientNow;
  const current: Month = useMemo(() => {
    const p = prDateParts(now);
    return {year: p.year, month: p.month};
  }, [now]);
  const from = prMonthBounds(current.year, current.month)[0];
  const todayKey = prDateKey(now);
  const {load, reload} = useSessions(from);
  const list = load.state === 'ready' ? load.data : null;
  const [selected, refreshSelected] = useSelected(sessionId, list, load.state === 'loading');

  const [month, setMonth] = useState<Month>(current);
  const [day, setDay] = useState<string | null>(null);
  const [experience, setExperience] = useState('all');
  const [viewPref, setViewPref] = useState<View | null>(() => readJson<View>('session', 'pap-view'));
  const view: View = viewPref ?? (wide ? 'grid' : 'list');
  const instagram = config?.instagramUrl ?? INSTAGRAM;

  // The server's clock decides "this month" once it is known.
  useEffect(() => setMonth(m => (m.year * 12 + m.month < current.year * 12 + current.month ? current : m)), [current]);

  // A shared link opens on its session's month.
  const selectedStart = selected.state === 'ready' ? selected.session.startsAt : null;
  useEffect(() => {
    if (selectedStart === null) return;
    const p = prDateParts(selectedStart);
    if (p.year * 12 + p.month >= current.year * 12 + current.month) setMonth({year: p.year, month: p.month});
    // Only when the selected session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, selectedStart]);

  // When no date is left this month, open on the next date's month, once, before the person
  // moves through the months; the line under the controls says so. It waits for the server's
  // clock, so a device clock on the other side of midnight can't pick the wrong month.
  const [jumped, setJumped] = useState<Month | null>(null);
  const settled = useRef(false);
  useEffect(() => {
    if (settled.current || !list || !config) return;
    settled.current = true;
    if (sessionId) return;
    const upcoming = list.filter(
      session => session.startsAt !== null && session.startsAt >= now && session.availability !== 'cancelled',
    );
    if (!upcoming.length || upcoming.some(session => inMonth(session.startsAt!, current))) return;
    const p = prDateParts(upcoming[0].startsAt!);
    const target = {year: p.year, month: p.month};
    setMonth(target);
    setJumped(target);
  }, [list, sessionId, now, current, config]);

  useEffect(() => {
    document.title =
      selected.state === 'ready'
        ? `${pick(selected.session.title, lang)} · ${t('app.name')}`
        : `${t('app.name')} · ${t('cal.heading')}`;
  }, [selected, lang, t]);

  const sessions = list ?? [];
  const experiences = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions)
      if (!seen.has(session.experienceId)) seen.set(session.experienceId, pick(session.title, lang));
    return [...seen.entries()].map(([value, label]) => ({value, label}));
  }, [sessions, lang]);
  const filtered = experience === 'all' ? sessions : sessions.filter(session => session.experienceId === experience);
  const dated = filtered.filter(session => session.startsAt !== null && inMonth(session.startsAt, month));
  const undated = filtered.filter(session => session.startsAt === null);
  const monthEnd = prMonthBounds(month.year, month.month)[1];
  const nextLater = filtered.find(session => session.startsAt !== null && session.startsAt >= monthEnd) ?? null;
  const nextBookable =
    sessions.find(session => session.startsAt !== null && session.startsAt > now && session.action !== 'none') ??
    sessions.find(session => session.action !== 'none') ??
    null;
  const isCurrent = month.year === current.year && month.month === current.month;

  const changeMonth = (delta: number) => {
    settled.current = true;
    setJumped(null);
    setDay(null);
    setMonth(m => addMonths(m.year, m.month, delta));
  };
  const goToday = () => {
    settled.current = true;
    setJumped(null);
    setDay(null);
    setMonth(current);
  };
  const chooseView = (next: View) => {
    setViewPref(next);
    writeJson('session', 'pap-view', next);
  };
  const open = (session: PublicSession) => navigate(`/funciones/${session.id}/`, {scroll: !wide});
  const refresh = () => {
    void reload(true);
    refreshSelected();
  };

  // Phones: a session opens on its own page, with its own band.
  if (sessionId && !wide) {
    return (
      <motion.div variants={entry.page} initial="hidden" animate="show">
        <DetailState selected={selected} variant="page" onRetry={refresh} onChanged={refresh} />
      </motion.div>
    );
  }

  // Phones: the month on its own row, then Hoy and the view switch, then the filter.
  // Computers: one row. The filter (only with more than one experience) appears after the
  // dates load, so it sits at the row's end and never pushes the calendar down.
  const controls = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-y-3">
      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
        <Button
          variant="ghost"
          aria-label={t('cal.prev')}
          disabled={isCurrent}
          onClick={() => changeMonth(-1)}
          className="w-11 px-0"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2
          aria-live="polite"
          className={cn(
            'min-w-0 flex-1 text-center text-base font-semibold leading-6 text-ink first-letter:uppercase sm:min-w-40 sm:flex-none',
            numbers,
          )}
        >
          {formatMonth(month.year, month.month, lang)}
        </h2>
        <Button variant="ghost" aria-label={t('cal.next')} onClick={() => changeMonth(1)} className="w-11 px-0">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <Button variant="secondary" onClick={goToday}>
        {t('cal.today')}
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
          <span className="sr-only">{t('cal.filter')}</span>
          {/* A native select: light for the first visit and familiar on phones. */}
          <select
            value={experience}
            onChange={event => {
              setExperience(event.target.value);
              setDay(null);
            }}
            className="min-h-11 w-full appearance-none rounded-2xl border border-stone-500 bg-surface py-2 pl-4 pr-10 text-sm font-medium leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="all">{`${t('cal.filter')}: ${t('cal.filterAll')}`}</option>
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

  let content: ReactNode;
  if (load.state === 'error') {
    content = <Problem message={t('cal.loadError')} onRetry={() => void reload()} />;
  } else if (load.state === 'ready' && sessions.length === 0) {
    content = (
      <div className={cn(inset, 'space-y-3')}>
        <p className="text-base leading-6 text-ink">{t('cal.empty')}</p>
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({variant: 'secondary'})}
        >
          <ExternalLink aria-hidden="true" />
          {t('cal.openInstagram')}
        </a>
      </div>
    );
  } else {
    const loading = load.state === 'loading';
    const emptyMonth =
      !loading && dated.length === 0 ? (
        <div className={cn(inset, 'space-y-3')}>
          <p className="text-base leading-6 text-ink">{t('cal.emptyMonth')}</p>
          {nextLater?.startsAt != null ? (
            <Button
              variant="secondary"
              onClick={() => {
                const p = prDateParts(nextLater.startsAt!);
                setDay(null);
                setMonth({year: p.year, month: p.month});
              }}
            >
              {t('cal.nextDate')}
            </Button>
          ) : null}
        </div>
      ) : null;
    const undatedList = undated.length ? <Agenda sessions={undated} selectedId={sessionId} scroll={!wide} /> : null;
    if (view === 'grid' && wide) {
      content = (
        <div className="space-y-6" aria-busy={loading}>
          <MonthGrid
            year={month.year}
            month={month.month}
            sessions={loading ? [] : dated}
            selectedId={sessionId}
            todayKey={todayKey}
            onSelect={open}
          />
          {emptyMonth}
          {undatedList}
        </div>
      );
    } else if (view === 'grid') {
      const shown = day ? dated.filter(session => prDateKey(session.startsAt!) === day) : dated;
      content = (
        <div className="space-y-4" aria-busy={loading}>
          <MiniMonth month={month} sessions={loading ? [] : dated} todayKey={todayKey} day={day} onDay={setDay} />
          {day ? (
            <Button variant="ghost" onClick={() => setDay(null)} className="-ml-3">
              {t('cal.showMonth')}
            </Button>
          ) : null}
          {loading ? null : shown.length ? (
            <Agenda sessions={shown} selectedId={sessionId} scroll={!wide} />
          ) : (
            emptyMonth
          )}
          {day ? null : undatedList}
        </div>
      );
    } else {
      content = loading ? (
        <div aria-busy="true" className="space-y-2">
          <p className="sr-only">{t('app.loading')}</p>
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[136px] rounded-2xl border border-border bg-wash" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {dated.length ? <Agenda sessions={dated} selectedId={sessionId} scroll={!wide} /> : emptyMonth}
          {undatedList}
        </div>
      );
    }
  }

  // "No dates left this month" only makes sense on a later month than the current one.
  const jumpedHere = jumped !== null && !isCurrent && jumped.year === month.year && jumped.month === month.month;

  return (
    <motion.div variants={entry.page} initial="hidden" animate="show">
      {/* The band: the title, and their phrase from 640px (on phones it follows the agenda). */}
      <PageBand>
        <motion.div
          variants={entry.item}
          className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <h1 id="calendar-heading" tabIndex={-1} className={cn(pageTitle, 'text-on-sala focus:outline-none')}>
            {t('cal.heading')}
          </h1>
          <div className="hidden sm:block">
            <Motto tone="sala" />
          </div>
        </motion.div>
      </PageBand>
      <PageSheet>
        <div className={workspace}>
          <motion.section
            variants={entry.item}
            aria-label={t('cal.heading')}
            className={cn(panelWide, 'min-w-0 space-y-4 lg:self-start')}
          >
            {controls}
            <p className={helper}>
              {/* A live region from the start, so the month-end line is announced when it appears. */}
              <span role="status">
                {jumpedHere ? `${t('cal.jumped', {month: formatMonth(month.year, month.month, lang)})} ` : ''}
              </span>
              {t('cal.tz')}
            </p>
            {content}
          </motion.section>
          {wide ? (
            <motion.div variants={entry.item} className={cn(panel, 'lg:sticky lg:top-4 lg:self-start')}>
              {selected.state === 'none' ? (
                <SideIntro next={load.state === 'loading' ? 'loading' : nextBookable} onOpen={open} />
              ) : (
                <DetailState selected={selected} variant="panel" onRetry={refresh} onChanged={refresh} />
              )}
            </motion.div>
          ) : (
            <motion.div variants={entry.item} className={panel}>
              <PhoneIntro />
            </motion.div>
          )}
        </div>
      </PageSheet>
    </motion.div>
  );
}
