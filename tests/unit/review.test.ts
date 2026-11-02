// Regression tests for the bugs the November code review found, each through the Worker as a
// browser would reach it. Each one failed before its fix.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {call, env, key, OWNER_EMAIL, reserveVia, STAFF_EMAIL, token} from './http.ts';
import {DAY, freshDb, HOUR, NOW, SHOW, session} from './helpers.ts';
import type {TestD1} from './d1.ts';

const version = (db: TestD1, id: string) =>
  db.get<{version: number}>(`SELECT version FROM bookings WHERE id = ?`, id)!.version;
const act = (e: ReturnType<typeof env>, id: string, body: Record<string, unknown>, now?: number) =>
  call(e, `/api/equipo/bookings/${id}/actions`, {as: STAFF_EMAIL, body, now});

test('confirming a paid request in a session that takes no reservations is refused and changes nothing', async () => {
  const db = freshDb();
  const e = env({}, db);
  const made = await call(e, '/api/equipo/bookings', {
    as: STAFF_EMAIL,
    body: {
      sessionId: 'ses-inq',
      partySize: 2,
      leadName: 'Cliente de prueba 03',
      contactKind: 'phone',
      contactValue: '787-555-0103',
      note: null,
      source: 'instagram_dm',
    },
  });
  const id = made.json.outcome.id;
  const paid = await call(e, `/api/equipo/bookings/${id}/payments`, {
    as: STAFF_EMAIL,
    body: {
      kind: 'payment',
      method: 'ath_movil',
      amountCents: 2000,
      currency: 'USD',
      externalReference: null,
      reversesPaymentId: null,
      note: null,
    },
  });
  assert.equal(paid.response.status, 200);
  const confirm = await act(e, id, {action: 'confirm', expectedVersion: version(db, id)});
  assert.equal(confirm.response.status, 409);
  assert.equal(confirm.json.error, 'mode_not_confirmed');
  const row = db.get<{status: string; exception_reason: string | null}>(
    `SELECT status, exception_reason FROM bookings WHERE id = ?`,
    id,
  )!;
  assert.deepEqual({...row}, {status: 'inquiry', exception_reason: null});
});

test('a retried reservation reports the booking as it is now, not as it was made', async () => {
  const db = freshDb();
  const e = env({}, db);
  const t = token();
  const k = key();
  const first = await reserveVia(e, 'ses-conf', {token: t, key: k});
  assert.equal(first.json.status, 'confirmed');
  const cancelled = await act(e, first.json.bookingId, {action: 'cancel', expectedVersion: first.json.version});
  assert.equal(cancelled.response.status, 200);
  const replay = await reserveVia(e, 'ses-conf', {token: t, key: k});
  assert.equal(replay.json.replayed, true);
  assert.equal(replay.json.status, 'cancelled');
  assert.equal(replay.json.version, version(db, first.json.bookingId));
});

test('guests only ever see owner-approved experience text on a session on sale', async () => {
  const db = freshDb();
  const e = env({}, db);
  const fields = {
    titleEs: 'Barra libre incluida (no aprobado)',
    titleEn: null,
    descriptionEs: 'Texto que ningún dueño aprobó.',
    descriptionEn: null,
    inclusionsEs: null,
    inclusionsEn: null,
    photoSlot: null,
  };
  // An approved experience used by a published session can't go back to a draft, by anyone.
  for (const as of [STAFF_EMAIL, OWNER_EMAIL]) {
    const saved = await call(e, '/api/equipo/experiences/exp', {
      as,
      body: {expectedVersion: 1, fields: {...fields, status: 'draft'}},
    });
    assert.equal(saved.json.error, 'experience_in_use', as);
  }
  assert.equal((await call(e, '/api/public/sessions/ses-conf')).json.session.title.es, 'Experiencia de prueba');

  // A published session can't be pointed at an experience nobody approved.
  const draft = await call(e, '/api/equipo/experiences', {
    as: STAFF_EMAIL,
    body: {expectedVersion: null, fields: {...fields, status: 'draft'}},
  });
  const s = db.get<Record<string, unknown>>(`SELECT * FROM sessions WHERE id = 'ses-conf'`)!;
  const edit = await call(e, '/api/equipo/sessions/ses-conf', {
    as: STAFF_EMAIL,
    body: {
      expectedVersion: s.version,
      fields: {
        experienceId: draft.json.outcome.id,
        venueId: s.venue_id,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        capacity: s.capacity,
        blockedSeats: s.blocked_seats,
        partyMin: s.party_min,
        partyMax: s.party_max,
        bookingMode: s.booking_mode,
        priceStatus: s.price_status,
        priceCents: s.price_cents,
        currency: s.currency,
        policyVersionId: s.policy_version_id,
        lowSeatsThreshold: s.low_seats_threshold,
      },
    },
  });
  assert.equal(edit.json.error, 'experience_not_approved');
  assert.equal((await call(e, '/api/public/sessions/ses-conf')).json.session.title.es, 'Experiencia de prueba');

  // An experience no published session uses can still be edited as a draft.
  session(db, 'ses-other', {state: 'draft'});
  const free = await call(e, `/api/equipo/experiences/${draft.json.outcome.id}`, {
    as: STAFF_EMAIL,
    body: {expectedVersion: 1, fields: {...fields, titleEs: 'Otro borrador', status: 'draft'}},
  });
  assert.equal(free.response.status, 200);
});

