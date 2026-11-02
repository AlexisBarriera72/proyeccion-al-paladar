// The door: guests who arrive without a reservation (walk-ins), the booking number by text, and
// the Recepción data. Rules on the real SQL, then the same paths through the Worker.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import worker from '../../worker/index.ts';
import type {Env} from '../../worker/env.ts';
import {
  cancel,
  confirm,
  createWalkIn,
  recordPayment,
  type CreateBookingInput,
  type SeenTerms,
} from '../../worker/rules.ts';
import {bookingTextBody, deliverTexts, toE164, type TextSender} from '../../worker/texts.ts';
import {prDayBounds} from '../../shared/time.ts';
import {act, booking, bookingInput, freshDb, HOUR, DAY, inquire, NOW, reserve, SHOW} from './helpers.ts';
import type {TestD1} from './d1.ts';

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

const texts = (db: TestD1, bookingId: string) =>
  db.rows<{id: string; status: string; to_number: string; body: string | null; provider_id: string | null}>(
    `SELECT * FROM text_messages WHERE booking_id = ? ORDER BY created_at, rowid`,
    bookingId,
  );

/** A sender that records what it was asked to send. */
function recordingSender(answer: Awaited<ReturnType<TextSender['send']>> = {ok: true, id: 'SM-test'}) {
  const sent: {to: string; body: string}[] = [];
  const sender: TextSender = {
    async send(to, body) {
      sent.push({to, body});
      return answer;
    },
  };
  return {sender, sent};
}

const noEnv = {} as Env;

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

test('a text is queued only when the booking is confirmed and its guest asked for one', async () => {
  const db = freshDb();
  const asked = await reserve(db, 'ses-conf', 2, {textTo: '+17875550142'});
  assert.equal(asked.result.kind, 'applied');
  assert.deepEqual(
    texts(db, asked.input.bookingId).map(t => [t.status, t.to_number]),
    [['queued', '+17875550142']],
  );

  const silent = await reserve(db, 'ses-conf', 2);
  assert.equal(texts(db, silent.input.bookingId).length, 0);

  // A request holds no seats and isn't confirmed: nothing.
  const request = await inquire(db, 'ses-conf', 2, true, {textTo: '+17875550144'});
  assert.equal(texts(db, request.input.bookingId).length, 0);

  // Prepaid terms: pending payment, so nothing yet; staff confirm once the money is in, and that
  // confirmation queues the text, once.
  const pending = await reserve(db, 'ses-pre', 2, {textTo: '+17875550143'});
  const id = pending.input.bookingId;
  assert.equal(booking(db, id).status, 'pending_payment');
  assert.equal(texts(db, id).length, 0);
  const paid = await act(db, {action: 'record_payment', targetType: 'booking', targetId: id}, mutationId =>
    recordPayment({
      paymentId: randomUUID(),
      bookingId: id,
      kind: 'payment',
      method: 'efectivo',
      amountCents: 5000,
      currency: 'USD',
      externalReference: null,
      reversesPaymentId: null,
      note: null,
      recordedBy: 'owner@example.com',
      mutationId,
      now: NOW,
    }),
  );
  assert.equal(paid.kind, 'applied');
  assert.equal(texts(db, id).length, 0);
  const version = booking(db, id).version;
  const confirmed = await act(
    db,
    {action: 'confirm', targetType: 'booking', targetId: id, expectedVersion: version},
    mutationId => confirm({id, expectedVersion: version, mutationId, now: NOW}),
  );
  assert.equal(confirmed.kind, 'applied');
  assert.deepEqual(
    texts(db, id).map(t => [t.status, t.to_number]),
    [['queued', '+17875550143']],
  );
});

// ------------------------------------------------------------------ texts: sending

test('a queued text is sent once, and its status is what the provider answered', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2, {textTo: '+17875550142', reference: 'PAP-7Q2K4M'});
  const {sender, sent} = recordingSender({ok: true, id: 'SM123'});
  const first = await deliverTexts(db, noEnv, NOW, input.bookingId, sender);
  assert.equal(first?.status, 'sent');
  assert.equal(first?.to, '••• 0142');
  const again = await deliverTexts(db, noEnv, NOW, input.bookingId, sender);
  assert.equal(again?.status, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, '+17875550142');
  const [row] = texts(db, input.bookingId);
  assert.equal(row.provider_id, 'SM123');
  assert.equal(row.body, sent[0].body);
  // Each step is in the history.
  const steps = db.rows<{action: string}>(
    `SELECT action FROM audit_events WHERE target_type = 'message' AND target_id = ? ORDER BY at, rowid`,
    row.id,
  );
  assert.deepEqual(
    steps.map(s => s.action),
    ['text_claim', 'text_result'],
  );
});

