// The Worker's HTTP layer, through its own fetch handler, on the real SQL: guards that fail
// closed, Access checks, headers on every response, roles, and the guest's link.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import worker from '../../worker/index.ts';
import type {Env} from '../../worker/env.ts';
import {freshDb, NOW} from './helpers.ts';
import {TestD1} from './d1.ts';
import {CSP} from '../../worker/http.ts';

const SHELL = '<!doctype html><html><head><title>Proyección al Paladar</title></head><body></body></html>';
const assets = {fetch: async () => new Response(SHELL, {headers: {'Content-Type': 'text/html; charset=utf-8'}})};

function env(over: Partial<Env> = {}, db: TestD1 = freshDb()): Env {
  return {
    APP_ENV: 'local',
    DEMO_MODE: '1',
    ACCESS_EVERYWHERE: '0',
    TEST_AUTH: '1',
    TEST_CLOCK: '1',
    DB: db,
    ASSETS: assets,
    ...over,
  };
}

interface Call {
  method?: string;
  body?: unknown;
  as?: string; // staff email (local test auth)
  key?: string; // Idempotency-Key
  origin?: string;
  host?: string;
}

async function call(e: Env, path: string, c: Call = {}) {
  const headers: Record<string, string> = {'x-test-now': String(NOW)};
  if (c.body !== undefined) headers['content-type'] = 'application/json';
  if (c.as) headers['x-test-access-email'] = c.as;
  if (c.key) headers['idempotency-key'] = c.key;
  if (c.origin) headers.origin = c.origin;
  const response = await worker.fetch(
    new Request(`http://${c.host ?? '127.0.0.1'}${path}`, {
      method: c.method ?? (c.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
    }),
    e,
  );
  const type = response.headers.get('content-type') || '';
  return {response, json: type.includes('json') ? await response.json() : null};
}

const token = () => randomBytes(32).toString('base64url');
const key = () => randomUUID();

async function reserveVia(e: Env, t: string, k = key(), partySize = 2) {
  const {json: session} = await call(e, '/api/public/sessions/ses-conf');
  return call(e, '/api/public/bookings', {
    key: k,
    body: {
      intent: 'reserve',
      sessionId: 'ses-conf',
      partySize,
      leadName: 'Cliente de prueba 01',
      contactKind: 'email',
      contactValue: 'cliente01@example.com',
      note: null,
      token: t,
      terms: session.session.terms,
      acceptedTerms: true,
    },
  });
}

test('the Worker fails closed on an unselected environment, a test switch outside local, or another database', async () => {
  for (const [name, e] of [
    ['unselected', env({APP_ENV: 'unselected'})],
    ['test switch in demo', env({APP_ENV: 'demo'})],
    ['local database in production', env({APP_ENV: 'production', TEST_AUTH: undefined, TEST_CLOCK: undefined})],
  ] as const) {
    const {response} = await call(e, '/api/public/config');
    assert.equal(response.status, 503, name);
    assert.equal(response.headers.get('cache-control'), 'no-store', name);
  }
  // Test switches are ignored away from a loopback host, even in local.
  const e = env();
  const {response} = await call(e, '/api/equipo/me', {as: 'owner@example.com', host: 'example.com'});
  assert.equal(response.status, 403);
});

test('with Access everywhere (the demo), every path needs an Access identity', async () => {
  const e = env({ACCESS_EVERYWHERE: '1'});
  for (const path of [
    '/',
    '/assets/app.js',
    '/api/public/config',
    '/funciones/ses-conf',
    '/reservacion/x',
    '/equipo',
  ]) {
    const {response} = await call(e, path);
    assert.equal(response.status, 403, path);
  }
  const {response} = await call(e, '/api/public/config', {as: 'someone@example.com'});
  assert.equal(response.status, 200);
});

test('every Worker response carries the security headers', async () => {
  const e = env();
  const t = token();
  await reserveVia(e, t);
  const cases: [string, Call][] = [
    ['/api/public/config', {}],
    ['/api/public/sessions/nope', {}],
    ['/api/nothing', {}],
    ['/', {}],
    ['/reservacion/abc', {}],
    ['/equipo', {}],
    ['/equipo', {as: 'owner@example.com'}],
    ['/api/equipo/me', {}],
    ['/api/public/manage', {body: {token: t}}],
  ];
  for (const [path, c] of cases) {
    const {response} = await call(e, path, c);
    const h = response.headers;
    assert.equal(h.get('content-security-policy'), CSP, path);
    assert.equal(h.get('x-content-type-options'), 'nosniff', path);
    assert.equal(h.get('x-frame-options'), 'DENY', path);
    assert.ok(h.get('permissions-policy'), path);
    assert.ok(h.get('referrer-policy'), path);
    assert.match(h.get('x-robots-tag') ?? '', /noindex/, path);
    if (path.startsWith('/api/') || path.startsWith('/equipo') || path.startsWith('/reservacion')) {
      assert.equal(h.get('cache-control'), 'no-store', path);
    }
  }
  const {response} = await call(e, '/reservacion/abc');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('staff paths need a listed email; roles are enforced on the server', async () => {
  const e = env();
  assert.equal((await call(e, '/api/equipo/me')).response.status, 403);
  assert.equal((await call(e, '/api/equipo/me', {as: 'stranger@example.com'})).response.status, 403);
  const page = await call(e, '/equipo/reservaciones', {as: 'stranger@example.com'});
  assert.equal(page.response.status, 403);
  assert.match(await page.response.text(), /Sin acceso al área del equipo/);

  const staff = await call(e, '/api/equipo/settings', {
    as: 'staff@example.com',
    key: key(),
    body: {key: 'required_contact', value: 'phone'},
  });
  assert.equal(staff.response.status, 403);
  assert.equal(staff.json.error, 'owner_only');
  const reset = await call(e, '/api/equipo/demo/reset', {as: 'staff@example.com', key: key(), body: {}});
  assert.equal(reset.response.status, 403);
  const owner = await call(e, '/api/equipo/settings', {
    as: 'owner@example.com',
    key: key(),
    body: {key: 'required_contact', value: 'phone'},
  });
  assert.equal(owner.response.status, 200);
});

test('writes need JSON from the same origin and an Idempotency-Key', async () => {
  const e = env();
  const cross = await call(e, '/api/public/manage', {body: {token: token()}, origin: 'https://evil.example'});
  assert.equal(cross.response.status, 403);
  const noKey = await call(e, '/api/public/bookings', {body: {}});
  assert.equal(noKey.json.error, 'idempotency_key_required');
  const form = await worker.fetch(
    new Request('http://127.0.0.1/api/public/manage', {
      method: 'POST',
      body: 'token=x',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
    }),
    e,
  );
  assert.equal(form.status, 415);
});

test('a reservation, its replay, a conflicting reuse, and the guest page', async () => {
  const e = env();
  const t = token();
  const k = key();
  const first = await reserveVia(e, t, k);
  assert.equal(first.response.status, 200);
  assert.equal(first.json.status, 'confirmed');
  const replay = await reserveVia(e, t, k);
  assert.equal(replay.json.replayed, true);
  assert.equal(replay.json.reference, first.json.reference);
  const conflict = await reserveVia(e, t, k, 3);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.json.error, 'idempotency_conflict');

  const page = await call(e, '/api/public/manage', {body: {token: t}});
  assert.equal(page.json.booking.reference, first.json.reference);
  assert.equal(page.json.booking.status, 'confirmed');
  const wrong = await call(e, '/api/public/manage', {body: {token: token()}});
  assert.equal(wrong.json.error, 'link_invalid');
});

test('after staff reissue the link, the old link and a replay of the original submission give no access', async () => {
  const db = freshDb();
  const e = env({}, db);
  const t = token();
  const k = key();
  const first = await reserveVia(e, t, k);
  const bookingsBefore = db.get<{n: number}>(`SELECT COUNT(*) AS n FROM bookings`)!.n;
  const fresh = token();
  const reissue = await call(e, `/api/equipo/bookings/${first.json.bookingId}/actions`, {
    as: 'staff@example.com',
    key: key(),
    body: {action: 'reissue_link', expectedVersion: first.json.version, token: fresh},
  });
  assert.equal(reissue.response.status, 200);

  assert.equal((await call(e, '/api/public/manage', {body: {token: t}})).json.error, 'link_invalid');
  assert.equal(
    (await call(e, '/api/public/manage', {body: {token: fresh}})).json.booking.reference,
    first.json.reference,
  );

  const replay = await reserveVia(e, t, k);
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.json, {ok: true, replayed: true, reference: first.json.reference, linkReplaced: true});
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM bookings`)!.n, bookingsBefore);
  // The plain token is never stored.
  assert.equal(
    db.get<{n: number}>(`SELECT COUNT(*) AS n FROM bookings WHERE token_digest = ? OR token_digest = ?`, t, fresh)!.n,
    0,
  );
});

test('a guest withdraws an inquiry from their page', async () => {
  const e = env();
  const t = token();
  const created = await call(e, '/api/public/bookings', {
    key: key(),
    body: {
      intent: 'request',
      sessionId: 'ses-inq',
      partySize: 4,
      leadName: 'Cliente de prueba 02',
      contactKind: 'phone',
      contactValue: '787-555-0102',
      note: 'Una persona celíaca.',
      token: t,
      terms: null,
      acceptedTerms: false,
    },
  });
  assert.equal(created.json.status, 'inquiry');
  const out = await call(e, '/api/public/manage/withdraw', {
    key: key(),
    body: {token: t, expectedVersion: created.json.version},
  });
  assert.equal(out.response.status, 200);
  assert.equal((await call(e, '/api/public/manage', {body: {token: t}})).json.booking.status, 'cancelled');
});

test('the public session view never offers what the server would refuse', async () => {
  const db = freshDb();
  const e = env({}, db);
  const {json: before} = await call(e, '/api/public/sessions/ses-conf');
  assert.equal(before.session.action, 'reserve');
  db.run(`UPDATE settings SET value = '0' WHERE key = 'confirmed_bookings_enabled'`);
  const {json: after} = await call(e, '/api/public/sessions/ses-conf');
  assert.equal(after.session.action, 'none');
  const {json: inquiry} = await call(e, '/api/public/sessions/ses-inq');
  assert.equal(inquiry.session.action, 'request');
  assert.equal(inquiry.session.venue, null);
  assert.equal(inquiry.session.price.status, 'unset');
});

test('demo HTML is marked before any API call, so the banner never appears late', async () => {
  const demo = await call(env(), '/politicas/');
  assert.match(await demo.response.text(), /<html data-demo="1">/);
  assert.equal(demo.response.headers.get('content-length'), null);
  const live = await call(env({DEMO_MODE: '0'}), '/politicas/');
  assert.doesNotMatch(await live.response.text(), /data-demo/);
});

test('retrying a staff create with the same key replays it instead of creating a second one', async () => {
  const db = freshDb();
  const e = env({}, db);
  const k = key();
  const body = {
    fields: {
      experienceId: 'exp',
      venueId: 'venue',
      startsAt: NOW + 40 * 24 * 60 * 60 * 1000,
      endsAt: null,
      capacity: 20,
      blockedSeats: 0,
      partyMin: 1,
      partyMax: 8,
      bookingMode: 'confirmed',
      priceStatus: 'not_charged',
      priceCents: null,
      currency: null,
      policyVersionId: 'pol-open',
      lowSeatsThreshold: null,
    },
  };
  const before = db.get<{n: number}>(`SELECT COUNT(*) AS n FROM sessions`)!.n;
  const first = await call(e, '/api/equipo/sessions', {as: 'owner@example.com', key: k, body});
  assert.equal(first.response.status, 200, JSON.stringify(first.json));
  const retry = await call(e, '/api/equipo/sessions', {as: 'owner@example.com', key: k, body});
  assert.equal(retry.response.status, 200, JSON.stringify(retry.json));
  assert.equal(retry.json.replayed, true);
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM sessions`)!.n, before + 1);

  const experience = {
    expectedVersion: null,
    fields: {
      titleEs: 'Nueva',
      titleEn: null,
      descriptionEs: null,
      descriptionEn: null,
      inclusionsEs: null,
      inclusionsEn: null,
      photoSlot: null,
      status: 'draft',
    },
  };
  const k2 = key();
  const made = await call(e, '/api/equipo/experiences', {as: 'owner@example.com', key: k2, body: experience});
  assert.equal(made.response.status, 200, JSON.stringify(made.json));
  const again = await call(e, '/api/equipo/experiences', {as: 'owner@example.com', key: k2, body: experience});
  assert.equal(again.json.replayed, true, JSON.stringify(again.json));
});

