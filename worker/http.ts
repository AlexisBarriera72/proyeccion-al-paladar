// Responses, request parsing and the security headers every Worker response carries.
// `_headers` only covers assets served without the Worker, so the Worker sets these itself.

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Radix and Motion set inline styles at runtime; no inline scripts are allowed.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export interface HeaderOptions {
  noStore?: boolean;
  noReferrer?: boolean;
  noIndex: boolean;
}

/** Returns a copy of `response` with the security headers set. */
export function withSecurityHeaders(response: Response, options: HeaderOptions): Response {
  const out = new Response(response.body, response);
  const h = out.headers;
  h.set('Content-Security-Policy', CSP);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  h.set('Referrer-Policy', options.noReferrer ? 'no-referrer' : 'strict-origin-when-cross-origin');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (options.noStore) h.set('Cache-Control', 'no-store');
  if (options.noIndex) h.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra},
  });
}

export const error = (code: string, status: number, extra: Record<string, unknown> = {}) =>
  json({ok: false, error: code, ...extra}, status);

const MAX_BODY = 16 * 1024;

export type Parsed<T> = {ok: true; value: T} | {ok: false; response: Response};

/** JSON body only, same origin only, size-capped. Cross-site forms can't send JSON without CORS. */
export async function readJson(request: Request): Promise<Parsed<unknown>> {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return {ok: false, response: error('json_required', 415)};
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return {ok: false, response: error('cross_origin', 403)};
  const text = await request.text();
  if (text.length > MAX_BODY) return {ok: false, response: error('too_large', 413)};
  try {
    return {ok: true, value: JSON.parse(text)};
  } catch {
    return {ok: false, response: error('json_invalid', 400)};
  }
}

const MUTATION_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** Every write carries an Idempotency-Key: the mutation ID for the ledger. */
export function mutationIdOf(request: Request): string | null {
  const value = request.headers.get('idempotency-key');
  return value && MUTATION_ID.test(value) ? value : null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function randomId(bytes = 16): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** "PAP-K7Q2MX": short, unambiguous, never enough on its own to open a booking. */
export function newReference(): string {
  const data = crypto.getRandomValues(new Uint8Array(6));
  return 'PAP-' + [...data].map(byte => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join('');
}
