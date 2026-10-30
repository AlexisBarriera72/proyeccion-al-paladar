// The agenda (phones first, and the list view everywhere): one ticket per session, by date, its
// stub showing the day; the ones whose date isn't set yet follow under one heading. Each ticket
// is a link to the session's own page.
import {ChevronRight} from 'lucide-react';
import type {PublicSession} from '../../shared/types.ts';
import {formatLongDate, formatTime, prDateKey} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {pick} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {AvailabilityBadge} from '../components/Status.tsx';
import {Price} from '../components/Price.tsx';
import {Ticket, TicketDate} from '../components/Ticket.tsx';
import {kicker, numbers} from '../lib/styles.ts';
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
    <div className="space-y-5">
      {keys.map(key => {
        const list = groups.get(key)!;
        const tbd = key === 'tbd';
        const heading = tbd ? t('cal.tbdHeading') : formatLongDate(list[0].startsAt!, lang);
        return (
          <section key={key} aria-labelledby={`day-${key}`} className="space-y-2">
            {/* Dated groups: the stubs show the date; the heading carries it for screen readers. */}
            <h3 id={`day-${key}`} className={tbd ? cn(kicker, 'text-muted') : 'sr-only first-letter:uppercase'}>
              {heading}
            </h3>
            <ul className="space-y-3">
              {list.map(session => {
                const selected = session.id === selectedId;
                return (
                  <li key={session.id}>
                    <Link
                      to={`/funciones/${session.id}/`}
                      scroll={scroll}
                      aria-current={selected ? 'true' : undefined}
                      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Ticket
                        stub={<TicketDate ms={session.startsAt} />}
                        className={cn('group-hover:bg-wash', selected && 'border-2 border-accent')}
                        bodyClassName="flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* The time and the status on one line, the title, then the price, so
                              every ticket has the same shape. An undated session's status would
                              only repeat its stub. */}
                          {session.availability === 'date_tbd' && session.startsAt === null ? null : (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {session.startsAt === null ? null : (
                                <p className={cn('text-sm font-semibold leading-5 text-ink', numbers)}>
                                  {formatTime(session.startsAt, lang)}
                                </p>
                              )}
                              {session.availability === 'date_tbd' ? null : (
                                <AvailabilityBadge availability={session.availability} />
                              )}
                            </div>
                          )}
                          <p
                            className={cn(
                              'font-display text-[19px] font-semibold leading-6 text-ink [overflow-wrap:break-word]',
                              session.availability === 'cancelled' && 'line-through',
                            )}
                          >
                            {pick(session.title, lang)}
                          </p>
                          <p className="text-sm leading-5 text-muted">
                            <Price price={session.price} />
                          </p>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                      </Ticket>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
