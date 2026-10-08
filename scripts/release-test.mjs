// The release gate: the built site on a real `wrangler dev --env local` (workerd and a fresh
// local D1), exercised over HTTP by tests/release/*.test.ts. It proves what unit tests can't:
// headers on every response type, D1 accepting the ledger's triggers, and concurrent writes
// through the real Worker.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {prepareLocalDb, startWrangler} from './lib/local.ts';

const PORT = 8789;
const persist = path.resolve('.wrangler/release-state');
if (spawnSync('npx', ['vite', 'build'], {stdio: 'inherit'}).status !== 0) process.exit(1);
prepareLocalDb(persist);
const server = startWrangler(persist, PORT, true);

const base = `http://127.0.0.1:${PORT}`;
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try {
    ready = (await fetch(`${base}/api/public/config`)).ok;
  } catch {
    /* not up yet */
  }
  if (!ready) await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) {
  console.error('release-test: the local Worker did not start.');
  server.kill('SIGTERM');
  process.exit(1);
}
const run = spawnSync(
  'node',
  ['--test', '--test-concurrency=1', '--disable-warning=ExperimentalWarning', 'tests/release/*.test.ts'],
  {stdio: 'inherit', env: {...process.env, PAP_BASE: base, PAP_PERSIST: persist}},
);
server.kill('SIGTERM');
process.exit(run.status ?? 1);
