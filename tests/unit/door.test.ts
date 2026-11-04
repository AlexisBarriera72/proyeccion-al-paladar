// The door: guests who arrive without a reservation (walk-ins) and tonight's list for Recepción.
// The rules on the real SQL, then the same paths through the Worker.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWalkIn, type CreateBookingInput, type SeenTerms} from '../../worker/rules.ts';
import {prDayBounds, prLocalToUtc} from '../../shared/time.ts';
import {demoSeed, seedSqlFile} from '../../worker/seed.ts';
import {TestD1} from './d1.ts';
import {act, booking, bookingInput, freshDb, HOUR, DAY, inquire, NOW, reserve, SHOW} from './helpers.ts';
import {call, env, STAFF_EMAIL} from './http.ts';

const termsOf = (db: TestD1, sessionId: string): SeenTerms => {
  const s = db.get<{
    policy_version_id: string;
    price_status: 'approved' | 'not_charged';
    price_cents: number | null;
    currency: string | null;
  }>(`SELECT policy_version_id, price_status, price_cents, currency FROM sessions WHERE id = ?`, sessionId)!;
  return {
    policyVersionId: s.policy_version_id,
    priceStatus: s.price_status,
    unitPriceCents: s.price_cents,
    currency: s.currency,
  };
};

async function walkIn(
  db: TestD1,
  sessionId: string,
  partySize: number,
  now: number,
  o: {seen?: SeenTerms; extra?: Partial<CreateBookingInput>} = {},
) {
  const input = bookingInput(sessionId, partySize, {source: 'in_person', tokenDigest: null, now, ...o.extra});
  const [dayStart, dayEnd] = prDayBounds(now);
  const result = await act(
    db,
    {action: 'walk_in', targetType: 'session', targetId: sessionId, mutationId: input.mutationId, now},
    mutationId => createWalkIn({...input, mutationId, dayStart, dayEnd}, o.seen ?? termsOf(db, sessionId)),
  );
  return {result, input};
}

// ------------------------------------------------------------------ walk-ins

test('a walk-in under terms with no prepayment is confirmed and marked arrived, accepted in person', async () => {
  const db = freshDb();
  const now = SHOW - 2 * HOUR; // the session's own day, before it starts
  const {result, input} = await walkIn(db, 'ses-conf', 3, now);
  assert.equal(result.kind, 'applied');
  const row = booking(db, input.bookingId);
  assert.equal(row.status, 'confirmed');
  assert.equal(row.checked_in_at, now);
  assert.equal(row.accepted_policy_version_id, 'pol-open');
  const acceptance = db.get<{channel: string; accepted_at: number}>(
    `SELECT channel, accepted_at FROM term_acceptances WHERE booking_id = ?`,
    input.bookingId,
  )!;
  assert.deepEqual({...acceptance}, {channel: 'in_person', accepted_at: now});
  // Its history starts with the row it made.
  const audit = db.get<{after_json: string}>(
    `SELECT after_json FROM audit_events WHERE mutation_id = ?`,
    input.mutationId,
  )!;
  assert.equal(JSON.parse(audit.after_json).status, 'confirmed');
});

test('a walk-in under prepaid terms waits for payment and is not marked arrived', async () => {
  const db = freshDb();
  const now = SHOW + 2 * DAY - 2 * HOUR; // ses-pre's day
  const {result, input} = await walkIn(db, 'ses-pre', 2, now);
  assert.equal(result.kind, 'applied');
  const row = booking(db, input.bookingId);
  assert.equal(row.status, 'pending_payment');
  assert.equal(row.checked_in_at, null);
});

test('a walk-in may arrive after the session began, the same day', async () => {
  const db = freshDb();
  const {result} = await walkIn(db, 'ses-conf', 2, SHOW + 30 * 60 * 1000);
  assert.equal(result.kind, 'applied');
});

