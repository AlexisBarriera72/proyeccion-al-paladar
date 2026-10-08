// The local environment for `npm run dev` and the browser tests: a fresh D1 under a folder of
// our own, migrated, marked 'local', with the demo seed and two test staff members, then
// `wrangler dev --env local`. TEST_AUTH and TEST_CLOCK are passed here with --var, never
// written in wrangler.jsonc, and the Worker honors them only for APP_ENV=local on loopback.
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {demoSeed, seedSqlFile} from '../../worker/seed.ts';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', 'wrangler');
export const TEST_OWNER = 'owner@example.com';
export const TEST_STAFF = 'staff@example.com';

const quiet = {...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1', NO_COLOR: '1'};

export function wranglerSync(args: string[]): string {
  const result = spawnSync(WRANGLER, args, {cwd: ROOT, env: quiet, encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

export function staffSql(members: {email: string; role: 'owner' | 'staff'}[], now: number): string {
  return members
    .map(
      m =>
        `INSERT INTO staff_members (email, role, active, created_at, updated_at) VALUES ('${m.email.toLowerCase().replaceAll("'", "''")}', '${m.role}', 1, ${now}, ${now});`,
    )
    .join('\n');
}

/** A fresh local database in `persistTo`: migrations, the 'local' marker, staff and the demo seed. */
export function prepareLocalDb(persistTo: string, options: {seed?: boolean; now?: number} = {}): void {
  const now = options.now ?? Date.now();
  fs.rmSync(persistTo, {recursive: true, force: true});
  fs.mkdirSync(persistTo, {recursive: true});
  const local = ['--env', 'local', '--local', '--persist-to', persistTo];
  wranglerSync(['d1', 'migrations', 'apply', 'pap-local', ...local]);
  const sql = [
    `INSERT INTO deployment_meta (id, environment, created_at) VALUES (1, 'local', ${now});`,
    staffSql(
      [
        {email: TEST_OWNER, role: 'owner'},
        {email: TEST_STAFF, role: 'staff'},
      ],
      now,
    ),
    options.seed === false ? '' : seedSqlFile(demoSeed(now)),
  ].join('\n');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pap-seed-')), 'seed.sql');
  fs.writeFileSync(file, sql);
  wranglerSync(['d1', 'execute', 'pap-local', ...local, '--file', file]);
}

export function startWrangler(persistTo: string, port: number, testSwitches: boolean): ChildProcess {
  const args = ['dev', '--env', 'local', '--persist-to', persistTo, '--port', String(port), '--ip', '127.0.0.1'];
  if (testSwitches) args.push('--var', 'TEST_AUTH:1', '--var', 'TEST_CLOCK:1');
  const child = spawn(WRANGLER, args, {cwd: ROOT, env: quiet, stdio: 'inherit'});
  const stop = () => child.kill('SIGTERM');
  process.on('exit', stop);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      stop();
      process.exit(0);
    });
  }
  return child;
}
