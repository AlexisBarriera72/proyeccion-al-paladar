// Rules by action, on the real SQL: each action has its own checks; seats, terms and money
// are decided inside the writing statement.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
  act,
  booking,
  confirmedSeats,
  count,
  DAY,
  freshDb,
  HOUR,
  inquire,
  NOW,
  reserve,
  session,
  SHOW,
} from './helpers.ts';
import {
  acceptTerms,
  cancel,
  checkIn,
  confirm,
  markOutcome,
  moveConfirmed,
  proposeTerms,
  recordPayment,
  resize,
  resolveOther,
  resolveSame,
  withdraw,
} from '../../worker/rules.ts';
import type {TestD1} from './d1.ts';

const run = (
  db: TestD1,
  action: string,
  id: string,
  expectedVersion: number | null,
  makeSpec: Parameters<typeof act>[2],
  payload: unknown = {},
) => act(db, {action, targetType: 'booking', targetId: id, expectedVersion, payload}, makeSpec);

const versionOf = (db: TestD1, id: string) => booking(db, id).version;

async function pay(
  db: TestD1,
  id: string,
  kind: 'payment' | 'refund' | 'reversal',
  amountCents: number,
  extra: {ref?: string | null; reverses?: string | null} = {},
) {
  const mutationId = randomUUID();
  const paymentId = randomUUID();
  const result = await act(
    db,
    {action: 'record_payment', targetType: 'booking', targetId: id, payload: {kind, amountCents, ...extra}, mutationId},
    mid =>
      recordPayment({
        paymentId,
        bookingId: id,
        kind,
        method: 'ath_movil',
        amountCents,
        currency: 'USD',
        externalReference: extra.ref ?? null,
        reversesPaymentId: extra.reverses ?? null,
        note: null,
        recordedBy: 'owner@example.com',
        mutationId: mid,
        now: NOW,
      }),
  );
  return {result, paymentId};
}

async function guestAccept(db: TestD1, bookingId: string, sessionId: string) {
  const v = versionOf(db, bookingId);
  const proposalId = randomUUID();
  const proposed = await run(
    db,
    'propose_terms',
    bookingId,
    v,
    mid =>
      proposeTerms({
        id: bookingId,
        expectedVersion: v,
        mutationId: mid,
        now: NOW,
        proposalId,
        sessionId,
        actor: 'staff:owner@example.com',
      }),
    {sessionId},
  );
  assert.equal(proposed.kind, 'applied', JSON.stringify(proposed));
  const digest = booking(db, bookingId).token_digest!;
  const accepted = await act(
    db,
    {action: 'accept_terms', targetType: 'booking', targetId: bookingId, actor: 'guest', payload: {proposalId}},
    mid =>
      acceptTerms({bookingId, proposalId, tokenDigest: digest, acceptanceId: randomUUID(), mutationId: mid, now: NOW}),
  );
  assert.equal(accepted.kind, 'applied', JSON.stringify(accepted));
}

test('an inquiry needs no venue, price or approved policy, and holds no seats', async () => {
  const db = freshDb();
  const {result, input} = await inquire(db, 'ses-inq', 4);
  assert.equal(result.kind, 'applied');
  assert.equal(booking(db, input.bookingId).status, 'inquiry');
  assert.equal(confirmedSeats(db, 'ses-inq'), 0);
  // Guests can't send an inquiry to a session that confirms bookings (they must accept terms).
  const guest = await inquire(db, 'ses-conf', 2);
  assert.equal(guest.result.kind === 'rejected' && guest.result.reason, 'mode_requires_terms');
  // Staff can log one there (from an Instagram DM).
  const staff = await inquire(db, 'ses-conf', 2, true);
  assert.equal(staff.result.kind, 'applied');
});

test('a reservation on a prepaid session is pending payment and holds no seats', async () => {
  const db = freshDb();
  const {result, input} = await reserve(db, 'ses-pre', 3);
  assert.equal(result.kind, 'applied');
  assert.equal(booking(db, input.bookingId).status, 'pending_payment');
  assert.equal(confirmedSeats(db, 'ses-pre'), 0);
  assert.equal(count(db, 'term_acceptances'), 1);
});