test('a walk-in is refused on another day, without seats, outside the limits or under changed terms', async () => {
  const db = freshDb();
  const day = SHOW - 2 * HOUR;
  const other = await walkIn(db, 'ses-conf', 2, NOW);
  assert.deepEqual([other.result.kind, (other.result as {reason?: string}).reason], ['rejected', 'not_session_day']);

  const limits = await walkIn(db, 'ses-conf', 9, day);
  assert.equal((limits.result as {reason?: string}).reason, 'party_size_limits');

  const changed = await walkIn(db, 'ses-conf', 2, day, {seen: {...termsOf(db, 'ses-conf'), priceStatus: 'approved'}});
  assert.equal((changed.result as {reason?: string}).reason, 'terms_changed');

  await reserve(db, 'ses-conf', 8);
  const full = await walkIn(db, 'ses-conf', 3, day);
  assert.equal((full.result as {reason?: string}).reason, 'no_seats');
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM bookings WHERE source = 'in_person'`)!.n, 0);
});

test('a walk-in uses only a contact kind the business accepts', async () => {
  const db = freshDb();
  db.run(`UPDATE settings SET value = 'phone' WHERE key = 'required_contact'`);
  const {result} = await walkIn(db, 'ses-conf', 2, SHOW - HOUR);
  assert.equal((result as {reason?: string}).reason, 'contact_kind_not_accepted');
  const phone = await walkIn(db, 'ses-conf', 2, SHOW - HOUR, {
    extra: {contactKind: 'phone', contactValue: '787-555-0142'},
  });
  assert.equal(phone.result.kind, 'applied');
});

// ------------------------------------------------------------------ texts: queueing

// ------------------------------------------------------------------ through the Worker

test('the door: tonight lists every booking and session of the day, and a walk-in gets a number', async () => {
  const db = freshDb();
  const e = env({}, db);
  const day = SHOW - 2 * HOUR;
  const staff = STAFF_EMAIL;
  // A request and a reservation for tonight, and one for another day.
  await inquire(db, 'ses-conf', 2, true, {leadName: 'Cliente en espera'});
  await reserve(db, 'ses-conf', 2, {leadName: 'Cliente confirmado', reference: 'PAP-ABCD23'});
  await reserve(db, 'ses-conf2', 2, {leadName: 'Cliente de otro día'});

  const tonight = await call(e, '/api/equipo/tonight', {as: staff, now: day});
  const names = tonight.json.bookings.map((b: {lead_name: string}) => b.lead_name).sort();
  assert.deepEqual(names, ['Cliente confirmado', 'Cliente en espera']);
  // Every open session of the day; ses-inq (requests only) says what it lacks for a walk-in.
  const session = tonight.json.sessions.find((x: {id: string}) => x.id === 'ses-conf');
  const inquiryOnly = tonight.json.sessions.find((x: {id: string}) => x.id === 'ses-inq');
  assert.ok(inquiryOnly.missing.includes('mode_not_confirmed'));
  assert.deepEqual(session.missing, []);
  assert.equal(session.policy.id, 'pol-open');

  const terms = {
    policyVersionId: session.policy_version_id,
    priceStatus: session.price_status,
    unitPriceCents: session.price_cents,
    currency: session.currency,
  };
  const walkInBody = {
    sessionId: 'ses-conf',
    partySize: 2,
    leadName: 'Cliente sin reservación',
    contactKind: 'phone',
    contactValue: '787-555-0146',
    note: null,
    terms,
    acceptedTerms: true,
  };
  // The terms must be accepted, in person.
  const unaccepted = await call(e, '/api/equipo/walk-ins', {
    as: staff,
    now: day,
    body: {...walkInBody, acceptedTerms: false},
  });
  assert.equal(unaccepted.json.error, 'terms_required');

  const walked = await call(e, '/api/equipo/walk-ins', {as: staff, now: day, body: walkInBody});
  assert.equal(walked.response.status, 200);
  assert.equal(walked.json.outcome.status, 'confirmed');
  assert.equal(walked.json.outcome.checkedInAt, day);
  assert.match(walked.json.outcome.reference, /^PAP-[A-Z0-9]{6}$/);

  // Not on another day.
  const early = await call(e, '/api/equipo/walk-ins', {as: staff, now: NOW, body: walkInBody});
  assert.equal(early.json.error, 'not_session_day');
});

test('the demo has a session tonight: Esta noche lists its guests, and it takes walk-ins', async () => {
  const db = new TestD1().migrate();
  db.run(`INSERT INTO deployment_meta (id, environment, created_at) VALUES (1, 'local', ?)`, NOW);
  db.run(
    `INSERT INTO staff_members (email, role, created_at, updated_at) VALUES ('staff@example.com', 'staff', ?, ?)`,
    NOW,
    NOW,
  );
  db.sqlite.exec(seedSqlFile(demoSeed(NOW)));
  const tonight = await call(env({}, db), '/api/equipo/tonight', {as: STAFF_EMAIL, now: NOW});
  const session = tonight.json.sessions.find((x: {id: string}) => x.id === 'demo-prueba-hoy');
  assert.deepEqual(session.missing, [], 'it can take walk-ins');
  assert.deepEqual(tonight.json.bookings.map((b: {reference: string}) => b.reference).sort(), [
    'PAP-DEMO05',
    'PAP-DEMO06',
    'PAP-DEMO07',
  ]);
  // One guest gave a phone, so Recepción can find them by its digits.
  assert.ok(tonight.json.bookings.some((b: {contact_value: string}) => b.contact_value === '787-555-0107'));
  // Whenever the demo is reset, tonight's session hasn't started yet.
  for (const hour of [0, 9, 18, 19, 21, 22, 23]) {
    const resetAt = prLocalToUtc(2026, 10, 8, hour, 45);
    const row = demoSeed(resetAt).find(r => r.table === 'sessions' && r.values.id === 'demo-prueba-hoy')!;
    assert.ok((row.values.starts_at as number) > resetAt, `reset at ${hour}:45`);
  }
});
