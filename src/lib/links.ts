// The guest's private link. The token travels in the URL's fragment (after "#"), which browsers
// never send to a server: it can't end up in request logs, analytics or a Referer header. The
// page reads it in the browser and sends it to the API in a request body.

/** "https://…/reservacion/#<token>" */
export const manageLink = (token: string) => `${location.origin}/reservacion/#${token}`;

/**
 * The token of a guest link: from the fragment, or from an older link that carried it in the path
 * (`/reservacion/<token>/`). Null when there is none.
 */
export function manageToken(path: string, hash: string): string | null {
  const fromHash = hash.replace(/^#/, '');
  if (/^\/reservacion\/?$/.test(path)) return fromHash ? decodeURIComponent(fromHash) : null;
  const legacy = /^\/reservacion\/([^/]{1,100})\/?$/.exec(path);
  return legacy ? decodeURIComponent(legacy[1]) : null;
}

/**
 * An older link opened as `/reservacion/<token>/`: the address bar keeps only the fragment form,
 * so the token isn't sent again with a reload or left in the path of a bookmark.
 */
export function moveLegacyTokenToFragment(): void {
  const legacy = /^\/reservacion\/([^/]{1,100})\/?$/.exec(location.pathname);
  if (legacy) history.replaceState(history.state, '', `/reservacion/#${legacy[1]}`);
}
