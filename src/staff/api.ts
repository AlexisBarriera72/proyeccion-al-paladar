// Staff data: reads with explicit states, and writes that keep one mutation ID per intent.
// A write whose response was lost is retried with the same ID (it can't apply twice); a
// settled answer, applied or rejected, frees the ID so the next attempt is a new intent.
import {useCallback, useEffect, useRef, useState} from 'react';
import {getJson, postJson, type ApiResult} from '../lib/api.ts';
import {newMutationId} from '../lib/ids.ts';

export type Query<T> =
  {state: 'loading'} | {state: 'error'; status: number | null; code: string | null} | {state: 'ready'; data: T};

export function useQuery<T>(path: string | null) {
  const [query, setQuery] = useState<Query<T>>({state: 'loading'});
  const fetchNow = useCallback(
    async (quiet = false) => {
      if (!path) return;
      if (!quiet) setQuery({state: 'loading'});
      const result = await getJson<T>(path);
      setQuery(current => {
        if (result.kind === 'ok') return {state: 'ready', data: result.data};
        if (quiet && current.state === 'ready') return current;
        return result.kind === 'error'
          ? {state: 'error', status: result.status, code: result.code}
          : {state: 'error', status: null, code: null};
      });
    },
    [path],
  );
  useEffect(() => {
    void fetchNow();
  }, [fetchNow]);
  return {query, reload: fetchNow};
}

export function useWrite() {
  const pending = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T = {ok: true; outcome: Record<string, unknown> | null}>(path: string, body: unknown) => {
      const fingerprint = path + JSON.stringify(body);
      let id = pending.current.get(fingerprint);
      if (!id) {
        id = newMutationId();
        pending.current.set(fingerprint, id);
      }
      setBusy(true);
      const result: ApiResult<T> = await postJson<T>(path, body, id);
      setBusy(false);
      if (result.kind !== 'lost') pending.current.delete(fingerprint);
      return result;
    },
    [],
  );
  return {run, busy};
}

/** "25.00" → 2500; null when it isn't an amount with up to two decimals. */
export function parseMoney(text: string): number | null {
  const match = /^\s*(\d{1,6})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
}

export const centsText = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2));

export const intOrNull = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return /^\d{1,5}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
};
