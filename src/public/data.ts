// Loading sessions for the calendar: one request for everything from the start of this month
// (a small list), with explicit loading, error and retry states.
import {useCallback, useEffect, useState} from 'react';
import {getJson} from '../lib/api.ts';
import type {PublicSession} from '../../shared/types.ts';

export type Load<T> = {state: 'loading'} | {state: 'error'} | {state: 'ready'; data: T};

export function useSessions(from: number) {
  const [load, setLoad] = useState<Load<PublicSession[]>>({state: 'loading'});
  const fetchAll = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoad({state: 'loading'});
      const result = await getJson<{sessions: PublicSession[]}>(`/api/public/sessions?from=${from}`);
      setLoad(current =>
        result.kind === 'ok'
          ? {state: 'ready', data: result.data.sessions}
          : quiet && current.state === 'ready'
            ? current
            : {state: 'error'},
      );
    },
    [from],
  );
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);
  return {load, reload: fetchAll};
}

export async function fetchSession(id: string): Promise<PublicSession | null | 'error'> {
  const result = await getJson<{session: PublicSession}>(`/api/public/sessions/${encodeURIComponent(id)}`);
  if (result.kind === 'ok') return result.data.session;
  return result.kind === 'error' && result.status === 404 ? null : 'error';
}
