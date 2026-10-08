import {useSyncExternalStore} from 'react';

/** True while a media query matches (false during the first server-less render). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    listener => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
