// Created in the browser before a write: the mutation ID (the Idempotency-Key) and the
// management token. The server stores only the token's SHA-256, so a guest who lost the
// response can rebuild their link from the token they still hold.
export const newMutationId = () => crypto.randomUUID();

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
