// Availability and booking status: an icon and a word, on neutral contrast. Never color alone.
import {Ban, CalendarClock, CircleCheck, CircleX, History, Hourglass} from 'lucide-react';
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

export function AvailabilityBadge({availability, className}: {availability: Availability; className?: string}) {
  const {t} = useT();
  const Icon = ICONS[availability];
  const strong = availability === 'few_left' || availability === 'sold_out' || availability === 'cancelled';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm leading-5',
        strong ? 'border-ink font-semibold text-ink' : 'border-stone-400 text-ink',
        availability === 'past' && 'border-stone-300 text-muted',
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {t(`status.${availability}`)}
    </span>
  );
}
