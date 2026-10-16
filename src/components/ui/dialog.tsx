// Dialogs and sheets on Radix (focus trap, Escape), moved by the shared spring. A sheet rises
// from the bottom on phones and slides in from the right on wide screens. Our dialogs open from
// ordinary buttons (no Radix Trigger), so focus goes back to whatever was focused on open.
// The footer never scrolls, so a form's main action stays in view.
import {Dialog as D} from 'radix-ui';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {X} from 'lucide-react';
import {useLayoutEffect, useRef, type ReactNode} from 'react';
import {cn} from '../../lib/cn.ts';
import {SPRING} from '../../lib/motion.ts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  kind?: 'dialog' | 'sheet';
  /** Wide sheets (520px) hold staff forms; the default is 440px. */
  size?: 'default' | 'wide';
  /** Actions that stay in view below the scrolling body. */
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  kind = 'dialog',
  size = 'default',
  footer,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const sheet = kind === 'sheet';
  const returnTo = useRef<HTMLElement | null>(null);
  // Runs before Radix moves focus into the dialog, so it records the opener.
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnTo.current = document.activeElement;
    }
  }, [open]);
  const enter = reduce ? {opacity: 1} : sheet ? {opacity: 1, y: 0} : {opacity: 1, y: 0, scale: 1};
  const leave = reduce ? {opacity: 0} : sheet ? {opacity: 0, y: 40} : {opacity: 0, y: 12, scale: 0.98};
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-ink/40"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={reduce ? {duration: 0} : {duration: 0.15}}
              />
            </D.Overlay>
            <D.Content
              asChild
              forceMount
              onCloseAutoFocus={event => {
                event.preventDefault();
                if (returnTo.current?.isConnected) returnTo.current.focus();
              }}
            >
              <motion.div
                initial={leave}
                animate={enter}
                exit={leave}
                transition={reduce ? {duration: 0} : SPRING}
                className={cn(
                  'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-surface',
                  'shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)] focus:outline-none',
                  sheet
                    ? cn(
                        'inset-x-0 bottom-0 rounded-b-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:rounded-l-2xl',
                        size === 'wide' ? 'sm:w-[520px]' : 'sm:w-[440px]',
                      )
                    : 'inset-x-4 top-[8dvh] mx-auto max-w-lg sm:inset-x-0',
                  className,
                )}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4 sm:p-6">
                  <div className="min-w-0 space-y-1">
                    <D.Title className="text-[24px] font-medium leading-[1.2] tracking-[-0.025em] text-ink">
                      {title}
                    </D.Title>
                    {description ? (
                      <D.Description className="text-sm leading-5 text-muted">{description}</D.Description>
                    ) : (
                      <D.Description className="sr-only">{title}</D.Description>
                    )}
                  </div>
                  <D.Close
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-ink hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={closeLabel}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </D.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
                {footer ? (
                  <div className="border-t border-border/70 bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    {footer}
                  </div>
                ) : null}
              </motion.div>
            </D.Content>
          </D.Portal>
        ) : null}
      </AnimatePresence>
    </D.Root>
  );
}
