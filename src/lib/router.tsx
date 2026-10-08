// A small client router: the History API, a subscription and links. Focus moves to the new
// page's heading after a navigation, so screen readers announce the change.
import {useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent} from 'react';

const listeners = new Set<() => void>();
let navigated = false;

const notify = () => listeners.forEach(listener => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    navigated = true;
    notify();
  });
}

export function navigate(to: string, options: {replace?: boolean; scroll?: boolean} = {}): void {
  if (to === location.pathname + location.search) return;
  history[options.replace ? 'replaceState' : 'pushState'](null, '', to);
  navigated = true;
  if (options.scroll !== false) window.scrollTo({top: 0});
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useLocation(): {path: string; search: URLSearchParams} {
  const href = useSyncExternalStore(
    subscribe,
    () => location.pathname + location.search,
    () => '/',
  );
  const url = new URL(href, 'http://local');
  return {path: url.pathname, search: url.searchParams};
}

/** True after the first in-app navigation (not on the first load). */
export const hasNavigated = () => navigated;

export function Link({
  to,
  scroll,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {to: string; scroll?: boolean}) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to, {scroll});
  };
  return <a href={to} onClick={handle} {...props} />;
}