test('self-confirm needs every confirmable part, checked inside the write', async () => {
  const db = freshDb();
  const ok = await reserve(db, 'ses-conf', 2);
  assert.equal(ok.result.kind, 'applied');
  assert.equal(booking(db, ok.input.bookingId).status, 'confirmed');
  assert.equal(confirmedSeats(db, 'ses-conf'), 2);

  // Each missing part blocks it, with its own reason.
  const cases: [string, (db: TestD1) => void, string][] = [
    ['venue', d => d.run(`UPDATE sessions SET venue_id = 'venue-draft' WHERE id = 'ses-conf'`), 'venue_not_approved'],
    [
      'switch',
      d => d.run(`UPDATE settings SET value = '0' WHERE key = 'confirmed_bookings_enabled'`),
      'confirmations_off',
    ],
    [
      'policy',
      d => d.run(`UPDATE sessions SET policy_version_id = 'pol-draft' WHERE id = 'ses-conf'`),
      'policy_not_approved',
    ],
    ['mode', d => d.run(`UPDATE sessions SET booking_mode = 'inquiry' WHERE id = 'ses-conf'`), 'mode_not_confirmed'],
    ['price', d => d.run(`UPDATE sessions SET price_status = 'unset' WHERE id = 'ses-conf'`), 'price_missing'],
  ];
  for (const [name, breakIt, reason] of cases) {
    const d = freshDb();
    breakIt(d);
    const r = await reserve(d, 'ses-conf', 2, {});
    assert.equal(r.result.kind, 'rejected', name);
    // The terms the guest saw no longer match after some edits; the first failing check wins.
    assert.ok(
      r.result.kind === 'rejected' && [reason, 'terms_changed'].includes(r.result.reason),
      `${name}: ${r.result.kind === 'rejected' && r.result.reason}`,
    );
    assert.equal(count(d, 'bookings'), 0, name);
  }
});

test('the last seats go to exactly one of two competing reservations', async () => {
  const db = freshDb();
  await reserve(db, 'ses-conf', 6);
  const [a, b] = await Promise.all([reserve(db, 'ses-conf', 3), reserve(db, 'ses-conf', 3)]);
  const kinds = [a.result.kind, b.result.kind].sort();
  assert.deepEqual(kinds, ['applied', 'rejected']);
  assert.equal(confirmedSeats(db, 'ses-conf'), 9);
  const rejected = [a, b].find(r => r.result.kind === 'rejected')!;
  assert.equal(rejected.result.kind === 'rejected' && rejected.result.reason, 'no_seats');
});

test('a direct confirmation fails while any confirmable part is missing, and stays an inquiry', async () => {
  const db = freshDb();
  const {input} = await inquire(db, 'ses-inq', 2);
  const id = input.bookingId;
  const r = await run(db, 'confirm', id, 1, mid => confirm({id, expectedVersion: 1, mutationId: mid, now: NOW}));
  assert.equal(r.kind, 'rejected');
  assert.equal(r.kind === 'rejected' && r.reason, 'mode_not_confirmed');
  assert.equal(booking(db, id).status, 'inquiry');
});

test('resize leaves out the booking’s own seats before checking the new size', async () => {
  const db = freshDb();
  const mine = await reserve(db, 'ses-conf', 4);
  await reserve(db, 'ses-conf', 6); // full: 10 of 10
  const id = mine.input.bookingId;
  const to = async (m: number) => {
    const v = versionOf(db, id);
    return run(db, 'resize', id, v, mid => resize({id, expectedVersion: v, mutationId: mid, now: NOW, partySize: m}), {
      m,
    });
  };
  assert.equal((await to(4)).kind, 'applied');
  assert.equal((await to(3)).kind, 'applied');
  assert.equal((await to(4)).kind, 'applied');
  const tooMany = await to(5);
  assert.equal(tooMany.kind === 'rejected' && tooMany.reason, 'no_seats');
  // Free one seat (the other group shrinks to 5), then 4 → 5 fits.
  const other = db.get<{id: string; version: number}>(
    `SELECT id, version FROM bookings WHERE id <> ? AND session_id = 'ses-conf'`,
    id,
  )!;
  assert.equal(
    (
      await run(db, 'resize', other.id, other.version, mid =>
        resize({id: other.id, expectedVersion: other.version, mutationId: mid, now: NOW, partySize: 5}),
      )
    ).kind,
    'applied',
  );
  assert.equal((await to(5)).kind, 'applied');
  assert.equal(confirmedSeats(db, 'ses-conf'), 10);
});

