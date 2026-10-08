// `npm run dev`: the Worker with a local database on :8787 and Vite on :5173. Vite's proxy
// signs you in as the local test owner (owner@example.com) for /api calls, through the
// local-only TEST_AUTH switch. `npm run dev -- --reset` starts from a fresh demo seed.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {TEST_OWNER, prepareLocalDb, startWrangler} from './lib/local.ts';

const persist = path.resolve('.wrangler/dev-state');
if (process.argv.includes('--reset') || !fs.existsSync(persist)) prepareLocalDb(persist);
if (!fs.existsSync('dist/index.html')) spawnSync('npx', ['vite', 'build'], {stdio: 'inherit'});
startWrangler(persist, 8787, true);
const vite = spawn('npx', ['vite'], {stdio: 'inherit', env: {...process.env, PAP_DEV_STAFF: TEST_OWNER}});
process.on('exit', () => vite.kill('SIGTERM'));
