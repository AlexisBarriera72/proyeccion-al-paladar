// A migrated test database with a small, known catalog, and helpers that write through the
// real ledger and rules.
import {randomUUID} from 'node:crypto';
import {TestD1} from './d1.ts';
import {payloadHash, runMutation, type ActionSpec, type Binding, type MutationResult} from '../../worker/ledger.ts';
import {createInquiry, createReservation, type CreateBookingInput} from '../../worker/rules.ts';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
/** October 8, 2026, noon in Puerto Rico. */
export const NOW = Date.UTC(2026, 9, 8, 16, 0);
/** October 16, 2026, 7:00 PM in Puerto Rico. */
export const SHOW = Date.UTC(2026, 9, 16, 23, 0);

export const OWNER = 'staff:owner@example.com';
export const STAFF = 'staff:staff@example.com';

export function freshDb(): TestD1 {
  const db = new TestD1().migrate();
  db.run(`INSERT INTO deployment_meta (id, environment, created_at) VALUES (1, 'local', ?)`, NOW);
  for (const [key, value] of [
    ['confirmed_bookings_enabled', '1'],
    ['required_contact', 'either'],
  ]) {
    db.run(`INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, 'test')`, key, value, NOW);
  }
  db.run(
    `INSERT INTO staff_members (email, role, created_at, updated_at) VALUES ('owner@example.com', 'owner', ?, ?)`,
    NOW,
    NOW,
  );
  db.run(
    `INSERT INTO staff_members (email, role, created_at, updated_at) VALUES ('staff@example.com', 'staff', ?, ?)`,
    NOW,
    NOW,
  );
  db.run(
    `INSERT INTO experiences (id, title_es, status, created_at, updated_at, updated_by) VALUES ('exp', 'Experiencia de prueba', 'approved', ?, ?, 'test')`,
    NOW,
    NOW,
  );
  db.run(
    `INSERT INTO venues (id, name, approved, created_at, updated_at, updated_by) VALUES ('venue', 'Sala de prueba', 1, ?, ?, 'test')`,
    NOW,
    NOW,
  );
  db.run(
    `INSERT INTO venues (id, name, approved, created_at, updated_at, updated_by) VALUES ('venue-draft', 'Lugar sin aprobar', 0, ?, ?, 'test')`,
    NOW,
    NOW,
  );
  policy(db, 'pol-open', {fullPayment: 0});
  policy(db, 'pol-prepay', {fullPayment: 1, refundBp: 6000});
  db.run(
    `INSERT INTO policy_versions (id, title, text_es, state, public_announcement, created_at, updated_at, updated_by)
     VALUES ('pol-draft', 'Anunciada', 'A partir del 15 de noviembre…', 'draft', 1, ?, ?, 'test')`,
    NOW,
    NOW,
  );
  // An inquiry-only session: no venue, no price, no policy, no capacity.
  session(db, 'ses-inq', {
    mode: 'inquiry',
    venue: null,
    price: null,
    policy: null,
    capacity: null,
    min: null,
    max: null,
  });
  // Confirmable sessions.
  session(db, 'ses-conf', {});
  session(db, 'ses-conf2', {startsAt: SHOW + 7 * DAY});
  session(db, 'ses-pre', {price: 2500, policy: 'pol-prepay'});
  session(db, 'ses-pricier', {price: 3000, policy: 'pol-prepay', startsAt: SHOW + 14 * DAY});
  session(db, 'ses-past', {startsAt: NOW - DAY});
  return db;
}

export function policy(db: TestD1, id: string, p: {fullPayment: 0 | 1; refundBp?: number}) {
  db.run(
    `INSERT INTO policy_versions (id, title, text_es, state, applies_to, full_payment, refund_fraction_bp, cutoff_rule,
       approved_at, approved_by, created_at, updated_at, updated_by)
     VALUES (?, ?, 'Términos de prueba', 'approved', 'booking_time', ?, ?, 'none', ?, 'owner@example.com', ?, ?, 'test')`,
    id,
    id,
    p.fullPayment,
    p.refundBp ?? null,
    NOW,
    NOW,
    NOW,
  );
}

export function session(
  db: TestD1,
  id: string,
  o: {
    mode?: 'inquiry' | 'confirmed';
    venue?: string | null;
    price?: number | null; // null: not charged (confirmed mode) or unset (inquiry mode)
    policy?: string | null;
    capacity?: number | null;
    min?: number | null;
    max?: number | null;
    startsAt?: number | null;
    state?: string;
  },
) {
  const mode = o.mode ?? 'confirmed';
  const price = o.price === undefined ? null : o.price;
  const priceStatus = price != null ? 'approved' : mode === 'confirmed' ? 'not_charged' : 'unset';
  db.run(
    `INSERT INTO sessions (id, experience_id, venue_id, starts_at, capacity, party_min, party_max, booking_mode,
       price_status, price_cents, currency, policy_version_id, state, created_at, updated_at, updated_by)
     VALUES (?, 'exp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'test')`,
    id,
    o.venue === undefined ? 'venue' : o.venue,
    o.startsAt === undefined ? SHOW : o.startsAt,
    o.capacity === undefined ? 10 : o.capacity,
    o.min === undefined ? 1 : o.min,
    o.max === undefined ? 8 : o.max,
    mode,
    priceStatus,
    price,
    price != null ? 'USD' : null,
    o.policy === undefined ? 'pol-open' : o.policy,
    o.state ?? 'published',
    NOW,
    NOW,
  );
}

