// Sessions, the catalog, settings, staff and the demo reset, on the real SQL.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act, count, DAY, freshDb, NOW, OWNER, reserve, SHOW} from './helpers.ts';
import {
  createSession,
  demoReset,
  savePolicyDraft,
  saveStaffMember,
  setPolicyState,
  setSessionState,
  updateSession,
  type PolicyFields,
  type SessionFields,
} from '../../worker/admin-rules.ts';
import {demoSeed, seedSqlFile} from '../../worker/seed.ts';
import {TestD1} from './d1.ts';

const fields = (over: Partial<SessionFields> = {}): SessionFields => ({
  experienceId: 'exp',
  venueId: 'venue',
  startsAt: SHOW + 30 * DAY,
  endsAt: SHOW + 30 * DAY + 3 * 60 * 60 * 1000,
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
  ...over,
});

const version = (db: TestD1, table: string, id: string) =>
  db.get<{version: number}>(`SELECT version FROM ${table} WHERE id = ?`, id)!.version;

test('a session is created as a draft and published only when its checks pass', async () => {
  const db = freshDb();
  const created = await act(
    db,
    {action: 'session_create', targetType: 'session', targetId: 'ses-new', payload: fields()},
    mid =>
      createSession({id: 'ses-new', fields: fields({venueId: 'venue-draft'}), actor: OWNER, mutationId: mid, now: NOW}),
  );
  assert.equal(created.kind, 'applied');
  const publish = (v: number) =>
    act(db, {action: 'session_publish', targetType: 'session', targetId: 'ses-new', expectedVersion: v}, mid =>
      setSessionState({
        id: 'ses-new',
        transition: 'publish',
        expectedVersion: v,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
    );
  const blocked = await publish(1);
  assert.equal(blocked.kind === 'rejected' && blocked.reason, 'venue_not_approved');

  const updated = await act(
    db,
    {action: 'session_update', targetType: 'session', targetId: 'ses-new', expectedVersion: 1, payload: fields()},
    mid =>
      updateSession({id: 'ses-new', fields: fields(), expectedVersion: 1, actor: OWNER, mutationId: mid, now: NOW}),
  );
  assert.equal(updated.kind, 'applied');
  assert.equal((await publish(2)).kind, 'applied');

  // An inquiry-mode session publishes without venue, price or policy.
  await act(db, {action: 'session_create', targetType: 'session', targetId: 'ses-inq2', payload: {}}, mid =>
    createSession({
      id: 'ses-inq2',
      fields: fields({
        bookingMode: 'inquiry',
        venueId: null,
        policyVersionId: null,
        priceStatus: 'unset',
        capacity: null,
        partyMin: null,
        partyMax: null,
      }),
      actor: OWNER,
      mutationId: mid,
      now: NOW,
    }),
  );
  const inq = await act(
    db,
    {action: 'session_publish', targetType: 'session', targetId: 'ses-inq2', expectedVersion: 1},
    mid =>
      setSessionState({
        id: 'ses-inq2',
        transition: 'publish',
        expectedVersion: 1,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(inq.kind, 'applied');
});

test('capacity can’t go below the confirmed seats', async () => {
  const db = freshDb();
  await reserve(db, 'ses-conf', 6);
  const v = version(db, 'sessions', 'ses-conf');
  const tooLow = await act(
    db,
    {action: 'session_update', targetType: 'session', targetId: 'ses-conf', expectedVersion: v, payload: {c: 5}},
    mid =>
      updateSession({
        id: 'ses-conf',
        fields: fields({startsAt: SHOW, endsAt: null, capacity: 5}),
        expectedVersion: v,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(tooLow.kind === 'rejected' && tooLow.reason, 'capacity_below_confirmed');
  const blocked = await act(
    db,
    {action: 'session_update', targetType: 'session', targetId: 'ses-conf', expectedVersion: v, payload: {c: 10, b: 5}},
    mid =>
      updateSession({
        id: 'ses-conf',
        fields: fields({startsAt: SHOW, endsAt: null, capacity: 10, blockedSeats: 5}),
        expectedVersion: v,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(blocked.kind === 'rejected' && blocked.reason, 'capacity_below_confirmed');
  const ok = await act(
    db,
    {action: 'session_update', targetType: 'session', targetId: 'ses-conf', expectedVersion: v, payload: {c: 6}},
    mid =>
      updateSession({
        id: 'ses-conf',
        fields: fields({startsAt: SHOW, endsAt: null, capacity: 6}),
        expectedVersion: v,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(ok.kind, 'applied');
});

test('a stale staff edit is refused with a version conflict', async () => {
  const db = freshDb();
  const first = await act(
    db,
    {action: 'session_update', targetType: 'session', targetId: 'ses-conf', expectedVersion: 1, payload: {a: 1}},
    mid =>
      updateSession({
        id: 'ses-conf',
        fields: fields({startsAt: SHOW, endsAt: null, capacity: 12}),
        expectedVersion: 1,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(first.kind, 'applied');
  const stale = await act(
    db,
    {action: 'session_update', targetType: 'session', targetId: 'ses-conf', expectedVersion: 1, payload: {a: 2}},
    mid =>
      updateSession({
        id: 'ses-conf',
        fields: fields({startsAt: SHOW, endsAt: null, capacity: 14}),
        expectedVersion: 1,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(stale.kind === 'rejected' && stale.reason, 'version_conflict');
  assert.equal(db.get<{capacity: number}>(`SELECT capacity FROM sessions WHERE id = 'ses-conf'`)!.capacity, 12);
});

test('overlapping published sessions at a venue that disallows overlap are refused', async () => {
  const db = freshDb();
  await act(db, {action: 'session_create', targetType: 'session', targetId: 'ses-clash', payload: {}}, mid =>
    createSession({
      id: 'ses-clash',
      fields: fields({startsAt: SHOW + 30 * 60 * 1000, endsAt: SHOW + 2 * 60 * 60 * 1000}),
      actor: OWNER,
      mutationId: mid,
      now: NOW,
    }),
  );
  db.run(`UPDATE sessions SET ends_at = ? WHERE id = 'ses-conf'`, SHOW + 3 * 60 * 60 * 1000);
  const r = await act(
    db,
    {action: 'session_publish', targetType: 'session', targetId: 'ses-clash', expectedVersion: 1},
    mid =>
      setSessionState({
        id: 'ses-clash',
        transition: 'publish',
        expectedVersion: 1,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(r.kind === 'rejected' && r.reason, 'overlaps_session');
});

const policyFields = (over: Partial<PolicyFields> = {}): PolicyFields => ({
  title: 'Nueva',
  textEs: 'Texto de prueba',
  textEn: null,
  sourceUrl: null,
  sourceNote: null,
  publicAnnouncement: false,
  appliesTo: null,
  effectiveFrom: null,
  effectiveUntil: null,
  fullPayment: null,
  refundFractionBp: null,
  cutoffRule: null,
  ...over,
});

test('a policy is approved only with every rule set, and then never changes', async () => {
  const db = freshDb();
  await act(db, {action: 'policy_save', targetType: 'policy', targetId: 'pol-new', payload: {}}, mid =>
    savePolicyDraft({
      id: 'pol-new',
      fields: policyFields(),
      expectedVersion: null,
      actor: OWNER,
      mutationId: mid,
      now: NOW,
    }),
  );
  const early = await act(
    db,
    {action: 'policy_approved', targetType: 'policy', targetId: 'pol-new', expectedVersion: 1},
    mid => setPolicyState({id: 'pol-new', to: 'approved', expectedVersion: 1, actor: OWNER, mutationId: mid, now: NOW}),
  );
  assert.equal(early.kind === 'rejected' && early.reason, 'policy_rules_missing');
  const complete = policyFields({
    appliesTo: 'booking_time',
    effectiveFrom: NOW,
    fullPayment: true,
    refundFractionBp: 6000,
    cutoffRule: '72 horas antes',
  });
  await act(
    db,
    {action: 'policy_save', targetType: 'policy', targetId: 'pol-new', expectedVersion: 1, payload: complete},
    mid =>
      savePolicyDraft({id: 'pol-new', fields: complete, expectedVersion: 1, actor: OWNER, mutationId: mid, now: NOW}),
  );
  const approved = await act(
    db,
    {action: 'policy_approved', targetType: 'policy', targetId: 'pol-new', expectedVersion: 2},
    mid => setPolicyState({id: 'pol-new', to: 'approved', expectedVersion: 2, actor: OWNER, mutationId: mid, now: NOW}),
  );
  assert.equal(approved.kind, 'applied');
  const edit = await act(
    db,
    {action: 'policy_save', targetType: 'policy', targetId: 'pol-new', expectedVersion: 3, payload: {x: 1}},
    mid =>
      savePolicyDraft({id: 'pol-new', fields: complete, expectedVersion: 3, actor: OWNER, mutationId: mid, now: NOW}),
  );
  assert.equal(edit.kind === 'rejected' && edit.reason, 'policy_not_draft');
  assert.throws(() => db.run(`UPDATE policy_versions SET text_es = 'otro' WHERE id = 'pol-new'`), /retired/);
});

test('the last active owner can’t be removed', async () => {
  const db = freshDb();
  const r = await act(
    db,
    {action: 'staff_save', targetType: 'staff', targetId: 'owner@example.com', payload: {}},
    mid =>
      saveStaffMember({
        email: 'owner@example.com',
        role: 'staff',
        active: true,
        actor: OWNER,
        mutationId: mid,
        now: NOW,
      }),
  );
  assert.equal(r.kind === 'rejected' && r.reason, 'last_owner');
});

test('the demo reset deletes and reseeds in one transaction, only in a demo or local database', async () => {
  const db = freshDb(); // local
  await reserve(db, 'ses-conf', 2);
  const r = await act(db, {action: 'demo_reset', targetType: 'database', targetId: 'demo'}, mid =>
    demoReset({seed: demoSeed(NOW), mutationId: mid, now: NOW, actor: OWNER}),
  );
  assert.equal(r.kind, 'applied');
  assert.equal(count(db, 'reset_lock'), 0);
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM sessions WHERE synthetic = 1`)!.n, count(db, 'sessions'));
  assert.ok(count(db, 'staff_members') >= 2, 'staff members stay');
  assert.equal(
    db.get<{n: number}>(`SELECT COUNT(*) AS n FROM bookings WHERE reference LIKE 'PAP-DEMO%'`)!.n,
    count(db, 'bookings'),
  );

  // A production database refuses the lock, so the whole batch fails and nothing changes.
  const prod = new TestD1().migrate();
  prod.run(`INSERT INTO deployment_meta (id, environment, created_at) VALUES (1, 'production', ?)`, NOW);
  prod.run(
    `INSERT INTO staff_members (email, role, created_at, updated_at) VALUES ('owner@example.com', 'owner', ?, ?)`,
    NOW,
    NOW,
  );
  const refused = await act(prod, {action: 'demo_reset', targetType: 'database', targetId: 'demo'}, mid =>
    demoReset({seed: demoSeed(NOW), mutationId: mid, now: NOW, actor: OWNER}),
  );
  assert.equal(refused.kind, 'error');
  assert.equal(count(prod, 'sessions'), 0);
  assert.equal(count(prod, 'mutations'), 0);
});

test('the demo seed loads as a SQL file and dates are upcoming', () => {
  const db = new TestD1().migrate();
  db.run(`INSERT INTO deployment_meta (id, environment, created_at) VALUES (1, 'demo', ?)`, NOW);
  db.sqlite.exec(seedSqlFile(demoSeed(NOW)));
  const future = db.get<{n: number}>(`SELECT COUNT(*) AS n FROM sessions WHERE starts_at > ?`, NOW)!.n;
  assert.ok(future >= 6);
  assert.equal(db.get<{n: number}>(`SELECT COUNT(*) AS n FROM sessions WHERE synthetic = 0`)!.n, 0);
  assert.ok(db.rows<{title_es: string}>(`SELECT title_es FROM experiences`).every(e => e.title_es.startsWith('DEMO')));
});
