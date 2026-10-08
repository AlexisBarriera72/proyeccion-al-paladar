// The month grid (computers): a table with a caption, weekday headers and session cards in
// each day. Cards are buttons reachable with Tab. Cells never move; only the selection
// indicator glides between cards (a spring; none under reduced motion).
import {motion} from 'motion/react';
import {Ban, CircleX, History, Hourglass} from 'lucide-react';
import type {PublicSession} from '../../shared/types.ts';
import {formatShortDate, formatTime, monthGrid, prDateKey, formatMonth} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {pick} from '../lib/format.ts';
import {SPRING} from '../lib/motion.ts';
import {numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';

const MARK = {sold_out: Ban, cancelled: CircleX, past: History, few_left: Hourglass} as const;

export function MonthGrid({
  year,
  month,
  sessions,
  selectedId,
  todayKey,
  onSelect,
}: {
  year: number;
  month: number;
  sessions: PublicSession[];
  selectedId: string | null;
  todayKey: string;
  onSelect: (session: PublicSession) => void;
}) {
  const {t, lang} = useT();
  const weekdays = t('cal.weekdays').split(',');
  const byDay = new Map<string, PublicSession[]>();
  for (const session of sessions) {
    if (session.startsAt === null) continue;
    const key = prDateKey(session.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const cells = monthGrid(year, month);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const keyOf = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{formatMonth(year, month, lang)}</caption>
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
              const today = key === todayKey;
              return (
                <td key={d} className="h-28 border border-border/60 p-1.5 align-top">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex size-7 items-center justify-center rounded-full text-sm leading-5',
                        numbers,
                        today ? 'bg-ink font-semibold text-white' : 'text-ink',
                      )}
                    >
                      {day}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {list.map(session => {
                      const selected = session.id === selectedId;
                      const Mark = MARK[session.availability as keyof typeof MARK];
                      const label = `${formatShortDate(session.startsAt!, lang)}, ${formatTime(session.startsAt!, lang)}. ${pick(session.title, lang)}. ${t(`status.${session.availability}`)}.`;
                      return (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(session)}
                            aria-label={label}
                            aria-pressed={selected}
                            className={cn(
                              'relative block w-full rounded-lg border px-1.5 py-1 text-left text-[13px] leading-4 hover:bg-stone-100',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                              selected ? 'border-transparent' : 'border-stone-300',
                              (session.availability === 'past' || session.availability === 'cancelled') && 'text-muted',
                            )}
                          >
                            {selected ? (
                              <motion.span
                                layoutId="selected-session"
                                transition={SPRING}
                                aria-hidden="true"
                                className="absolute inset-0 rounded-lg border-2 border-accent"
                              />
                            ) : null}
                            <span className={cn('flex items-center gap-1 font-semibold', numbers)}>
                              {formatTime(session.startsAt!, lang)}
                              {Mark ? <Mark className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                            </span>
                            <span
                              className={cn('line-clamp-2', session.availability === 'cancelled' && 'line-through')}
                            >
                              {pick(session.title, lang)}
                            </span>
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
