// Fetch helpers. Writes are JSON with an Idempotency-Key. A network failure is reported as
// `lost`: the request may or may not have arrived, and retrying with the same key is safe.
export type ApiResult<T> =
  {kind: 'ok'; data: T} | {kind: 'error'; status: number; code: string; data: Record<string, unknown>} | {kind: 'lost'};

async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {credentials: 'same-origin', ...init});
  } catch {
    return {kind: 'lost'};
  }
  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    /* not JSON */
  }
  if (response.ok) return {kind: 'ok', data: data as T};
  return {kind: 'error', status: response.status, code: String(data.error ?? `http_${response.status}`), data};
}

export const getJson = <T>(path: string) => request<T>(path, {method: 'GET', headers: {Accept: 'application/json'}});

export const postJson = <T>(path: string, body: unknown, mutationId?: string) =>
  request<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(mutationId ? {'Idempotency-Key': mutationId} : {}),
    },
    body: JSON.stringify(body),
  });
