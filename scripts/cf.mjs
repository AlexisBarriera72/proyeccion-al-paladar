// The one entry point for Cloudflare: `npm run cf -- <local|demo|production> <action> [options]`.
//
//   init-db   empty database → migrations + its environment marker (once)
//   migrate   apply new migrations (the marker must name this environment)
//   seed      demo data + staff: --owner <email> --staff <email[,email]> (demo and local only)
//   reset     delete demo data and seed it again; staff and history stay (demo and local only)
//   deploy    build and deploy (demo and production; production also runs launch-check)
//   add-owner add or promote one owner: --email <email> (any environment; how production gets
//             its first owner, since staff can only be added in the app by an owner)
//   status    print the marker and row counts
//
// There is no default environment. Every write reads the database's marker first and refuses
// when it names another environment. Placeholder account or database ids are refused.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ENVIRONMENTS, placeholders, readWrangler, testVariables} from './lib/wrangler-config.ts';
import {staffSql, wranglerSync} from './lib/local.ts';
import {demoSeed, seedSqlFile} from '../worker/seed.ts';
import {DEMO_RESET_TABLES} from '../worker/admin-rules.ts';

const ACTIONS = ['init-db', 'migrate', 'seed', 'reset', 'add-owner', 'deploy', 'status'];
const fail = message => {
  console.error(`cf: ${message}`);
  process.exit(1);
};

const [envName, action, ...rest] = process.argv.slice(2).filter(arg => arg !== '--');
if (!ENVIRONMENTS.includes(envName)) fail('name the environment first: local, demo or production.');
if (!ACTIONS.includes(action)) fail(`unknown action "${action ?? ''}". Use one of: ${ACTIONS.join(', ')}.`);

const option = name => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
};

// Emails go into SQL, so only plain addresses are accepted (no quotes, spaces or semicolons).
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
function email(value, flag) {
  const address = (value ?? '').trim().toLowerCase();
  if (!EMAIL.test(address)) fail(`${flag} needs a plain email address, not "${value ?? ''}".`);
  return address;
}

const config = readWrangler();
const env = config.env[envName];
const dbName = env.d1_databases[0].database_name;
const where = envName === 'local' ? ['--local', '--persist-to', path.resolve('.wrangler/dev-state')] : ['--remote'];

// ------------------------------------------------------------------ refusals before anything runs
if (envName !== 'local') {
  const missing = placeholders(env);
  if (missing.length) fail(`${envName}: replace the placeholder ${missing.join(' and ')} in wrangler.jsonc first.`);
  const {demo, production} = config.env;
  if (demo.account_id === production.account_id) fail('demo and production use the same Cloudflare account.');
  if (demo.d1_databases[0].database_id === production.d1_databases[0].database_id) {
    fail('demo and production use the same database.');
  }
}
const tests = testVariables(config);
if (tests.length) fail(`TEST_* variables are written in wrangler.jsonc (${tests.join(', ')}). Remove them.`);

// ------------------------------------------------------------------ database helpers
function execute(sql) {
  const out = wranglerSync(['d1', 'execute', dbName, '--env', envName, ...where, '--json', '--command', sql]);
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

function executeFile(sql) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pap-cf-')), 'batch.sql');
  fs.writeFileSync(file, sql);
  wranglerSync(['d1', 'execute', dbName, '--env', envName, ...where, '--file', file]);
}

/** The environment named in the database, or null when there is no marker (or no table yet). */
function marker() {
  try {
    return execute('SELECT environment FROM deployment_meta WHERE id = 1')[0]?.environment ?? null;
  } catch (error) {
    if (/no such table/i.test(String(error))) return null;
    throw error;
  }
}

function requireMarker() {
  const found = marker();
  if (found !== envName) {
    fail(
      found === null
        ? `${dbName} has no environment marker. Run \`npm run cf -- ${envName} init-db\` first.`
        : `${dbName} is marked "${found}", not "${envName}". Nothing was written.`,
    );
  }
}

const demoOnly = () => {
  if (envName === 'production' || env.vars.APP_ENV === 'production' || env.vars.DEMO_MODE !== '1') {
    fail(`${action} works only on demo or local data.`);
  }
};

const migrate = () => wranglerSync(['d1', 'migrations', 'apply', dbName, '--env', envName, ...where]);

