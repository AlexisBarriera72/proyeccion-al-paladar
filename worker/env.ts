// The Worker's environment, and the checks that fail closed before anything else runs.
import type {Db} from './db.ts';

export interface RateLimiter {
  limit(options: {key: string}): Promise<{success: boolean}>;
}

export interface Env {
  APP_ENV?: string;
  DEMO_MODE?: string;
  ACCESS_EVERYWHERE?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDS?: string;
  /** Local tests only (scripts/test-server.mjs passes them with --var). */
  TEST_AUTH?: string;
  TEST_CLOCK?: string;
  DB?: Db;
  ASSETS?: {fetch(request: Request): Promise<Response>};
  SUBMIT_LIMITER?: RateLimiter;
  READ_LIMITER?: RateLimiter;
}

export type AppEnv = 'local' | 'demo' | 'production';
const APP_ENVS: AppEnv[] = ['local', 'demo', 'production'];

export function isLoopback(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}

/** True only for local tests on a loopback host. Any TEST_* outside `local` fails closed. */
export const testSwitches = (env: Env, request: Request) => env.APP_ENV === 'local' && isLoopback(request);

/** Why the Worker must refuse every request, or null when the environment is sound. */
export function environmentProblem(env: Env): string | null {
  if (!APP_ENVS.includes(env.APP_ENV as AppEnv)) return 'environment_not_selected';
  if ((env.TEST_AUTH || env.TEST_CLOCK) && env.APP_ENV !== 'local') return 'test_switch_in_deployed_environment';
  if (!env.DB) return 'database_missing';
  return null;
}

// The database marker is read once per isolate and binding; a mismatch is never cached.
const markerChecked = new WeakMap<object, string>();

export async function databaseMarkerProblem(env: Env): Promise<string | null> {
  const db = env.DB!;
  if (markerChecked.get(db) === env.APP_ENV) return null;
  try {
    const row = await db.prepare('SELECT environment FROM deployment_meta WHERE id = 1').first<{environment: string}>();
    if (!row) return 'database_marker_missing';
    if (row.environment !== env.APP_ENV) return 'database_marker_mismatch';
    markerChecked.set(db, env.APP_ENV!);
    return null;
  } catch {
    return 'database_unreadable';
  }
}

/** The clock: real time, or a test time from X-Test-Now in local tests only. */
export function clock(env: Env, request: Request): number {
  if (env.TEST_CLOCK === '1' && testSwitches(env, request)) {
    const value = Number(request.headers.get('x-test-now'));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return Date.now();
}
