// The brief's layout and type classes, so pages don't repeat them (DESIGN.md).
export const pageTitle = 'text-[32px] md:text-[44px] font-medium tracking-[-0.04em] leading-[1.08] text-ink';
export const detailTitle = 'text-[24px] font-medium tracking-[-0.025em] leading-[1.2] text-ink';
export const helper = 'text-sm leading-5 text-muted';
export const numbers = 'tabular-nums tracking-[-0.01em]';
export const workspace = 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8';
export const panel =
  'rounded-2xl border border-border/50 bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)] p-4 sm:p-6';
// Headings inside a panel: body size, semibold, so they never compete with the page title.
export const sectionTitle = 'text-base font-semibold leading-6 text-ink';
// The third surface level: grouped facts inside a panel. Never a card inside a card.
export const inset = 'rounded-2xl bg-stone-100 p-4';
// Flush lists: rows divided by hairlines instead of one box per row.
export const rows = 'divide-y divide-border/70';
