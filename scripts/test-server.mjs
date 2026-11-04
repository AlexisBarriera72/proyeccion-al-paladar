// The server the browser tests use: a fresh local database (demo seed, test staff) and
// `wrangler dev --env local` on 127.0.0.1:8788 serving the built site from dist/.
import path from 'node:path';
import fs from 'node:fs';
import {prepareLocalDb, startWrangler} from './lib/local.ts';

if (!fs.existsSync('dist/index.html')) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}
const persist = path.resolve('.wrangler/test-state');
prepareLocalDb(persist, {seed: process.env.PAP_SEED !== '0'});
startWrangler(persist, Number(process.env.PORT ?? 8788), true);
