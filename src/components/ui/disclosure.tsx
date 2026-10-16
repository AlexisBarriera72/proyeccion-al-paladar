// Secondary information behind one button: a 44px summary row with aria-expanded, and a panel
// that opens on the shared spring (at once under reduced motion). No Radix, so the guest
// first-visit bundle stays small.
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {ChevronDown} from 'lucide-react';
import {useId, useState, type ReactNode} from 'react';
import {cn} from '../../lib/cn.ts';
import {SPRING} from '../../lib/motion.ts';

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  variant = 'button',
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** 'button': a full-width secondary row. 'link': an accent text link, for inline use. */
  variant?: 'button' | 'link';
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
        className={cn(
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          variant === 'button'
            ? 'flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-stone-400 bg-surface px-4 py-2.5 text-left text-sm font-medium leading-5 text-ink hover:bg-stone-100'
            : 'inline-flex min-h-11 items-center gap-1.5 rounded-2xl text-left text-sm font-medium leading-5 text-accent underline underline-offset-4 hover:text-accent-hover',
        )}
      >
        <span className="min-w-0">{summary}</span>
        <ChevronDown className={cn('size-4 shrink-0', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="panel"
            initial={reduce ? {opacity: 1} : {height: 0, opacity: 0}}
            animate={reduce ? {opacity: 1} : {height: 'auto', opacity: 1}}
            exit={reduce ? {opacity: 0} : {height: 0, opacity: 0}}
            transition={reduce ? {duration: 0} : SPRING}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
