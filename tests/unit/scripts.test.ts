// The deploy scripts refuse before they reach Cloudflare. Every case here exits before wrangler
// runs: cf.mjs checks the environment, the action and the placeholder ids first, and refuses
// `local deploy` before reading any database; cloudflare-build.mjs checks PAP_ENV before it
// spawns anything; launch-check.mjs only queries a database with --db.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {placeholders, readWrangler} from '../../scripts/lib/wrangler-config.ts';
import {photos} from '../../src/photos.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const withoutPapEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'PAP_ENV'));

function run(script: string, args: string[] = [], extraEnv: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', script, ...args], {
    cwd: ROOT,
    env: {...withoutPapEnv, ...extraEnv},
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.error, undefined, `${script} ${args.join(' ')} did not run`);
  return {status: result.status, stdout: result.stdout, stderr: result.stderr};
}

test('cf.mjs with no environment exits 1 and names the three', () => {
  const {status, stderr} = run('scripts/cf.mjs');
  assert.equal(status, 1);
  assert.match(stderr, /local, demo or production/);
});

test('cf.mjs with an unknown action exits 1', () => {
  const {status, stderr} = run('scripts/cf.mjs', ['local', 'publish']);
  assert.equal(status, 1);
  assert.match(stderr, /unknown action "publish"/);
});

test('cf.mjs refuses the placeholder ids in wrangler.jsonc for demo and production', () => {
  const {env} = readWrangler();
  for (const name of ['demo', 'production']) {
    const missing = placeholders(env[name]);
    assert.ok(missing.length > 0, `${name} no longer has placeholder ids; this test expects the committed ones`);
    const {status, stderr} = run('scripts/cf.mjs', [name, 'status']);
    assert.equal(status, 1, name);
    assert.match(stderr, /placeholder/, name);
    for (const field of missing) assert.ok(stderr.includes(field), `${name}: ${field}`);
  }
});

test('cf.mjs never deploys local', () => {
  const {status, stderr} = run('scripts/cf.mjs', ['local', 'deploy']);
  assert.equal(status, 1);
  assert.match(stderr, /local is never deployed/);
});

test('cf.mjs puts only plain email addresses into SQL (add-owner and seed)', () => {
  for (const bad of ["x'); DROP TABLE staff_members; --@example.com", 'no-at-sign', 'a b@example.com', '']) {
    const add = run('scripts/cf.mjs', ['local', 'add-owner', '--email', bad]);
    assert.equal(add.status, 1, bad);
    assert.match(add.stderr, /--email needs a plain email address/, bad);
  }
});

test('cloudflare-build.mjs refuses without PAP_ENV, or with anything but demo or production', () => {
  const cases: Record<string, string>[] = [{}, {PAP_ENV: ''}, {PAP_ENV: 'local'}];
  for (const extraEnv of cases) {
    const {status, stderr} = run('scripts/cloudflare-build.mjs', [], extraEnv);
    assert.equal(status, 1, JSON.stringify(extraEnv));
    assert.match(stderr, /set PAP_ENV to "demo" or "production"/);
  }
});

// CLAUDE.md: launch-check may list only the known launch blockers (photo permission, noindex,
// production placeholders, production Access settings). Anything else it lists is a failure.
test('launch-check exits 1 and lists the photo and noindex blockers, and no blocker beyond the known ones', () => {
  const {status, stdout, stderr} = run('scripts/launch-check.mjs');
  assert.equal(status, 1);
  assert.match(stdout, /Database checks skipped/);
  const unapproved = Object.values(photos).filter(photo => photo.reuse !== 'approved');
  assert.ok(unapproved.length > 0, 'every photo is approved; this test expects today’s unverified permissions');
  const production = readWrangler().env.production;
  const expected = [
    ...unapproved.map(photo => `photo "${photo.slot}" (${photo.sourceId}) has no approved permission to use.`),
    'index.html still says noindex.',
    'public/_headers still sends noindex.',
    'public/robots.txt still disallows everything.',
    ...placeholders(production).map(name => `production ${name} is still a placeholder.`),
    ...(['ACCESS_TEAM_DOMAIN', 'ACCESS_AUDS'] as const)
      .filter(name => !production.vars[name])
      .map(name => `production ${name} is empty (staff could not sign in).`),
  ];
  const listed = [...stderr.matchAll(/^ {2}- (.*)$/gm)].map(m => m[1]);
  assert.match(stderr, new RegExp(`^launch-check: ${listed.length} problem\\(s\\) block a public launch:$`, 'm'));
  assert.deepEqual(listed.sort(), expected.sort());
});
