// Calls through the Worker's own fetch handler on a fresh test database, as the browser makes them.
import {randomBytes, randomUUID} from 'node:crypto';
import worker from '../../worker/index.ts';
import type {Env} from '../../worker/env.ts';
import {freshDb, NOW} from './helpers.ts';
import type {TestD1} from './d1.ts';

const SHELL = '<!doctype html><html><head><title>Proyección al Paladar</title></head><body></body></html>';
const assets = {fetch: async () => new Response(SHELL, {headers: {'Content-Type': 'text/html; charset=utf-8'}})};

export const OWNER_EMAIL = 'owner@example.com';
export const STAFF_EMAIL = 'staff@example.com';

export function env(over: Partial<Env> = {}, db: TestD1 = freshDb()): Env {
  return {
    APP_ENV: 'local',
    DEMO_MODE: '1',
    ACCESS_EVERYWHERE: '0',
    TEST_AUTH: '1',
    TEST_CLOCK: '1',
    DB: db,
    ASSETS: assets,
    ...over,
  };
}

export interface Call {
  body?: unknown;
  /** A staff email (local test sign-in). */
  as?: string;
  /** The Idempotency-Key; a new one per write when left out. */
  key?: string;
  now?: number;
}

export async function call(e: Env, path: string, c: Call = {}) {
  const headers: Record<string, string> = {'x-test-now': String(c.now ?? NOW)};
  if (c.body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = c.key ?? randomUUID();
  }
  if (c.as) headers['x-test-access-email'] = c.as;
  const response = await worker.fetch(
    new Request(`http://127.0.0.1${path}`, {
      method: c.body !== undefined ? 'POST' : 'GET',
      headers,
      body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
    }),
    e,
  );
  const type = response.headers.get('content-type') || '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = type.includes('json') ? await response.json() : null;
  return {response, json};
}

export const token = () => randomBytes(32).toString('base64url');
export const key = () => randomUUID();

/** A guest reservation through the public API, accepting the session's current terms. */
export async function reserveVia(
  e: Env,
  sessionId: string,
  o: {token?: string; key?: string; partySize?: number; now?: number; over?: Record<string, unknown>} = {},
) {
  const now = o.now ?? NOW;
  const {json: session} = await call(e, `/api/public/sessions/${sessionId}`, {now});
  return call(e, '/api/public/bookings', {
    key: o.key,
    now,
    body: {
      intent: 'reserve',
      sessionId,
      partySize: o.partySize ?? 2,
      leadName: 'Cliente de prueba 01',
      contactKind: 'email',
      contactValue: 'cliente01@example.com',
      note: null,
      token: o.token ?? token(),
      terms: session.session.terms,
      acceptedTerms: true,
      ...o.over,
    },
  });
}
