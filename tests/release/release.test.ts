// The release gate (scripts/release-test.mjs runs it): the built site on a real local Worker
// (workerd) with a fresh local D1 holding the demo seed and two test staff members.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID, randomBytes} from 'node:crypto';
import path from 'node:path';

const BASE = process.env.PAP_BASE ?? 'http://127.0.0.1:8789';
const PERSIST = process.env.PAP_PERSIST ?? path.resolve('.wrangler/release-state');
const OWNER = {'x-test-access-email': 'owner@example.com'};

const token = () => randomBytes(32).toString('base64url');
const post = (pathname: string, body: unknown, headers: Record<string, string> = {}, key = randomUUID()) =>
  fetch(BASE + pathname, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: BASE, 'Idempotency-Key': key, ...headers},
    body: JSON.stringify(body),
  });

function sqlite(sql: string): string {
  const result = spawnSync(
    'node_modules/.bin/wrangler',
    ['d1', 'execute', 'pap-local', '--env', 'local', '--local', '--persist-to', PERSIST, '--json', '--command', sql],
    {encoding: 'utf8', env: {...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1'}},
  );
  return `${result.stdout}\n${result.stderr}`;
}

const SECURITY = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
];

test('every response type carries the security headers', async () => {
  const html = await fetch(`${BASE}/`);
  const page = await html.text();
  const asset = /src="(\/assets\/[^"]+\.js)"/.exec(page)?.[1];
  assert.ok(asset, 'the built page links its script');
  const responses = {
    html,
    asset: await fetch(BASE + asset),
    api: await fetch(`${BASE}/api/public/config`),
    apiMissing: await fetch(`${BASE}/api/public/nothing`),
    staffDenied: await fetch(`${BASE}/equipo/`),
    staffApiDenied: await fetch(`${BASE}/api/equipo/me`),
    crossOrigin: await fetch(`${BASE}/api/public/manage`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Origin: 'https://example.com'},
      body: JSON.stringify({token: token()}),
    }),
    manage: await fetch(`${BASE}/reservacion/${token()}/`),
    session: await fetch(`${BASE}/funciones/demo-prueba-a/`),
  };
  for (const [name, response] of Object.entries(responses)) {
    for (const header of SECURITY) assert.ok(response.headers.get(header), `${name}: ${header}`);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${name}: noindex during the pitch`);
  }
  assert.equal(responses.staffDenied.status, 403);
  assert.equal(responses.staffApiDenied.status, 403);
  assert.equal(responses.crossOrigin.status, 403);
  assert.equal(responses.manage.headers.get('referrer-policy'), 'no-referrer');
  assert.match(responses.api.headers.get('cache-control') ?? '', /no-store/);
  assert.match(responses.asset.headers.get('cache-control') ?? '', /immutable/);
  assert.match(await responses.session.text(), /<meta property="og:title" content="DEMO · Función de prueba/);
});

// Refusal off loopback is covered in tests/unit/worker.test.ts (these requests come from loopback).
test('local test sign-in admits only listed staff', async () => {
  assert.equal((await fetch(`${BASE}/api/equipo/me`, {headers: OWNER})).status, 200);
  const stranger = await fetch(`${BASE}/api/equipo/me`, {headers: {'x-test-access-email': 'nobody@example.com'}});
  assert.equal(stranger.status, 403);
});

test('competing requests for the last seats: only what fits is confirmed', async () => {
  const session = await (await fetch(`${BASE}/api/public/sessions/demo-prueba-a`)).json();
  const left = session.session.remaining as number;
  const terms = session.session.terms;
  const size = 8;
  const attempts = 6;
  const results = await Promise.all(
    Array.from({length: attempts}, (_, i) =>
      post('/api/public/bookings', {
        intent: 'reserve',
        sessionId: 'demo-prueba-a',
        partySize: size,
        leadName: `Cliente de prueba ${i}`,
        contactKind: 'email',
        contactValue: `prueba${i}@example.com`,
        note: null,
        token: token(),
        terms: {
          policyVersionId: terms.policyVersionId,
          priceStatus: terms.priceStatus,
          unitPriceCents: terms.unitPriceCents,
          currency: terms.currency,
        },
        acceptedTerms: true,
      }).then(async r => ({status: r.status, body: await r.json()})),
    ),
  );
  const confirmed = results.filter(r => r.status === 200);
  assert.equal(confirmed.length, Math.floor(left / size));
  for (const r of results.filter(r => r.status !== 200)) assert.equal(r.body.error, 'no_seats');
  const after = await (await fetch(`${BASE}/api/public/sessions/demo-prueba-a`)).json();
  assert.equal(after.session.remaining, left - confirmed.length * size);
});

test('a replayed submission returns the stored outcome; reuse with other data is refused', async () => {
  const key = randomUUID();
  const body = {
    intent: 'request',
    sessionId: 'demo-shrek-1',
    partySize: 3,
    leadName: 'Cliente de prueba replay',
    contactKind: 'phone',
    contactValue: '787-555-0199',
    note: null,
    token: token(),
    terms: null,
    acceptedTerms: false,
  };
  const first = await (await post('/api/public/bookings', body, {}, key)).json();
  const again = await (await post('/api/public/bookings', body, {}, key)).json();
  assert.equal(again.replayed, true);
  assert.equal(again.bookingId, first.bookingId);
  const other = await post('/api/public/bookings', {...body, partySize: 4}, {}, key);
  assert.equal(other.status, 409);
  assert.equal((await other.json()).error, 'idempotency_conflict');
});

test('a reissued link replaces the old one, and replaying the original gives no access', async () => {
  const original = token();
  const key = randomUUID();
  const body = {
    intent: 'request',
    sessionId: 'demo-shrek-1',
    partySize: 2,
    leadName: 'Cliente de prueba enlace',
    contactKind: 'email',
    contactValue: 'enlace@example.com',
    note: null,
    token: original,
    terms: null,
    acceptedTerms: false,
  };
  const created = await (await post('/api/public/bookings', body, {}, key)).json();
  const view = await (await post('/api/public/manage', {token: original})).json();
  const fresh = token();
  const reissued = await post(
    `/api/equipo/bookings/${created.bookingId}/actions`,
    {action: 'reissue_link', expectedVersion: view.booking.version, token: fresh},
    OWNER,
  );
  assert.equal(reissued.status, 200);
  assert.equal((await post('/api/public/manage', {token: original})).status, 404);
  assert.equal((await post('/api/public/manage', {token: fresh})).status, 200);
  const count = async () =>
    (await (await fetch(`${BASE}/api/equipo/bookings?q=enlace`, {headers: OWNER})).json()).bookings.length;
  const before = await count();
  const replay = await (await post('/api/public/bookings', body, {}, key)).json();
  assert.deepEqual(Object.keys(replay).sort(), ['linkReplaced', 'ok', 'reference', 'replayed']);
  assert.equal(await count(), before);
});

test('the restricted Staff role cannot change settings, capacity or reset the demo', async () => {
  const staff = {'x-test-access-email': 'staff@example.com'};
  const setting = await post('/api/equipo/settings', {key: 'confirmed_bookings_enabled', value: '0'}, staff);
  assert.equal(setting.status, 403);
  const reset = await post('/api/equipo/demo/reset', {}, staff);
  assert.equal(reset.status, 403);
  // Capacity is the owner's decision: the same session edit is refused for Staff, allowed for the owner.
  const {session: s} = await (await fetch(`${BASE}/api/equipo/sessions/demo-prueba-b`, {headers: staff})).json();
  const fields = {
    experienceId: s.experience_id,
    venueId: s.venue_id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    capacity: s.capacity + 2,
    blockedSeats: s.blocked_seats,
    partyMin: s.party_min,
    partyMax: s.party_max,
    bookingMode: s.booking_mode,
    priceStatus: s.price_status,
    priceCents: s.price_cents,
    currency: s.currency,
    policyVersionId: s.policy_version_id,
    lowSeatsThreshold: s.low_seats_threshold,
  };
  const capacity = await post(`/api/equipo/sessions/${s.id}`, {expectedVersion: s.version, fields}, staff);
  assert.equal(capacity.status, 403);
  assert.equal((await capacity.json()).error, 'owner_only');
  const owner = await post(`/api/equipo/sessions/${s.id}`, {expectedVersion: s.version, fields}, OWNER);
  assert.equal(owner.status, 200);
});

// Last: it opens the same local database from a second process (wrangler d1 execute).
test('D1 runs the ledger triggers: a settled mutation cannot change or disappear', async () => {
  // A rejected staff action settles a ledger row through the Worker.
  const rejected = await post('/api/equipo/requests/none/resolve', {}, OWNER);
  assert.equal(rejected.status, 409);
  const count = () => /"n":\s*(\d+)/.exec(sqlite('SELECT COUNT(*) AS n FROM mutations'))?.[1];
  const before = count();
  assert.ok(Number(before) > 0);
  assert.match(
    sqlite(`UPDATE mutations SET reason = 'changed' WHERE state = 'rejected'`),
    /a settled mutation is immutable/,
  );
  assert.match(sqlite('DELETE FROM mutations'), /mutations are append-only/);
  assert.equal(count(), before);
});