test('cancellation needs no session checks and releases the seats exactly once', async () => {
  const db = freshDb();
  // A confirmed booking in a session that is now in the past, unconfigured and cancelled.
  const {input} = await reserve(db, 'ses-conf', 3);
  db.run(
    `UPDATE sessions SET starts_at = ?, venue_id = NULL, price_status = 'unset', state = 'cancelled' WHERE id = 'ses-conf'`,
    NOW - DAY,
  );
  const id = input.bookingId;
  const mutationId = randomUUID();
  const r = await act(
    db,
    {action: 'cancel', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId},
    mid => cancel({id, expectedVersion: 1, mutationId: mid, now: NOW}),
  );
  assert.equal(r.kind, 'applied');
  assert.equal(confirmedSeats(db, 'ses-conf'), 0);
  const again = await act(
    db,
    {action: 'cancel', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId},
    mid => cancel({id, expectedVersion: 1, mutationId: mid, now: NOW}),
  );
  assert.equal(again.kind === 'applied' && again.replayed, true);
  assert.equal(versionOf(db, id), 2);
});

test('check-in works only on the session’s Puerto Rico date', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2);
  const id = input.bookingId;
  const dayStart = SHOW - 19 * HOUR; // Oct 16, 00:00 in Puerto Rico
  const dayEnd = dayStart + DAY;
  const early = await run(db, 'check_in', id, 1, mid =>
    checkIn({
      id,
      expectedVersion: 1,
      mutationId: mid,
      now: NOW,
      undo: false,
      dayStart: dayStart - DAY,
      dayEnd: dayEnd - DAY,
    }),
  );
  assert.equal(early.kind === 'rejected' && early.reason, 'not_session_day');
  const onTheDay = await run(db, 'check_in', id, 1, mid =>
    checkIn({id, expectedVersion: 1, mutationId: mid, now: SHOW - HOUR, undo: false, dayStart, dayEnd}),
  );
  assert.equal(onTheDay.kind, 'applied');
  assert.ok(booking(db, id).checked_in_at);
  const after = await run(db, 'mark_outcome', id, 2, mid =>
    markOutcome({id, expectedVersion: 2, mutationId: mid, now: SHOW + HOUR, outcome: 'fulfilled'}),
  );
  assert.equal(after.kind, 'applied');
  assert.equal(booking(db, id).status, 'fulfilled');
});

test('a move to a session with different terms waits for acceptance; a failed move leaves the original', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-pre', 2); // pending payment at $25
  const id = input.bookingId;
  await pay(db, id, 'payment', 5000);
  // Confirm in place first (paid in full).
  const v1 = versionOf(db, id);
  assert.equal(
    (await run(db, 'confirm', id, v1, mid => confirm({id, expectedVersion: v1, mutationId: mid, now: NOW}))).kind,
    'applied',
  );
  assert.equal(confirmedSeats(db, 'ses-pre'), 2);

  // ses-pricier costs $30: different terms.
  const v2 = versionOf(db, id);
  const blocked = await run(
    db,
    'move',
    id,
    v2,
    mid => moveConfirmed({id, expectedVersion: v2, mutationId: mid, now: NOW, destination: 'ses-pricier'}),
    {d: 'ses-pricier'},
  );
  assert.equal(blocked.kind === 'rejected' && blocked.reason, 'terms_not_accepted');
  assert.equal(booking(db, id).session_id, 'ses-pre');
  assert.equal(confirmedSeats(db, 'ses-pre'), 2);

  await guestAccept(db, id, 'ses-pricier');
  const v3 = versionOf(db, id);
  const short = await run(
    db,
    'move',
    id,
    v3,
    mid => moveConfirmed({id, expectedVersion: v3, mutationId: mid, now: NOW, destination: 'ses-pricier'}),
    {d: 'ses-pricier', try: 2},
  );
  assert.equal(short.kind === 'rejected' && short.reason, 'payment_short'); // $60 due, $50 paid
  await pay(db, id, 'payment', 1000);
  const v4 = versionOf(db, id);
  const moved = await run(
    db,
    'move',
    id,
    v4,
    mid => moveConfirmed({id, expectedVersion: v4, mutationId: mid, now: NOW, destination: 'ses-pricier'}),
    {d: 'ses-pricier', try: 3},
  );
  assert.equal(moved.kind, 'applied');
  const after = booking(db, id);
  assert.equal(after.session_id, 'ses-pricier');
  assert.equal(after.unit_price_cents, 3000, 'relocked to the newly accepted terms');
  assert.equal(confirmedSeats(db, 'ses-pre'), 0);
  assert.equal(confirmedSeats(db, 'ses-pricier'), 2);
});

