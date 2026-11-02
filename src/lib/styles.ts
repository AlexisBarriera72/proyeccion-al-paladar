// Shared layout and type classes (DESIGN.md, "Type" and "Layout"), so pages don't repeat them.

// Titles: Fraunces. The page title sits on the dark band; a staff page's title is smaller.
export const pageTitle = 'font-display text-[40px] md:text-[64px] font-medium tracking-[-0.02em] leading-[1.04]';
// A session's own page: long titles, so a step smaller than the page title.
export const sessionTitle = 'font-display text-[32px] md:text-[48px] font-medium tracking-[-0.015em] leading-[1.1]';
export const workTitle =
  'font-display text-[32px] md:text-[40px] font-medium tracking-[-0.015em] leading-[1.1] text-ink';
// Panel, dialog and section titles: Fraunces at 28px.
export const detailTitle = 'font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-ink';
// A small uppercase label above a title or a fact ("Próxima fecha").
export const kicker = 'text-xs font-semibold uppercase leading-4 tracking-[0.14em]';
// Their phrase, in Fraunces italic.
export const motto = 'font-display text-[24px] italic leading-[1.25] md:text-[28px]';

export const helper = 'text-sm leading-5 text-muted';
// The booking number guests show at the door: title sizes from the scale, in lining figures. It
// stays on one line where it fits; on the narrowest phones it can break only after "PAP-".
export const doorNumber =
  'font-display text-[28px] min-[380px]:text-[32px] sm:text-[40px] font-semibold leading-[1.1] tracking-[0.02em] tabular-nums lining-nums break-words';
// Lining, equal-width figures: Fraunces would otherwise draw old-style numbers.
export const numbers = 'tabular-nums lining-nums tracking-[-0.01em]';
export const workspace = 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8';
// A paper panel. Its shadow stays a neutral grey, never a colored glow.
export const panel =
  'rounded-2xl border border-border/70 bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.05),0_12px_32px_rgba(28,25,23,0.08)] p-4 sm:p-6';
// Headings inside a panel: body size, semibold, so they never compete with the panel's title.
export const sectionTitle = 'text-base font-semibold leading-6 text-ink';
// The third surface level: grouped facts inside a panel. Never a card inside a card.
export const inset = 'rounded-2xl bg-wash p-4';
// Flush lists: rows divided by hairlines instead of one box per row.
export const rows = 'divide-y divide-border/70';
// The page's width and gutters, inside a full-width band or sheet.
export const container = 'mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8';
