// A ticket: a stub with the date and a body, divided by a perforation, with two notches cut
// where they meet. The next date, the agenda's dates and a confirmed reservation use it. A
// request or a reservation waiting for payment never does: it doesn't hold a place yet.
import type {ReactNode} from 'react';
import {CalendarClock} from 'lucide-react';
import {stubParts} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {cn} from '../lib/cn.ts';
import {kicker, numbers} from '../lib/styles.ts';

export function Ticket({
  stub,
  children,
  tone = 'paper',
  className,
  bodyClassName,
}: {
  stub: ReactNode;
  children: ReactNode;
  /** 'ivory' on the dark band; 'paper' (with a border) on the page; 'wash' inside a panel. */
  tone?: 'ivory' | 'paper' | 'wash';
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        'ticket-cut grid rounded-2xl text-ink',
        // Very narrow (200% zoom on a phone): the stub lies flat above the body, with no notches.
        'grid-cols-1 [--ticket-notch:0px] min-[16rem]:grid-cols-[var(--stub)_minmax(0,1fr)] min-[16rem]:[--ticket-notch:0.625rem]',
        '[--stub:4.75rem] min-[24rem]:[--stub:5.5rem]',
        tone === 'ivory' ? 'bg-ticket' : tone === 'wash' ? 'bg-wash' : 'border border-border bg-surface',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-start border-b-2 border-dashed border-border px-4 py-2',
          'min-[16rem]:justify-center min-[16rem]:border-b-0 min-[16rem]:border-r-2 min-[16rem]:px-1 min-[16rem]:py-3',
        )}
      >
        {stub}
      </div>
      <div className={cn('min-w-0 p-4', bodyClassName)}>{children}</div>
    </div>
  );
}

/**
 * The stub's date: weekday, a large day number and the month. The full date is in the text
 * beside it (or in a heading), so the stub is hidden from screen readers. No date yet: an icon
 * and "Fecha por confirmar".
 */
export function TicketDate({ms, className}: {ms: number | null; className?: string}) {
  const {t, lang} = useT();
  if (ms === null) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center gap-2 text-accent min-[16rem]:flex-col min-[16rem]:gap-1 min-[16rem]:text-center',
          className,
        )}
      >
        <CalendarClock className="size-6" />
        <span className="text-xs font-semibold leading-4 [overflow-wrap:normal]">{t('ticket.tbd')}</span>
      </span>
    );
  }
  const {weekday, day, month} = stubParts(ms, lang);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-baseline gap-2 text-accent min-[16rem]:flex-col min-[16rem]:items-center min-[16rem]:gap-0',
        className,
      )}
    >
      <span className={kicker}>{weekday}</span>
      <span className={cn('font-display text-[28px] font-semibold leading-[1.05] min-[16rem]:text-[40px]', numbers)}>
        {day}
      </span>
      <span className={kicker}>{month}</span>
    </span>
  );
}
