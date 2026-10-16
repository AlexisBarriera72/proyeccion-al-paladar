// Availability and booking status: an icon and a word, on neutral contrast. Never color alone.
// Shape carries weight: "Disponible" is quiet (no outline); states that limit booking are
// outlined in ink; ended states are muted.
import {Ban, CalendarClock, CircleCheck, CircleX, History, Hourglass, TriangleAlert, UserX} from 'lucide-react';
import type {Availability} from '../../shared/types.ts';
import {useT} from '../lib/i18n.tsx';
import {cn} from '../lib/cn.ts';

const ICONS = {
  available: CircleCheck,
  few_left: Hourglass,
  sold_out: Ban,
  cancelled: CircleX,
  date_tbd: CalendarClock,
  past: History,
} as const;

const pill = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm leading-5';

export function AvailabilityBadge({availability, className}: {availability: Availability; className?: string}) {
  const {t} = useT();
  const Icon = ICONS[availability];
  const strong = availability === 'few_left' || availability === 'sold_out' || availability === 'cancelled';
  return (
    <span
      className={cn(
        pill,
        strong ? 'border-ink font-semibold text-ink' : 'border-stone-400 text-ink',
        availability === 'available' && 'border-transparent pl-0',
        availability === 'past' && 'border-stone-300 text-muted',
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {t(`status.${availability}`)}
    </span>
  );
}

const BOOKING_ICONS = {
  inquiry: Hourglass,
  pending_payment: Hourglass,
  confirmed: CircleCheck,
  exception: TriangleAlert,
  cancelled: CircleX,
  fulfilled: History,
  no_show: UserX,
} as const;

export type BookingStatusName = keyof typeof BOOKING_ICONS;

/** The guest's booking status as an icon and its word, sized for the top of the page. */
export function BookingStatus({status, className}: {status: BookingStatusName; className?: string}) {
  const {t} = useT();
  const Icon = BOOKING_ICONS[status];
  const ended = status === 'cancelled' || status === 'fulfilled' || status === 'no_show';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-base font-semibold leading-6',
        ended ? 'text-muted' : 'text-ink',
        className,
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {t(`bstatus.${status}`)}
    </span>
  );
}