test('locked terms survive later edits to the session', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-pre', 2);
  db.run(`UPDATE sessions SET price_cents = 9900 WHERE id = 'ses-pre'`);
  const b = booking(db, input.bookingId);
  assert.equal(b.unit_price_cents, 2500);
  assert.equal(b.accepted_policy_version_id, 'pol-prepay');
  // Confirming now needs the guest to accept the new price.
  await pay(db, input.bookingId, 'payment', 19800);
  const r = await run(db, 'confirm', input.bookingId, b.version, mid =>
    confirm({id: input.bookingId, expectedVersion: b.version, mutationId: mid, now: NOW}),
  );
  assert.equal(r.kind === 'rejected' && r.reason, 'terms_not_accepted');
});

test('paid without seats: recording a payment after the seats run out makes an exception in the same transaction', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-pre', 4); // pending, $100 due
  await reserve(db, 'ses-conf', 1); // unrelated
  // Seats in ses-pre run out (staff log 10 confirmed seats by hand).
  db.run(`UPDATE sessions SET capacity = 3 WHERE id = 'ses-pre'`);
  const {result} = await pay(db, input.bookingId, 'payment', 10000);
  assert.equal(result.kind, 'applied');
  const b = booking(db, input.bookingId);
  assert.equal(b.status, 'exception');
  assert.equal(b.exception_reason, 'paid_without_seats');
  assert.equal(confirmedSeats(db, 'ses-pre'), 0, 'an exception holds no seats');
});

test('a confirm that fails on seats with money received becomes an exception; without money it stays', async () => {
  const db = freshDb();
  const paid = await reserve(db, 'ses-pre', 4);
  const unpaid = await reserve(db, 'ses-pre', 4);
  await pay(db, paid.input.bookingId, 'payment', 10000);
  db.run(`UPDATE sessions SET capacity = 3 WHERE id = 'ses-pre'`);
  for (const [b, expected] of [
    [paid.input.bookingId, 'exception'],
    [unpaid.input.bookingId, 'pending_payment'],
  ] as const) {
    const v = versionOf(db, b);
    const r = await run(db, 'confirm', b, v, mid => confirm({id: b, expectedVersion: v, mutationId: mid, now: NOW}));
    assert.equal(booking(db, b).status, expected);
    assert.equal(r.kind, expected === 'exception' ? 'applied' : 'rejected');
  }
});

