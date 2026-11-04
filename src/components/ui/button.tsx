// Actions. Motion: a 0.98 press on enabled buttons (none under reduced motion); hover is a
// background shift. Hit areas never move. Amber on paper; brass and ivory on the dark band.
import {forwardRef, type ButtonHTMLAttributes} from 'react';
import {motion} from 'motion/react';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/cn.ts';
import {useTap} from '../../lib/motion.ts';

const variants = cva(
  'inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium leading-5 ' +
    // Never wider than its container: at 200% zoom a long label breaks instead of running off.
    '[overflow-wrap:anywhere] ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'border border-stone-400 bg-surface text-ink hover:bg-stone-100',
        // Destructive actions: neutral contrast, an explicit label and an icon, never red.
        quiet: 'border border-stone-500 bg-surface text-ink hover:bg-stone-100',
        ghost: 'text-ink hover:bg-stone-100',
        link: 'min-h-0 px-0 py-0 text-accent underline underline-offset-4 hover:text-accent-hover',
        // On the dark band: a quiet ivory action, and brass for the main one.
        onSala: 'text-on-sala hover:bg-sala-raised focus-visible:outline-brass',
        brass: 'bg-brass text-sala hover:bg-brass-hover focus-visible:outline-brass',
      },
      width: {auto: '', full: 'w-full'},
    },
    defaultVariants: {variant: 'secondary', width: 'auto'},
  },
);

/** The classes for a variant, merged, so a variant's padding replaces the base padding. */
export const buttonVariants = (props?: VariantProps<typeof variants>) => cn(variants(props));

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
> &
  VariantProps<typeof buttonVariants> & {
    /**
     * A request is running. The button looks unavailable and ignores presses (and a form's Enter),
     * but it keeps focus: a disabled button would drop keyboard focus to the page, and a refusal
     * would then leave the person nowhere.
     */
    busy?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {className, variant, width, type = 'button', disabled, busy, onClick, ...props},
  ref,
) {
  const tap = useTap();
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      whileTap={disabled || busy ? undefined : tap}
      onClick={busy ? event => event.preventDefault() : onClick}
      className={cn(buttonVariants({variant, width}), busy && 'cursor-not-allowed opacity-60', className)}
      {...props}
    />
  );
});