// ------------------------------------------------------------------ actions
const now = Date.now();
switch (action) {
  case 'init-db': {
    const found = marker();
    if (found === envName) {
      console.log(`${dbName} is already initialized for ${envName}.`);
      break;
    }
    if (found !== null) fail(`${dbName} is marked "${found}". Nothing was written.`);
    migrate();
    execute(`INSERT INTO deployment_meta (id, environment, created_at) VALUES (1, '${envName}', ${now})`);
    console.log(`${dbName}: migrated and marked "${envName}".`);
    break;
  }
  case 'migrate':
    requireMarker();
    console.log(migrate());
    break;
  case 'seed': {
    demoOnly();
    requireMarker();
    if (!option('owner')) fail('seed needs --owner <email> (and optionally --staff <email[,email]>).');
    const owner = email(option('owner'), '--owner');
    const staff = (option('staff') ?? '')
      .split(',')
      .filter(Boolean)
      .map(address => email(address, '--staff'));
    const [{count}] = execute('SELECT COUNT(*) AS count FROM sessions');
    if (count > 0) fail(`${dbName} already has sessions. Use \`reset\` to start over.`);
    executeFile(
      [
        `INSERT OR IGNORE INTO staff_members (email, role, active, created_at, updated_at) VALUES ('${owner}', 'owner', 1, ${now}, ${now});`,
        staffSql(
          staff.map(email => ({email, role: 'staff'})),
          now,
        ).replaceAll('INSERT INTO', 'INSERT OR IGNORE INTO'),
        seedSqlFile(demoSeed(now)),
      ].join('\n'),
    );
    console.log(`${dbName}: demo data seeded.`);
    break;
  }
  case 'add-owner': {
    const owner = email(option('email'), '--email');
    requireMarker();
    execute(
      `INSERT INTO staff_members (email, role, active, created_at, updated_at) VALUES ('${owner}', 'owner', 1, ${now}, ${now})
        ON CONFLICT (email) DO UPDATE SET role = 'owner', active = 1, version = version + 1, updated_at = ${now}`,
    );
    console.log(`${dbName}: ${owner} is an active owner.`);
    break;
  }
  case 'reset': {
    demoOnly();
    requireMarker();
    executeFile(
      [
        'INSERT INTO reset_lock (id) VALUES (1);',
        ...DEMO_RESET_TABLES.map(table => `DELETE FROM ${table};`),
        'DELETE FROM mutations;',
        seedSqlFile(demoSeed(now)),
        'DELETE FROM reset_lock;',
      ].join('\n'),
    );
    console.log(`${dbName}: demo data reset. Staff members and the audit history were kept.`);
    break;
  }
  case 'status': {
    console.log(`marker: ${marker() ?? '(none)'}`);
    for (const table of ['sessions', 'bookings', 'payments', 'staff_members', 'audit_events']) {
      try {
        console.log(`${table}: ${execute(`SELECT COUNT(*) AS count FROM ${table}`)[0].count}`);
      } catch {
        console.log(`${table}: (no table)`);
      }
    }
    break;
  }
  case 'deploy': {
    if (envName === 'local') fail('local is never deployed.');
    requireMarker();
    const secrets = JSON.parse(wranglerSync(['secret', 'list', '--env', envName, '--format', 'json']) || '[]');
    const testSecrets = secrets.map(s => s.name).filter(name => name.startsWith('TEST_'));
    if (testSecrets.length) fail(`${envName} has TEST_* secrets (${testSecrets.join(', ')}). Delete them first.`);
    if (envName === 'production') {
      const [{count}] = execute(
        `SELECT (SELECT COUNT(*) FROM sessions WHERE synthetic = 1) + (SELECT COUNT(*) FROM bookings WHERE synthetic = 1)
          + (SELECT COUNT(*) FROM experiences WHERE synthetic = 1) + (SELECT COUNT(*) FROM venues WHERE synthetic = 1)
          + (SELECT COUNT(*) FROM policy_versions WHERE synthetic = 1) AS count`,
      );
      if (count > 0) fail(`the production database holds ${count} synthetic rows. Nothing was deployed.`);
      const check = spawnSync('node', ['scripts/launch-check.mjs', '--db'], {stdio: 'inherit'});
      if (check.status !== 0) fail('launch-check failed. Nothing was deployed.');
    }
    const build = spawnSync('npx', ['vite', 'build'], {stdio: 'inherit'});
    if (build.status !== 0) fail('the build failed.');
    console.log(wranglerSync(['deploy', '--env', envName]));
    break;
  }
}
