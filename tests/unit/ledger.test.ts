// The mutation ledger: one outcome per mutation ID, decided inside the transaction, never
// overwritten. Runs the real SQL on SQLite.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {act, booking, count, freshDb, inquire, NOW, reserve, STAFF} from './helpers.ts';
import {cancel, confirm, resize} from '../../worker/rules.ts';
import {readLedger} from '../../worker/ledger.ts';
import {raw, sql} from '../../worker/sql.ts';

test('a replay with the same binding returns the stored outcome, with no second write or audit row', async () => {
  const db = freshDb();
  const {result, input} = await reserve(db, 'ses-conf', 2);
  assert.equal(result.kind, 'applied');
  const bookingsBefore = count(db, 'bookings');
  const auditBefore = count(db, 'audit_events');

  // Same mutation ID and the same payload: the server even tries a new booking id.
  const again = await reserve(db, 'ses-conf', 2, {...input, bookingId: randomUUID(), reference: 'PAP-OTHER1'});
  assert.equal(again.result.kind, 'applied');
  assert.equal(again.result.kind === 'applied' && again.result.replayed, true);
  assert.deepEqual(
    again.result.kind === 'applied' && again.result.outcome,
    result.kind === 'applied' && result.outcome,
  );
  assert.equal(count(db, 'bookings'), bookingsBefore);
  assert.equal(count(db, 'audit_events'), auditBefore);
});

test('reusing an ID with any different binding gets a conflict, with no write and no audit row', async () => {
  const db = freshDb();
  const {result, input} = await reserve(db, 'ses-conf', 2);
  assert.equal(result.kind, 'applied');
  const bookingId = input.bookingId;
  const before = {bookings: count(db, 'bookings'), audit: count(db, 'audit_events'), row: booking(db, bookingId)};

  const variants = [
    {action: 'cancel'}, // different action
    {targetType: 'session' as const}, // different target type
    {targetId: 'someone-else'}, // different target
    {actor: STAFF}, // different actor
    {expectedVersion: 2}, // different version
    {payload: {other: true}}, // different payload
  ];
  for (const variant of variants) {
    const r = await act(
      db,
      {
        action: 'resize',
        targetType: 'booking',
        targetId: bookingId,
        expectedVersion: 1,
        payload: {},
        ...variant,
        mutationId: input.mutationId,
      },
      mid => resize({id: bookingId, expectedVersion: 1, mutationId: mid, now: NOW, partySize: 3}),
    );
    assert.equal(r.kind, 'conflict', JSON.stringify(variant));
  }
  assert.equal(count(db, 'bookings'), before.bookings);
  assert.equal(count(db, 'audit_events'), before.audit);
  assert.deepEqual(booking(db, bookingId), before.row);
});

test('a retry after another edit returns the original outcome and changes nothing', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2);
  const id = input.bookingId;

  // M: resize to 4.
  const m = await act(
    db,
    {action: 'resize', targetType: 'booking', targetId: id, expectedVersion: 1, payload: {partySize: 4}},
    mid => resize({id, expectedVersion: 1, mutationId: mid, now: NOW, partySize: 4}),
  );
  assert.equal(m.kind, 'applied');
  const ledgerM = await readLedger(db, m.mutationId);

  // E: another edit moves the target on (resize to 5).
  const e = await act(
    db,
    {action: 'resize', targetType: 'booking', targetId: id, expectedVersion: 2, payload: {partySize: 5}},
    mid => resize({id, expectedVersion: 2, mutationId: mid, now: NOW, partySize: 5}),
  );
  assert.equal(e.kind, 'applied');
  const afterE = booking(db, id);
  const auditCount = count(db, 'audit_events');

  // Retry M with the same mutation ID.
  const retry = await act(
    db,
    {
      action: 'resize',
      targetType: 'booking',
      targetId: id,
      expectedVersion: 1,
      payload: {partySize: 4},
      mutationId: m.mutationId,
    },
    mid => resize({id, expectedVersion: 1, mutationId: mid, now: NOW + 1000, partySize: 4}),
  );
  assert.equal(retry.kind, 'applied');
  assert.deepEqual(retry.kind === 'applied' && retry.outcome, m.kind === 'applied' && m.outcome);
  assert.deepEqual(await readLedger(db, m.mutationId), ledgerM, 'M stays byte-for-byte the same');
  assert.deepEqual(booking(db, id), afterE, 'the booking keeps E');
  assert.equal(count(db, 'audit_events'), auditCount);
});