test('the CSV export never lets a spreadsheet read a cell as a formula, even after a line break', async () => {
  const db = freshDb();
  const e = env({}, db);
  // The public form refuses control characters in a name.
  const {json: session} = await call(e, '/api/public/sessions/ses-conf');
  const refused = await call(e, '/api/public/bookings', {
    key: key(),
    body: {
      intent: 'reserve',
      sessionId: 'ses-conf',
      partySize: 2,
      leadName: "Ana\r=cmd|' /C calc'!A0",
      contactKind: 'email',
      contactValue: 'ana@example.com',
      note: null,
      token: token(),
      terms: session.session.terms,
      acceptedTerms: true,
    },
  });
  assert.equal(refused.response.status, 400);
  // A row that already holds one (from anywhere) is still exported safely.
  db.run(
    `INSERT INTO bookings (id, reference, session_id, party_size, lead_name, contact_kind, contact_value, status, source,
       version, created_at, updated_at) VALUES ('b-csv', 'PAP-CSV001', 'ses-conf', 2, ?, 'phone', ?, 'confirmed', 'web', 1, ?, ?)`,
    "Ana\r=cmd|' /C calc'!A0",
    '7875550\r+1+1',
    NOW,
    NOW,
  );
  const csv = await call(e, '/api/equipo/export.csv?session=ses-conf', {as: 'owner@example.com'});
  const text = await csv.response.text();
  const lines = text.split(/\r\n|\r|\n/);
  for (const line of lines) {
    for (const cell of line.split(','))
      assert.doesNotMatch(cell, /^"?[=+\-@]/, `a cell starts like a formula: ${cell}`);
  }
  assert.ok(text.includes('Ana'));
});

test('a booking’s history starts with its creation', async () => {
  const db = freshDb();
  const e = env({}, db);
  const made = await reserveVia(e, token());
  assert.equal(made.response.status, 200);
  const event = db.get<{after_json: string | null}>(
    `SELECT after_json FROM audit_events WHERE action = 'create_reservation'`,
  )!;
  assert.equal(JSON.parse(event.after_json ?? 'null')?.id, made.json.bookingId);
  const detail = await call(e, `/api/equipo/bookings/${made.json.bookingId}`, {as: 'owner@example.com'});
  assert.deepEqual(
    detail.json.audit.map((a: {action: string}) => a.action),
    ['create_reservation'],
  );
});

test('terms past their end date are listed as earlier, never as in force', async () => {
  const db = freshDb();
  const e = env({}, db);
  db.run(
    `INSERT INTO policy_versions (id, title, text_es, state, applies_to, full_payment, cutoff_rule, effective_from, effective_until,
       approved_at, approved_by, created_at, updated_at, updated_by)
     VALUES ('pol-ended', 'Terminada', 'Términos que ya terminaron', 'approved', 'booking_time', 0, 'none', ?, ?, ?, 'owner@example.com', ?, ?, 'test')`,
    NOW - 60 * 24 * 60 * 60 * 1000,
    NOW - 24 * 60 * 60 * 1000,
    NOW,
    NOW,
    NOW,
  );
  const {json} = await call(e, '/api/public/policies');
  assert.ok(!json.current.some((p: {id: string}) => p.id === 'pol-ended'), 'not under Vigentes');
  assert.ok(
    json.earlier.some((p: {id: string}) => p.id === 'pol-ended'),
    'under earlier versions',
  );
});
