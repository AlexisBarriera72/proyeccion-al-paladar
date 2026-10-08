// The brief's motion (research/BUILD_PROMPT.md §0). One spring for structural movement; a
// short stagger for the page header and panels only; nothing moves under reduced motion.
import {useReducedMotion, useMotionValue, useSpring, type Variants} from 'motion/react';
import {useCallback, type PointerEvent} from 'react';
import {useMediaQuery} from './media.ts';

export const SPRING = {type: 'spring', stiffness: 300, damping: 30} as const;

export const pageVariants: Variants = {
  hidden: {},
  show: {transition: {staggerChildren: 0.05}},
};

export const itemVariants: Variants = {
  hidden: {opacity: 0, y: 12},
  show: {opacity: 1, y: 0, transition: SPRING},
};

/** The variants to use: entry without movement or delays under reduced motion. */
export function useEntry() {
  const reduce = useReducedMotion();
  return reduce
    ? {
        page: {hidden: {}, show: {}} as Variants,
        item: {hidden: {opacity: 1, y: 0}, show: {opacity: 1, y: 0}} as Variants,
      }
    : {page: pageVariants, item: itemVariants};
}

/** whileTap for action buttons, or nothing under reduced motion. */
export function useTap() {
  return useReducedMotion() ? undefined : {scale: 0.98};
}

/**
 * A subtle magnetic pull for the main CTA only: on a fine pointer with hover, at most 3px,
 * springing back on exit. The hit area never moves (the effect is on an inner element).
 * The pointer check is read during render, so the first mouse move already counts.
 */
export function useMagnetic(maxShift = 3) {
  const reduce = useReducedMotion();
  const enabled = useMediaQuery('(hover: hover) and (pointer: fine)') && !reduce;
  const x = useSpring(useMotionValue(0), {stiffness: 300, damping: 30});
  const y = useSpring(useMotionValue(0), {stiffness: 300, damping: 30});
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType !== 'mouse') return;
      const box = event.currentTarget.getBoundingClientRect();
      const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
      x.set(Math.max(-1, Math.min(1, dx)) * maxShift);
      y.set(Math.max(-1, Math.min(1, dy)) * maxShift);
    },
    [enabled, maxShift, x, y],
  );
  const onPointerLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);
  return {enabled, style: enabled ? {x, y} : undefined, handlers: enabled ? {onPointerMove, onPointerLeave} : {}};
}