test('the staff list shows what is coming up first, and says when it was cut', async () => {
  const db = freshDb();
  const e = env({}, db);
  session(db, 'ses-old', {startsAt: NOW - 60 * DAY, capacity: 5000, max: 60});
  for (let i = 0; i < 500; i++) {
    db.run(
      `INSERT INTO bookings (id, reference, session_id, party_size, lead_name, contact_kind, contact_value, status, source,
         version, created_at, updated_at) VALUES (?, ?, 'ses-old', 2, ?, 'email', 'a@example.com', 'fulfilled', 'web', 1, ?, ?)`,
      `old-${i}`,
      `PAP-OLD${String(i).padStart(3, '0')}`,
      `Antiguo ${i}`,
      NOW - 90 * DAY,
      NOW - 90 * DAY,
    );
  }
  const made = await reserveVia(e, 'ses-conf');
  const list = await call(e, '/api/equipo/bookings', {as: STAFF_EMAIL});
  assert.equal(list.json.bookings.length, 500);
  assert.equal(list.json.bookings[0].id, made.json.bookingId);
  assert.equal(list.json.truncated, true);
  const filtered = await call(e, '/api/equipo/bookings?status=confirmed', {as: STAFF_EMAIL});
  assert.equal(filtered.json.truncated, false);
});

test('a session is sold out once no allowed group fits, dated or not', async () => {
  const db = freshDb();
  const e = env({}, db);
  db.run(`UPDATE sessions SET party_min = 4 WHERE id = 'ses-conf'`); // groups of 4 to 8, 10 seats
  const made = await reserveVia(e, 'ses-conf', {partySize: 8});
  assert.equal(made.json.status, 'confirmed');
  const view = (await call(e, '/api/public/sessions/ses-conf')).json.session;
  assert.deepEqual([view.availability, view.action], ['sold_out', 'none']);

  session(db, 'ses-tbd', {
    mode: 'inquiry',
    venue: null,
    price: null,
    policy: null,
    capacity: 20,
    min: null,
    max: null,
    startsAt: null,
  });
  db.run(`UPDATE sessions SET blocked_seats = 20 WHERE id = 'ses-tbd'`);
  const tbd = (await call(e, '/api/public/sessions/ses-tbd')).json.session;
  assert.deepEqual([tbd.availability, tbd.action], ['sold_out', 'none']);
});

test('moving a booking that already arrived clears its arrival', async () => {
  const db = freshDb();
  const e = env({}, db);
  const showDay = SHOW - HOUR;
  const made = await reserveVia(e, 'ses-conf');
  const id = made.json.bookingId;
  const checked = await act(e, id, {action: 'check_in', expectedVersion: made.json.version}, showDay);
  assert.equal(checked.response.status, 200);
  const moved = await act(e, id, {action: 'move', expectedVersion: version(db, id), destination: 'ses-conf2'}, showDay);
  assert.equal(moved.response.status, 200);
  assert.equal(moved.json.outcome.checkedInAt, null);
  // On the new date, the group can be checked in again.
  const again = await act(e, id, {action: 'check_in', expectedVersion: version(db, id)}, SHOW + 7 * DAY - HOUR);
  assert.equal(again.response.status, 200);
});