test('two deliveries at the same time send a text only once', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2, {textTo: '+17875550142'});
  const {sender, sent} = recordingSender();
  await Promise.all([
    deliverTexts(db, noEnv, NOW, input.bookingId, sender),
    deliverTexts(db, noEnv, NOW, input.bookingId, sender),
  ]);
  assert.equal(sent.length, 1);
});

test('a refused, unanswered or unconfigured text is never reported as sent', async () => {
  for (const [answer, status] of [
    [{ok: false, error: 'twilio_21211', answered: true}, 'failed'],
    [{ok: false, error: 'TimeoutError', answered: false}, 'unknown'],
  ] as const) {
    const db = freshDb();
    const {input} = await reserve(db, 'ses-conf', 2, {textTo: '+17875550142'});
    const result = await deliverTexts(db, noEnv, NOW, input.bookingId, recordingSender(answer).sender);
    assert.equal(result?.status, status);
  }
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2, {textTo: '+17875550142'});
  const off = await deliverTexts(db, noEnv, NOW, input.bookingId, null);
  assert.equal(off?.status, 'skipped');
});

test('the text names the business, the number and the date, never the private link', () => {
  const es = bookingTextBody({reference: 'PAP-7Q2K4M', startsAt: SHOW, lang: 'es'});
  const en = bookingTextBody({reference: 'PAP-7Q2K4M', startsAt: SHOW, lang: 'en'});
  for (const body of [es, en]) {
    assert.match(body, /Proyección al Paladar/);
    assert.match(body, /PAP-7Q2K4M/);
    assert.doesNotMatch(body, /https?:|\/reservacion\//);
    assert.ok(body.length <= 160 * 2, 'two text segments at most');
  }
  assert.match(es, /hora de Puerto Rico/);
  assert.match(en, /Puerto Rico time/);
});

test('only +1 numbers can take a text: Puerto Rico, the U.S. and the rest of the plan', () => {
  assert.equal(toE164('787-555-0142'), '+17875550142');
  assert.equal(toE164('(787) 555 0142'), '+17875550142');
  assert.equal(toE164('1 787 555 0142'), '+17875550142');
  assert.equal(toE164('+1 939 555 0142'), '+19395550142');
  // International and premium numbers would cost the business: refused.
  assert.equal(toE164('+34 600 000 000'), null);
  assert.equal(toE164('+882 1600 1234'), null);
  // Too short, or not a real area code or exchange.
  assert.equal(toE164('555-0142'), null);
  assert.equal(toE164('+1'), null);
  assert.equal(toE164('011 555 0142 99'), null);
  assert.equal(toE164('787-155-0142'), null);
});

test('a queued text whose booking was cancelled before it went out is skipped, never sent', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2, {textTo: '+17875550142'});
  const id = input.bookingId;
  const version = booking(db, id).version;
  const cancelled = await act(
    db,
    {action: 'cancel', targetType: 'booking', targetId: id, expectedVersion: version},
    mutationId => cancel({id, expectedVersion: version, mutationId, now: NOW}),
  );
  assert.equal(cancelled.kind, 'applied');
  const {sender, sent} = recordingSender();
  const result = await deliverTexts(db, noEnv, NOW, id, sender);
  assert.equal(sent.length, 0);
  assert.equal(result?.status, 'skipped');
  assert.equal(texts(db, id)[0].status, 'skipped');
});

// ------------------------------------------------------------------ through the Worker

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

async function call(e: Env, path: string, c: {body?: unknown; as?: string; now?: number} = {}) {
  const headers: Record<string, string> = {'x-test-now': String(c.now ?? NOW)};
  if (c.body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = randomUUID();
  }
  if (c.as) headers['x-test-access-email'] = c.as;
  const response = await worker.fetch(
    new Request(`http://127.0.0.1${path}`, {
      method: c.body !== undefined ? 'POST' : 'GET',
      headers,
      body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
    }),
    e,
  );
  const json = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null;
  return {response, json};
}

