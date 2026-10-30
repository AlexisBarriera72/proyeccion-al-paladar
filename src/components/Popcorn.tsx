// A short burst of popcorn for the one moment the server confirms a reservation: never for a
// request, a copied message or a reopened receipt. Decoration only: hidden from screen readers,
// no pointer events, and nothing at all under reduced motion. The kernels stay in place at the
// end, faded out, until the receipt closes.
import {motion, useReducedMotion} from 'motion/react';

// Fixed, so every burst looks the same: where each kernel flies (px), how high it rises, its
// turn, size and delay.
const KERNELS = [
  {x: -150, peak: -110, fall: 70, turn: -200, size: 22, delay: 0},
  {x: -110, peak: -150, fall: 40, turn: 160, size: 18, delay: 0.04},
  {x: -70, peak: -175, fall: 90, turn: -120, size: 24, delay: 0.02},
  {x: -30, peak: -190, fall: 60, turn: 220, size: 16, delay: 0.08},
  {x: 10, peak: -200, fall: 110, turn: -180, size: 22, delay: 0.03},
  {x: 45, peak: -180, fall: 50, turn: 140, size: 18, delay: 0.06},
  {x: 85, peak: -160, fall: 95, turn: -240, size: 24, delay: 0.01},
  {x: 120, peak: -135, fall: 45, turn: 200, size: 16, delay: 0.07},
  {x: 155, peak: -100, fall: 80, turn: -160, size: 20, delay: 0.05},
  {x: -90, peak: -95, fall: 120, turn: 120, size: 14, delay: 0.1},
  {x: 70, peak: -105, fall: 130, turn: -140, size: 14, delay: 0.09},
  {x: -10, peak: -130, fall: 140, turn: 260, size: 18, delay: 0.12},
];

function Kernel() {
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      <circle cx="8.5" cy="10" r="5.2" fill="#fff7e8" stroke="#e2a13f" strokeWidth="0.8" />
      <circle cx="15.5" cy="9" r="5.2" fill="#fff7e8" stroke="#e2a13f" strokeWidth="0.8" />
      <circle cx="12" cy="14.5" r="5.6" fill="#fff7e8" stroke="#e2a13f" strokeWidth="0.8" />
      <circle cx="12" cy="18.5" r="2.2" fill="#e2a13f" />
    </svg>
  );
}

export function Popcorn({active}: {active: boolean}) {
  const reduce = useReducedMotion();
  if (!active || reduce) return null;
  return (
    <div
      aria-hidden="true"
      data-popcorn=""
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-0 overflow-visible"
    >
      {KERNELS.map((kernel, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{width: kernel.size, height: kernel.size, left: -kernel.size / 2, top: -kernel.size / 2}}
          initial={{x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.5}}
          animate={{
            x: [0, kernel.x * 0.7, kernel.x],
            y: [0, kernel.peak, kernel.fall],
            opacity: [0, 1, 1, 0],
            rotate: kernel.turn,
            scale: 1,
          }}
          transition={{
            duration: 1.5,
            delay: kernel.delay,
            ease: 'easeOut',
            x: {duration: 1.5, delay: kernel.delay, ease: 'easeOut', times: [0, 0.4, 1]},
            y: {duration: 1.5, delay: kernel.delay, ease: ['easeOut', 'easeIn'], times: [0, 0.4, 1]},
            opacity: {duration: 1.5, delay: kernel.delay, times: [0, 0.08, 0.75, 1]},
          }}
        >
          <Kernel />
        </motion.span>
      ))}
    </div>
  );
}
