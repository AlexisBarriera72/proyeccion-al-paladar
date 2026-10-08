// Deployment isolation, as configured: demo and production share nothing, the top level is
// not deployable, and no test switch is written anywhere.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readWrangler} from '../../scripts/lib/wrangler-config.ts';
import {CSP} from '../../worker/http.ts';

const config = readWrangler();
const {demo, production, local} = config.env;

test('the top level has no bindings and is marked unselected', () => {
  assert.equal(config.vars.APP_ENV, 'unselected');
  for (const binding of ['d1_databases', 'assets', 'ratelimits', 'kv_namespaces', 'r2_buckets']) {
    assert.equal(config[binding], undefined, binding);
  }
});

test('demo and production share no name, database, namespace or account', () => {
  assert.notEqual(demo.name, production.name);
  assert.notEqual(demo.account_id, production.account_id);
  assert.notEqual(demo.d1_databases[0].database_name, production.d1_databases[0].database_name);
  assert.notEqual(demo.d1_databases[0].database_id, production.d1_databases[0].database_id);
  const namespaces = (env: any) => env.ratelimits.map((r: any) => r.namespace_id);
  for (const id of namespaces(demo)) assert.ok(!namespaces(production).includes(id), id);
  for (const env of [local, demo, production]) assert.equal(env.d1_databases[0].binding, 'DB');
});

test('each environment names itself, and only the demo checks Access everywhere', () => {
  assert.equal(local.vars.APP_ENV, 'local');
  assert.equal(demo.vars.APP_ENV, 'demo');
  assert.equal(production.vars.APP_ENV, 'production');
  assert.equal(demo.vars.ACCESS_EVERYWHERE, '1');
  assert.equal(demo.assets.run_worker_first, true);
  assert.equal(production.vars.ACCESS_EVERYWHERE, '0');
  assert.equal(production.vars.DEMO_MODE, '0');
  for (const path of ['/api/*', '/funciones/*', '/reservacion/*', '/equipo', '/equipo/*']) {
    assert.ok(production.assets.run_worker_first.includes(path), path);
  }
  assert.equal(demo.preview_urls, false);
  assert.equal(production.preview_urls, false);
});

test('no TEST_* variable is configured in any environment', () => {
  for (const env of [config, local, demo, production]) {
    assert.deepEqual(
      Object.keys(env.vars ?? {}).filter(key => key.startsWith('TEST_')),
      [],
    );
  }
});

test('public/_headers carries the same CSP as the Worker', () => {
  const headers = fs.readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
  assert.ok(headers.includes(`Content-Security-Policy: ${CSP}`));
});
