// The agenda (phones first, and the list view everywhere): sessions by date, then the ones
// whose date isn't set yet. Each card is a link to the session's own page.
import {ChevronRight} from 'lucide-react';
import type {PublicSession} from '../../shared/types.ts';
import {formatLongDate, formatTime, prDateKey} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {pick} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {AvailabilityBadge} from '../components/Status.tsx';
import {Price} from '../components/Price.tsx';
import {numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';

export function Agenda({
  sessions,
  selectedId,
  scroll = true,
}: {
  sessions: PublicSession[];
  selectedId: string | null;
  scroll?: boolean;
}) {
  const {t, lang} = useT();
  const groups = new Map<string, PublicSession[]>();
  for (const session of sessions) {
    const key = session.startsAt === null ? 'tbd' : prDateKey(session.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === 'tbd' ? 1 : b === 'tbd' ? -1 : a.localeCompare(b)));
  return (
    <div className="space-y-6">
      {keys.map(key => {
        const list = groups.get(key)!;
        const heading = key === 'tbd' ? t('cal.tbdHeading') : formatLongDate(list[0].startsAt!, lang);
        return (
          <section key={key} aria-labelledby={`day-${key}`} className="space-y-2">
            <h3
              id={`day-${key}`}
              className={cn('text-sm font-semibold leading-5 text-muted first-letter:uppercase', numbers)}
            >
              {heading}
            </h3>
            <ul className="space-y-2">
              {list.map(session => (
                <li key={session.id}>
                  <Link
                    to={`/funciones/${session.id}/`}
                    scroll={scroll}
                    aria-current={session.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border bg-surface p-3 hover:bg-stone-50 sm:p-4',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      session.id === selectedId ? 'border-2 border-accent' : 'border-stone-300',
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={cn('text-sm font-semibold leading-5 text-ink', numbers)}>
                        {session.startsAt === null ? t('cal.tbdHeading') : formatTime(session.startsAt, lang)}
                      </p>
                      <p
                        className={cn(
                          'text-base font-medium leading-6 text-ink',
                          session.availability === 'cancelled' && 'line-through',
                        )}
                      >
                        {pick(session.title, lang)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <AvailabilityBadge availability={session.availability} />
                        <span className="text-sm leading-5 text-muted">
                          <Price price={session.price} />
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
