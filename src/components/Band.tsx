// The page's dark band (the sala): grain and a soft projector glow, the page title and its
// introduction. The paper sheet below it overlaps its last 64px on computers, so the work
// surfaces sit on the band like a ticket on a table; on phones the paper rises over it with a
// rounded edge. Nothing here animates.
import type {ReactNode} from 'react';
import {cn} from '../lib/cn.ts';
import {container} from '../lib/styles.ts';

export function PageBand({children, className}: {children: ReactNode; className?: string}) {
  // A plain block, not a landmark: the page's sections below carry the names.
  return (
    <div data-texture="" className={cn('texture-glow bg-sala text-on-sala', className)}>
      <div className={cn(container, 'pb-12 pt-6 sm:pb-24 sm:pt-10')}>{children}</div>
    </div>
  );
}

export function PageSheet({children, className}: {children: ReactNode; className?: string}) {
  return (
    <div
      className={cn(
        'relative -mt-6 rounded-t-[28px] bg-canvas pt-6 sm:-mt-16 sm:rounded-none sm:bg-transparent sm:pt-0',
        className,
      )}
    >
      <div className={cn(container, 'pb-12')}>{children}</div>
    </div>
  );
}