test('a rejected mutation stays rejected, even after its conditions would pass', async () => {
  const db = freshDb();
  const {input} = await inquire(db, 'ses-conf', 2, true); // staff entry: an inquiry without accepted terms
  const id = input.bookingId;
  const mutationId = randomUUID();
  const first = await act(
    db,
    {action: 'confirm', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId},
    mid => confirm({id, expectedVersion: 1, mutationId: mid, now: NOW}),
  );
  assert.equal(first.kind, 'rejected');
  assert.equal(first.kind === 'rejected' && first.reason, 'terms_not_accepted');

  // The guest accepts the terms (written directly here), so the same confirm would now pass.
  db.run(
    `INSERT INTO term_acceptances (id, booking_id, session_id, policy_version_id, price_status, unit_price_cents, currency, accepted_at, mutation_id)
     VALUES ('acc', ?, 'ses-conf', 'pol-open', 'not_charged', NULL, NULL, ?, 'acc-mutation')`,
    id,
    NOW,
  );
  const retry = await act(
    db,
    {action: 'confirm', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId},
    mid => confirm({id, expectedVersion: 1, mutationId: mid, now: NOW}),
  );
  assert.equal(retry.kind, 'rejected');
  assert.equal(retry.kind === 'rejected' && retry.replayed, true);
  assert.equal(booking(db, id).status, 'inquiry');

  // A new mutation ID is a new attempt.
  const fresh = randomUUID();
  const second = await act(
    db,
    {action: 'confirm', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId: fresh},
    mid => confirm({id, expectedVersion: 1, mutationId: mid, now: NOW}),
  );
  assert.equal(second.kind, 'applied');
  assert.equal(booking(db, id).status, 'confirmed');
});

test('parallel replays of one mutation apply exactly once', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2);
  const id = input.bookingId;
  const mutationId = randomUUID();
  const attempt = () =>
    act(db, {action: 'cancel', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId}, mid =>
      cancel({id, expectedVersion: 1, mutationId: mid, now: NOW}),
    );
  const results = await Promise.all([attempt(), attempt(), attempt()]);
  assert.ok(results.every(r => r.kind === 'applied'));
  assert.equal(results.filter(r => r.kind === 'applied' && !r.replayed).length, 1);
  assert.equal(booking(db, id).version, 2);
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM audit_events WHERE mutation_id = ?`, mutationId)!.n, 1);
});

test('backstop triggers: settled rows and binding columns cannot change, and nothing is deleted', async () => {
  const db = freshDb();
  const {result} = await reserve(db, 'ses-conf', 2);
  assert.equal(result.kind, 'applied');
  const mutationId = result.mutationId;
  assert.throws(() => db.run(`UPDATE mutations SET state = 'rejected' WHERE mutation_id = ?`, mutationId), /immutable/);
  assert.throws(
    () => db.run(`UPDATE mutations SET outcome_json = '{}' WHERE mutation_id = ?`, mutationId),
    /immutable/,
  );
  assert.throws(() => db.run(`UPDATE mutations SET payload_hash = 'x' WHERE mutation_id = ?`, mutationId), /immutable/);
  assert.throws(() => db.run(`DELETE FROM mutations WHERE mutation_id = ?`, mutationId), /append-only/);
  assert.throws(() => db.run(`UPDATE audit_events SET actor = 'x'`), /append-only/);
  assert.throws(() => db.run(`DELETE FROM audit_events`), /append-only/);
});

test('a failing statement rolls back the whole batch, the claim included', async () => {
  const db = freshDb();
  const {input} = await reserve(db, 'ses-conf', 2);
  const id = input.bookingId;
  const mutationId = randomUUID();
  // A spec whose write breaks a CHECK constraint (party_size >= 1).
  const r = await act(
    db,
    {action: 'resize', targetType: 'booking', targetId: id, expectedVersion: 1, mutationId},
    mid => resize({id, expectedVersion: 1, mutationId: mid, now: NOW, partySize: 0}),
  );
  // party_size 0 fails limits (min 1) before the CHECK, so it is a clean rejection...
  assert.equal(r.kind, 'rejected');
  // ...and a statement that throws keeps nothing at all.
  const failing = {
    snapshot: raw('NULL'),
    writes: () => [sql`UPDATE bookings SET party_size = 0 WHERE id = ${id}`],
    appliedWhen: raw('1'),
    rejectReason: raw(`'x'`),
    outcome: raw('NULL'),
  };
  const thrown = await act(
    db,
    {action: 'broken', targetType: 'booking', targetId: id, mutationId: 'throws'},
    () => failing,
  );
  assert.equal(thrown.kind, 'error');
  assert.equal(await readLedger(db, 'throws'), null);
  assert.equal(booking(db, id).party_size, 2);
});