const reserveBody = async (e: Env, over: Record<string, unknown> = {}, sessionId = 'ses-conf') => {
  const {json: session} = await call(e, `/api/public/sessions/${sessionId}`);
  return {
    intent: 'reserve',
    sessionId,
    partySize: 2,
    leadName: 'Cliente de prueba 01',
    contactKind: 'phone',
    contactValue: '787-555-0142',
    note: null,
    token: randomBytes(32).toString('base64url'),
    terms: session.session.terms,
    acceptedTerms: true,
    textConsent: true,
    ...over,
  };
};

test('texts are off until a provider is set up: nothing is queued and nothing is claimed', async () => {
  const db = freshDb();
  const e = env({}, db);
  assert.equal((await call(e, '/api/public/config')).json.texts, false);
  const {json} = await call(e, '/api/public/bookings', {body: await reserveBody(e)});
  assert.equal(json.status, 'confirmed');
  assert.equal(json.text, null);
  assert.equal(json.textNumberRefused, false);
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM text_messages`)!.n, 0);
  assert.equal(db.get<{t: string | null}>(`SELECT text_to AS t FROM bookings`)!.t, null);
});

test('the fake sender works only in local, and the Worker fails closed if it is set elsewhere', async () => {
  const {response} = await call(
    env({APP_ENV: 'demo', TEST_AUTH: undefined, TEST_CLOCK: undefined, TEXT_FAKE: '1'}),
    '/api/public/config',
  );
  assert.equal(response.status, 503);
});

test('a guest who asked gets their number by text, and their page says what the provider answered', async () => {
  const db = freshDb();
  const e = env({TEXT_FAKE: '1'}, db);
  assert.equal((await call(e, '/api/public/config')).json.texts, true);
  const body = await reserveBody(e);
  const {json} = await call(e, '/api/public/bookings', {body});
  assert.equal(json.status, 'confirmed');
  assert.equal(json.text.status, 'sent');
  assert.equal(json.text.to, '••• 0142');
  const view = await call(e, '/api/public/manage', {body: {token: body.token}});
  assert.equal(view.json.booking.text.status, 'sent');

  // A number that can't take a text is said so, and nothing is queued for it.
  const short = await call(e, '/api/public/bookings', {
    body: await reserveBody(e, {contactValue: '555-0142', leadName: 'Cliente de prueba 02'}),
  });
  assert.equal(short.json.text, null);
  assert.equal(short.json.textNumberRefused, true);
  // No consent, no text.
  const quiet = await call(e, '/api/public/bookings', {
    body: await reserveBody(e, {textConsent: false, leadName: 'Cliente de prueba 03'}),
  });
  assert.equal(quiet.json.text, null);
});

test('a staff confirmation texts the number to a guest who asked for it', async () => {
  const e = env({TEXT_FAKE: '1'});
  const staff = 'staff@example.com';
  // Prepaid terms: the reservation waits for payment, so no text yet.
  const created = await call(e, '/api/public/bookings', {
    body: await reserveBody(e, {contactValue: '787-555-0145'}, 'ses-pre'),
  });
  assert.equal(created.json.status, 'pending_payment');
  assert.equal(created.json.text, null);
  const id = created.json.bookingId;
  // A staff member's own manual request records the guest's consent too.
  const manual = await call(e, '/api/equipo/bookings', {
    as: staff,
    body: {
      sessionId: 'ses-conf',
      partySize: 2,
      leadName: 'Cliente de prueba 04',
      contactKind: 'phone',
      contactValue: '787-555-0146',
      note: null,
      source: 'phone',
      textConsent: true,
    },
  });
  assert.equal(manual.response.status, 200);
  const paid = await call(e, `/api/equipo/bookings/${id}/payments`, {
    as: staff,
    body: {
      kind: 'payment',
      method: 'efectivo',
      amountCents: 5000,
      currency: 'USD',
      externalReference: null,
      reversesPaymentId: null,
      note: null,
    },
  });
  assert.equal(paid.response.status, 200);
  const confirmed = await call(e, `/api/equipo/bookings/${id}/actions`, {
    as: staff,
    body: {action: 'confirm', expectedVersion: paid.json.outcome.version},
  });
  assert.equal(confirmed.json.outcome.status, 'confirmed');
  assert.equal(confirmed.json.text.status, 'sent');
  const detail = await call(e, `/api/equipo/bookings/${id}`, {as: 'staff@example.com'});
  assert.equal(detail.json.text.status, 'sent');
  assert.equal(detail.json.booking.wants_text, 1);
});

test('the door: tonight lists every booking and session of the day, and a walk-in gets a number', async () => {
  const db = freshDb();
  const e = env({}, db);
  const day = SHOW - 2 * HOUR;
  const staff = 'staff@example.com';
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
