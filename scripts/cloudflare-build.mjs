// For Cloudflare Workers Builds: set the deploy command to `node scripts/cloudflare-build.mjs`
// and the build variable PAP_ENV to "demo" (or "production" at launch). Without PAP_ENV it
// refuses, so a build can never fall back to a default environment. It runs the same checks
// as `npm run cf -- <env> deploy`: placeholders, the database marker, TEST_* secrets and, for
// production, synthetic rows and launch-check.
import {spawnSync} from 'node:child_process';

const target = process.env.PAP_ENV;
if (target !== 'demo' && target !== 'production') {
  console.error('cloudflare-build: set PAP_ENV to "demo" or "production" in the build settings.');
  process.exit(1);
}
const run = spawnSync('node', ['scripts/cf.mjs', target, 'deploy'], {stdio: 'inherit'});
process.exit(run.status ?? 1);