export interface ActOptions {
  action: string;
  targetType: Binding['targetType'];
  targetId: string;
  actor?: string;
  expectedVersion?: number | null;
  payload?: unknown;
  mutationId?: string;
  now?: number;
}

export async function act(
  db: TestD1,
  o: ActOptions,
  makeSpec: (mutationId: string) => ActionSpec,
): Promise<MutationResult & {mutationId: string}> {
  const mutationId = o.mutationId ?? randomUUID();
  const binding: Binding = {
    mutationId,
    action: o.action,
    targetType: o.targetType,
    targetId: o.targetId,
    actor: o.actor ?? OWNER,
    expectedVersion: o.expectedVersion ?? null,
    payloadHash: await payloadHash(o.payload ?? {}),
  };
  return {...(await runMutation(db, binding, makeSpec, o.now ?? NOW)), mutationId};
}

/** What the client sends: server-generated ids (booking, reference) are not part of the payload. */
export const clientPayload = (input: CreateBookingInput) => ({
  sessionId: input.sessionId,
  partySize: input.partySize,
  leadName: input.leadName,
  contactKind: input.contactKind,
  contactValue: input.contactValue,
  note: input.note,
  source: input.source,
  tokenDigest: input.tokenDigest,
});

export function bookingInput(
  sessionId: string,
  partySize: number,
  extra: Partial<CreateBookingInput> = {},
): CreateBookingInput {
  return {
    bookingId: randomUUID(),
    reference: 'PAP-' + randomUUID().slice(0, 6).toUpperCase(),
    sessionId,
    partySize,
    leadName: 'Cliente de prueba 01',
    contactKind: 'email',
    contactValue: 'cliente01@example.com',
    note: null,
    source: 'web',
    tokenDigest: randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
    mutationId: randomUUID(),
    now: NOW,
    ...extra,
  };
}

/** A guest reservation accepting the session's current terms. */
export async function reserve(
  db: TestD1,
  sessionId: string,
  partySize: number,
  extra: Partial<CreateBookingInput> = {},
) {
  const input = bookingInput(sessionId, partySize, extra);
  const s = db.get<{
    policy_version_id: string;
    price_status: 'approved' | 'not_charged';
    price_cents: number | null;
    currency: string | null;
  }>(`SELECT policy_version_id, price_status, price_cents, currency FROM sessions WHERE id = ?`, sessionId)!;
  const result = await act(
    db,
    {
      action: 'create_reservation',
      targetType: 'session',
      targetId: sessionId,
      actor: 'guest',
      payload: clientPayload(input),
      mutationId: input.mutationId,
      now: input.now,
    },
    mutationId =>
      createReservation(
        {...input, mutationId},
        {
          policyVersionId: s.policy_version_id,
          priceStatus: s.price_status,
          unitPriceCents: s.price_cents,
          currency: s.currency,
        },
      ),
  );
  return {result, input};
}

export async function inquire(
  db: TestD1,
  sessionId: string,
  partySize: number,
  byStaff = false,
  extra: Partial<CreateBookingInput> = {},
) {
  const input = bookingInput(sessionId, partySize, extra);
  const result = await act(
    db,
    {
      action: 'create_inquiry',
      targetType: 'session',
      targetId: sessionId,
      actor: byStaff ? OWNER : 'guest',
      payload: clientPayload(input),
      mutationId: input.mutationId,
      now: input.now,
    },
    mutationId => createInquiry({...input, mutationId}, byStaff),
  );
  return {result, input};
}

export const booking = (db: TestD1, id: string) =>
  db.get<{
    status: string;
    version: number;
    party_size: number;
    session_id: string;
    exception_reason: string | null;
    checked_in_at: number | null;
    token_digest: string | null;
    accepted_policy_version_id: string | null;
    unit_price_cents: number | null;
  }>(`SELECT * FROM bookings WHERE id = ?`, id)!;

export const confirmedSeats = (db: TestD1, sessionId: string) =>
  db.get<{n: number}>(
    `SELECT COALESCE(SUM(party_size), 0) AS n FROM bookings WHERE session_id = ? AND status = 'confirmed'`,
    sessionId,
  )!.n;

export const count = (db: TestD1, table: string) => db.get<{n: number}>(`SELECT COUNT(*) AS n FROM ${table}`)!.n;
