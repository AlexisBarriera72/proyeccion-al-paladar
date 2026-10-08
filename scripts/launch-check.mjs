// What must be true before a PUBLIC launch. It fails today, on purpose: the photos have no
// approved permission, the pitch is noindex, and production has placeholder ids.
//   node scripts/launch-check.mjs          files and configuration
//   node scripts/launch-check.mjs --db     also the production database (needs wrangler login)
import fs from 'node:fs';
import {placeholders, readWrangler, testVariables} from './lib/wrangler-config.ts';
import {wranglerSync} from './lib/local.ts';
import {photos} from '../src/photos.ts';

const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

// Photos: every served photo needs the owners' approval (and the people shown, where visible).
for (const photo of Object.values(photos)) {
  check(photo.reuse === 'approved', `photo "${photo.slot}" (${photo.sourceId}) has no approved permission to use.`);
}

// The pitch is hidden from search engines; a public launch removes that.
check(!/name="robots" content="noindex/.test(fs.readFileSync('index.html', 'utf8')), 'index.html still says noindex.');
check(
  !/X-Robots-Tag:\s*noindex/i.test(fs.readFileSync('public/_headers', 'utf8')),
  'public/_headers still sends noindex.',
);
check(
  !/^Disallow:\s*\/\s*$/m.test(fs.readFileSync('public/robots.txt', 'utf8')),
  'public/robots.txt still disallows everything.',
);

// Production configuration.
const config = readWrangler();
const production = config.env.production;
for (const name of placeholders(production)) check(false, `production ${name} is still a placeholder.`);
check(Boolean(production.vars.ACCESS_TEAM_DOMAIN), 'production ACCESS_TEAM_DOMAIN is empty (staff could not sign in).');
check(Boolean(production.vars.ACCESS_AUDS), 'production ACCESS_AUDS is empty (staff could not sign in).');
check(production.vars.DEMO_MODE === '0', 'production DEMO_MODE must be "0".');
check(testVariables(config).length === 0, 'TEST_* variables are written in wrangler.jsonc.');

// The production database.
if (process.argv.includes('--db')) {
  const query = sql =>
    JSON.parse(
      wranglerSync([
        'd1',
        'execute',
        production.d1_databases[0].database_name,
        '--env',
        'production',
        '--remote',
        '--json',
        '--command',
        sql,
      ]),
    )[0]?.results ?? [];
  const [row] = query(`SELECT
      (SELECT environment FROM deployment_meta WHERE id = 1) AS marker,
      (SELECT COUNT(*) FROM sessions WHERE synthetic = 1) + (SELECT COUNT(*) FROM bookings WHERE synthetic = 1)
        + (SELECT COUNT(*) FROM experiences WHERE synthetic = 1) + (SELECT COUNT(*) FROM policy_versions WHERE synthetic = 1) AS synthetic,
      (SELECT COUNT(*) FROM staff_members WHERE role = 'owner' AND active = 1) AS owners,
      (SELECT value FROM settings WHERE key = 'required_contact') AS contact,
      (SELECT value FROM settings WHERE key = 'exception_process_approved') AS exception_ok,
      (SELECT COUNT(*) FROM policy_versions WHERE state = 'approved' AND full_payment = 1) AS prepay`);
  check(row?.marker === 'production', `the production database is marked "${row?.marker ?? 'nothing'}".`);
  check(row?.synthetic === 0, 'the production database holds synthetic (DEMO) rows.');
  check(row?.owners > 0, 'no active owner in staff_members.');
  check(Boolean(row?.contact), 'the required contact is not chosen in Configuración.');
  check(
    row?.prepay === 0 || row?.exception_ok === '1',
    'a policy requires payment in full, but the process for payments without seats is not approved.',
  );
} else {
  console.log('Database checks skipped. Run with --db to check the production database.');
}

if (problems.length) {
  console.error(`launch-check: ${problems.length} problem(s) block a public launch:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('launch-check: ready for a public launch.');