test('exception resolution: same session and another session, counting zero existing seats', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-pre', 4);
  const id = input.bookingId;
  db.run(`UPDATE sessions SET capacity = 3 WHERE id = 'ses-pre'`);
  await pay(db, id, 'payment', 10000);
  assert.equal(booking(db, id).status, 'exception');

  const before = booking(db, id);
  // Failure 1: no seats in the same session.
  const noSeats = await run(db, 'resolve_same', id, before.version, mid =>
    resolveSame({id, expectedVersion: before.version, mutationId: mid, now: NOW}),
  );
  assert.equal(noSeats.kind === 'rejected' && noSeats.reason, 'no_seats');
  assert.deepEqual(booking(db, id), before, 'the exception stays exactly as it was');

  // Failure 2: another session with different terms, not yet accepted.
  const notAccepted = await run(
    db,
    'resolve_other',
    id,
    before.version,
    mid => resolveOther({id, expectedVersion: before.version, mutationId: mid, now: NOW, destination: 'ses-pricier'}),
    {d: 'ses-pricier'},
  );
  assert.equal(notAccepted.kind === 'rejected' && notAccepted.reason, 'terms_not_accepted');
  assert.deepEqual(booking(db, id), before);

  // Failure 3: accepted, but $120 due and $100 paid.
  await guestAccept(db, id, 'ses-pricier');
  const v = versionOf(db, id);
  const short = await run(
    db,
    'resolve_other',
    id,
    v,
    mid => resolveOther({id, expectedVersion: v, mutationId: mid, now: NOW, destination: 'ses-pricier'}),
    {d: 'ses-pricier', t: 2},
  );
  assert.equal(short.kind === 'rejected' && short.reason, 'payment_short');
  assert.equal(booking(db, id).status, 'exception');
  assert.equal(confirmedSeats(db, 'ses-pricier'), 0);
  const ledger = db.get<{state: string; reason: string}>(
    `SELECT state, reason FROM mutations WHERE action = 'resolve_other' ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  )!;
  assert.deepEqual({...ledger}, {state: 'rejected', reason: 'payment_short'});

  // Same session once the owner raises capacity: succeeds.
  db.run(`UPDATE sessions SET capacity = 10 WHERE id = 'ses-pre'`);
  const v2 = versionOf(db, id);
  const resolved = await run(db, 'resolve_same', id, v2, mid =>
    resolveSame({id, expectedVersion: v2, mutationId: mid, now: NOW}),
  );
  assert.equal(resolved.kind, 'applied');
  assert.equal(booking(db, id).status, 'confirmed');
  assert.equal(confirmedSeats(db, 'ses-pre'), 4);
});

test('money: refunds after cancellation, limits, references and reversals', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-pre', 2);
  const id = input.bookingId;
  const paid = await pay(db, id, 'payment', 5000, {ref: 'ATH-1'});
  assert.equal(paid.result.kind, 'applied');
  const v = versionOf(db, id);
  assert.equal(
    (await run(db, 'cancel', id, v, mid => cancel({id, expectedVersion: v, mutationId: mid, now: NOW}))).kind,
    'applied',
  );

  const refund = await pay(db, id, 'refund', 3000);
  assert.equal(refund.result.kind, 'applied');
  assert.equal(booking(db, id).status, 'cancelled', 'recording money does not change the status');

  const tooMuch = await pay(db, id, 'refund', 2001);
  assert.equal(tooMuch.result.kind === 'rejected' && tooMuch.result.reason, 'refund_exceeds_net');

  const dupe = await pay(db, id, 'payment', 100, {ref: 'ATH-1'});
  assert.equal(dupe.result.kind === 'rejected' && dupe.result.reason, 'duplicate_reference');

  // A reversing entry corrects a mistaken one.
  const mistake = await pay(db, id, 'payment', 700);
  const reversal = await pay(db, id, 'reversal', 700, {reverses: mistake.paymentId});
  assert.equal(reversal.result.kind, 'applied');
  const twice = await pay(db, id, 'reversal', 700, {reverses: mistake.paymentId});
  assert.equal(twice.result.kind === 'rejected' && twice.result.reason, 'reversal_invalid');
  const net = db.get<{n: number}>(
    `SELECT COALESCE(SUM(CASE kind WHEN 'payment' THEN amount_cents WHEN 'refund' THEN -amount_cents ELSE -amount_cents END), 0) AS n FROM payments WHERE booking_id = ?`,
    id,
  )!.n;
  assert.equal(net, 2000);
  assert.throws(() => db.run(`UPDATE payments SET amount_cents = 1`), /append-only/);
  assert.throws(() => db.run(`DELETE FROM payments`), /append-only/);
});

test('a guest withdraws a request without money, but not once a payment is recorded', async () => {
  const db = freshDb();
  const a = await reserve(db, 'ses-pre', 2);
  const b = await reserve(db, 'ses-pre', 2);
  await pay(db, b.input.bookingId, 'payment', 100);
  for (const [r, expected] of [
    [a, 'applied'],
    [b, 'rejected'],
  ] as const) {
    const id = r.input.bookingId;
    const v = versionOf(db, id);
    const out = await act(
      db,
      {action: 'withdraw', targetType: 'booking', targetId: id, actor: 'guest', expectedVersion: v},
      mid => withdraw({id, expectedVersion: v, mutationId: mid, now: NOW, tokenDigest: r.input.tokenDigest!}),
    );
    assert.equal(out.kind, expected);
  }
  assert.equal(booking(db, b.input.bookingId).status, 'pending_payment');
});

test('an unpublished, cancelled, archived or past session takes no new bookings or requests', async () => {
  const db = freshDb();
  session(db, 'ses-draft', {state: 'draft'});
  session(db, 'ses-cancelled', {state: 'cancelled'});
  session(db, 'ses-archived', {state: 'archived'});
  session(db, 'ses-cancelled-inq', {state: 'cancelled', mode: 'inquiry', venue: null, policy: null});
  for (const id of ['ses-draft', 'ses-cancelled', 'ses-archived', 'ses-past']) {
    const r = await reserve(db, id, 2);
    assert.equal(r.result.kind, 'rejected', id);
    if (id !== 'ses-past') assert.equal(r.result.kind === 'rejected' && r.result.reason, 'session_not_open', id);
  }
  const request = await inquire(db, 'ses-cancelled-inq', 2);
  assert.equal(request.result.kind === 'rejected' && request.result.reason, 'session_not_open');
  assert.equal(count(db, 'bookings'), 0);
});
