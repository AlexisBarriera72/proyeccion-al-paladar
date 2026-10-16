// A tear-off date: weekday, day number and month in a 56px column beside the text, so cards
// don't grow taller. Below 22rem it lies flat on one line. The full date is in the text
// next to it, so the stub is hidden from screen readers.
import {stubParts} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {cn} from '../lib/cn.ts';
import {numbers} from '../lib/styles.ts';

export function DateStub({ms, className}: {ms: number; className?: string}) {
  const {lang} = useT();
  const {weekday, day, month} = stubParts(ms, lang);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-baseline gap-1.5 self-start text-ink',
        'min-[22rem]:w-14 min-[22rem]:flex-col min-[22rem]:items-center min-[22rem]:gap-0 min-[22rem]:rounded-2xl min-[22rem]:border min-[22rem]:border-stone-300 min-[22rem]:bg-surface min-[22rem]:py-1.5',
        className,
      )}
    >
      <span className="text-sm leading-5 text-muted first-letter:uppercase">{weekday}</span>
      <span className={cn('text-[24px] font-medium leading-[1.2] tracking-[-0.025em]', numbers)}>{day}</span>
      <span className="text-sm leading-5 text-muted">{month}</span>
    </span>
  );
}
