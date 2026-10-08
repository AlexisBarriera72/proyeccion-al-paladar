// Actions, with the brief's classes. Motion: a 0.98 press on enabled buttons (none under
// reduced motion); hover is a background shift. Hit areas never move.
import {forwardRef, type ButtonHTMLAttributes} from 'react';
import {motion} from 'motion/react';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/cn.ts';
import {useTap} from '../../lib/motion.ts';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium leading-5 ' +
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
      },
      width: {auto: '', full: 'w-full'},
    },
    defaultVariants: {variant: 'secondary', width: 'auto'},
  },
);

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {className, variant, width, type = 'button', disabled, ...props},
  ref,
) {
  const tap = useTap();
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : tap}
      className={cn(buttonVariants({variant, width}), className)}
      {...props}
    />
  );
});