test('a booking that ends withdraws its open terms proposals, and its page offers none', async () => {
  const db = freshDb();
  const e = env({}, db);
  const t = token();
  const made = await reserveVia(e, 'ses-conf', {token: t});
  const id = made.json.bookingId;
  const proposed = await act(e, id, {
    action: 'propose_terms',
    expectedVersion: made.json.version,
    sessionId: 'ses-pricier',
  });
  assert.equal(proposed.response.status, 200);
  const cancelled = await act(e, id, {action: 'cancel', expectedVersion: version(db, id)});
  assert.equal(cancelled.response.status, 200);
  const page = await call(e, '/api/public/manage', {body: {token: t}});
  assert.equal(page.json.booking.status, 'cancelled');
  assert.deepEqual(page.json.booking.proposals, []);
  const open = db.get<{n: number}>(
    `SELECT COUNT(*) AS n FROM term_proposals WHERE booking_id = ? AND status = 'open'`,
    id,
  )!;
  assert.equal(open.n, 0);
});

test('/politicas/ lists approved terms that start later apart from the ones in force', async () => {
  const db = freshDb();
  const e = env({}, db);
  db.run(
    `INSERT INTO policy_versions (id, title, text_es, state, applies_to, full_payment, refund_fraction_bp, cutoff_rule,
       effective_from, approved_at, approved_by, created_at, updated_at, updated_by)
     VALUES ('pol-later', 'Desde la próxima semana', 'Pago completo al reservar', 'approved', 'booking_time', 1, 6000,
       'none', ?, ?, 'owner@example.com', ?, ?, 'test')`,
    NOW + 7 * DAY,
    NOW,
    NOW,
    NOW,
  );
  const {json} = await call(e, '/api/public/policies');
  assert.ok(!json.current.some((p: {id: string}) => p.id === 'pol-later'));
  assert.deepEqual(
    json.upcoming.map((p: {id: string}) => p.id),
    ['pol-later'],
  );
  assert.ok(json.current.some((p: {id: string}) => p.id === 'pol-open'));
});

test('the history shows the team list to owners only, as the catalog does', async () => {
  const e = env();
  const added = await call(e, '/api/equipo/staff', {
    as: OWNER_EMAIL,
    body: {email: 'socia.privada@example.com', role: 'owner', active: true},
  });
  assert.equal(added.response.status, 200);
  const staffView = await call(e, '/api/equipo/audit', {as: STAFF_EMAIL});
  assert.ok(!JSON.stringify(staffView.json.events).includes('socia.privada@example.com'));
  const ownerView = await call(e, '/api/equipo/audit', {as: OWNER_EMAIL});
  assert.ok(JSON.stringify(ownerView.json.events).includes('socia.privada@example.com'));
});

test('editing a request records what changed in its history', async () => {
  const db = freshDb();
  const e = env({}, db);
  const made = await call(e, '/api/equipo/bookings', {
    as: STAFF_EMAIL,
    body: {
      sessionId: 'ses-conf',
      partySize: 2,
      leadName: 'Cliente de prueba 06',
      contactKind: 'email',
      contactValue: 'c6@example.com',
      note: null,
      source: 'phone',
    },
  });
  const id = made.json.outcome.id;
  const edited = await act(e, id, {
    action: 'edit',
    expectedVersion: 1,
    partySize: 2,
    leadName: 'Cliente de prueba 06 B',
    contactKind: 'email',
    contactValue: 'c6b@example.com',
    note: 'Llega tarde',
  });
  assert.equal(edited.response.status, 200);
  const audit = db.get<{before_json: string; after_json: string}>(
    `SELECT before_json, after_json FROM audit_events WHERE action = 'edit' AND target_id = ?`,
    id,
  )!;
  const before = JSON.parse(audit.before_json);
  const after = JSON.parse(audit.after_json);
  assert.deepEqual(
    [before.leadName, before.contactValue, before.note],
    ['Cliente de prueba 06', 'c6@example.com', null],
  );
  assert.deepEqual(
    [after.leadName, after.contactValue, after.note],
    ['Cliente de prueba 06 B', 'c6b@example.com', 'Llega tarde'],
  );
});

test('the session file gives arrival times in Puerto Rico time, with the offset', async () => {
  const db = freshDb();
  const e = env({}, db);
  const made = await reserveVia(e, 'ses-conf');
  const arrived = SHOW - HOUR; // 6:00 p. m. in Puerto Rico
  await act(e, made.json.bookingId, {action: 'check_in', expectedVersion: made.json.version}, arrived);
  const {response} = await call(e, '/api/equipo/export.csv?session=ses-conf', {as: STAFF_EMAIL});
  const text = await response.text();
  assert.match(text, /2026-10-16T18:00:00-04:00/);
  assert.doesNotMatch(text, /T22:00:00\.000Z/);
});
