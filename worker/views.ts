// Read models: what guests see. Availability and the guest action are computed with the
// same named checks the writes use (worker/rules.ts), so the page never offers what the
// server would refuse.
import {raw, sql, type Sql} from './sql.ts';
import {all, first, type Db} from './db.ts';
import {allOf, confirmable, confirmedSeats, net} from './rules.ts';
import type {
  Availability,
  BookingStatus,
  GuestAction,
  ManageView,
  PublicPolicy,
  PublicSession,
  PublicTerms,
  SessionState,
} from '../shared/types.ts';

interface SessionRow {
  id: string;
  starts_at: number | null;
  ends_at: number | null;
  state: SessionState;
  capacity: number | null;
  blocked_seats: number;
  party_min: number | null;
  party_max: number | null;
  booking_mode: 'inquiry' | 'confirmed';
  price_status: 'unset' | 'approved' | 'not_charged';
  price_cents: number | null;
  currency: string | null;
  policy_version_id: string | null;
  low_seats_threshold: number | null;
  synthetic: number;
  title_es: string;
  title_en: string | null;
  description_es: string | null;
  description_en: string | null;
  inclusions_es: string | null;
  inclusions_en: string | null;
  photo_slot: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_instructions: string | null;
  venue_approved: number | null;
  seats_taken: number;
  confirmable_now: number;
  policy_full_payment: number | null;
}

export function sessionSelect(now: number): Sql {
  return sql`SELECT s.id, s.version, s.experience_id, s.venue_id, s.starts_at, s.ends_at, s.state, s.capacity,
      s.blocked_seats, s.party_min, s.party_max,
      s.booking_mode, s.price_status, s.price_cents, s.currency, s.policy_version_id, s.low_seats_threshold, s.synthetic,
      e.title_es, e.title_en, e.description_es, e.description_en, e.inclusions_es, e.inclusions_en, e.photo_slot,
      v.name AS venue_name, v.address AS venue_address, v.instructions AS venue_instructions, v.approved AS venue_approved,
      ${confirmedSeats('s')} AS seats_taken,
      CASE WHEN ${allOf(confirmable(now, 's'))} THEN 1 ELSE 0 END AS confirmable_now,
      (SELECT full_payment FROM policy_versions WHERE id = s.policy_version_id) AS policy_full_payment
    FROM sessions AS s JOIN experiences AS e ON e.id = s.experience_id
    LEFT JOIN venues AS v ON v.id = s.venue_id`;
}

interface PolicyRow {
  id: string;
  title: string;
  text_es: string;
  text_en: string | null;
  state: 'draft' | 'approved' | 'retired';
  public_announcement: number;
  effective_from: number | null;
  source_url: string | null;
  source_note: string | null;
}

/** Approved terms, or a draft the owners announced publicly; nothing else is shown to guests. */
export function toPublicPolicy(row: PolicyRow | null | undefined): PublicPolicy | null {
  if (!row) return null;
  const state =
    row.state === 'approved' ? 'approved' : row.state === 'draft' && row.public_announcement ? 'announced' : null;
  if (!state) return null;
  return {
    id: row.id,
    title: row.title,
    text: {es: row.text_es, en: row.text_en},
    state,
    effectiveFrom: row.effective_from,
    sourceUrl: row.source_url,
    sourceNote: row.source_note,
  };
}

async function policiesById(db: Db, ids: (string | null)[]): Promise<Map<string, PolicyRow>> {
  const unique = [...new Set(ids.filter((value): value is string => Boolean(value)))];
  if (!unique.length) return new Map();
  const list = unique.reduce<Sql>((acc, value, index) => (index ? sql`${acc}, ${value}` : sql`${value}`), raw(''));
  const rows = await all<PolicyRow>(db, sql`SELECT * FROM policy_versions WHERE id IN (${list})`);
  return new Map(rows.map(row => [row.id, row]));
}

const lines = (text: string | null) =>
  (text ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

export function toPublicSession(row: SessionRow, now: number, policy: PolicyRow | undefined): PublicSession {
  const remainingRaw = row.capacity === null ? null : row.capacity - row.blocked_seats - row.seats_taken;
  const realInventory = row.capacity !== null && row.booking_mode === 'confirmed';
  let availability: Availability;
  if (row.state === 'cancelled') availability = 'cancelled';
  else if (row.starts_at === null) availability = 'date_tbd';
  else if (row.starts_at <= now) availability = 'past';
  else if (remainingRaw !== null && remainingRaw <= 0) availability = 'sold_out';
  else if (realInventory && row.low_seats_threshold !== null && remainingRaw! <= row.low_seats_threshold) {
    availability = 'few_left';
  } else availability = 'available';

  const bookable = row.state === 'published' && availability !== 'past' && availability !== 'sold_out';
  let action: GuestAction = 'none';
  if (bookable && row.confirmable_now && availability !== 'date_tbd') action = 'reserve';
  else if (bookable && row.booking_mode === 'inquiry') action = 'request';

  const terms: PublicTerms | null =
    action === 'reserve' && row.policy_version_id && row.price_status !== 'unset'
      ? {
          policyVersionId: row.policy_version_id,
          priceStatus: row.price_status,
          unitPriceCents: row.price_cents,
          currency: row.currency,
          prepayment: row.policy_full_payment === 1,
        }
      : null;

  return {
    id: row.id,
    title: {es: row.title_es, en: row.title_en},
    description: row.description_es ? {es: row.description_es, en: row.description_en} : null,
    inclusions: {es: lines(row.inclusions_es), en: row.inclusions_en ? lines(row.inclusions_en) : null},
    photoSlot: row.photo_slot,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    state: row.state,
    availability,
    remaining: realInventory && remainingRaw !== null ? Math.max(remainingRaw, 0) : null,
    action,
    partyMin: row.party_min,
    partyMax: row.party_max,
    price: {status: row.price_status, cents: row.price_cents, currency: row.currency},
    venue: row.venue_approved
      ? {name: row.venue_name!, address: row.venue_address, instructions: row.venue_instructions}
      : null,
    policy: toPublicPolicy(policy),
    terms,
    synthetic: Boolean(row.synthetic),
  };
}

/** Published and cancelled sessions from `from` on, plus published ones without a date. */
export async function publicSessions(db: Db, now: number, from: number): Promise<PublicSession[]> {
  const rows = await all<SessionRow>(
    db,
    sql`${sessionSelect(now)} WHERE (s.state IN ('published', 'cancelled') AND s.starts_at >= ${from})
      OR (s.state = 'published' AND s.starts_at IS NULL)
      ORDER BY s.starts_at IS NULL, s.starts_at, s.id LIMIT 300`,
  );
  const policies = await policiesById(
    db,
    rows.map(row => row.policy_version_id),
  );
  return rows.map(row => toPublicSession(row, now, policies.get(row.policy_version_id ?? '')));
}

/** One session for guests: only published or cancelled ones. */
export async function publicSession(db: Db, now: number, id: string, anyState = false): Promise<PublicSession | null> {
  const row = await first<SessionRow>(
    db,
    anyState
      ? sql`${sessionSelect(now)} WHERE s.id = ${id}`
      : sql`${sessionSelect(now)} WHERE s.id = ${id} AND s.state IN ('published', 'cancelled')`,
  );
  if (!row) return null;
  const policies = await policiesById(db, [row.policy_version_id]);
  return toPublicSession(row, now, policies.get(row.policy_version_id ?? ''));
}

/** /politicas/: approved terms (newest first, then retired ones) and announced drafts. */
export async function publicPolicies(
  db: Db,
): Promise<{current: PublicPolicy[]; earlier: PublicPolicy[]; announced: PublicPolicy[]}> {
  const rows = await all<PolicyRow>(
    db,
    sql`SELECT * FROM policy_versions ORDER BY COALESCE(effective_from, created_at) DESC`,
  );
  const approved = rows.filter(row => row.state === 'approved').map(row => toPublicPolicy(row)!);
  const earlier = rows
    .filter(row => row.state === 'retired')
    .map(row => ({...toPublicPolicy({...row, state: 'approved'})!, state: 'approved' as const}));
  const announced = rows
    .filter(row => row.state === 'draft' && row.public_announcement)
    .map(row => toPublicPolicy(row)!);
  return {current: approved, earlier, announced};
}

interface BookingRow {
  id: string;
  reference: string;
  session_id: string;
  party_size: number;
  lead_name: string;
  status: BookingStatus;
  version: number;
  accepted_policy_version_id: string | null;
  accepted_at: number | null;
  terms_price_status: 'approved' | 'not_charged' | null;
  unit_price_cents: number | null;
  currency: string | null;
  net: number;
}

/** The guest's page, by the digest of their link's token. Null when the link isn't valid. */
export async function manageView(db: Db, now: number, tokenDigest: string): Promise<ManageView | null> {
  const booking = await first<BookingRow>(
    db,
    sql`SELECT b.*, ${net('b')} AS net FROM bookings AS b WHERE b.token_digest = ${tokenDigest}`,
  );
  if (!booking) return null;
  const session = await publicSession(db, now, booking.session_id, true);
  if (!session) return null;
  const locked = await first<PolicyRow>(
    db,
    sql`SELECT * FROM policy_versions WHERE id = ${booking.accepted_policy_version_id}`,
  );
  const proposals = await all<{
    id: string;
    session_id: string;
    policy_version_id: string;
    price_status: 'approved' | 'not_charged';
    unit_price_cents: number | null;
    currency: string | null;
    created_at: number;
  }>(
    db,
    sql`SELECT * FROM term_proposals WHERE booking_id = ${booking.id} AND status = 'open' ORDER BY created_at DESC`,
  );
  const proposalViews = [];
  for (const proposal of proposals) {
    const proposed = await publicSession(db, now, proposal.session_id, true);
    if (!proposed) continue;
    const policyRow = await first<{full_payment: number | null}>(
      db,
      sql`SELECT full_payment FROM policy_versions WHERE id = ${proposal.policy_version_id}`,
    );
    proposalViews.push({
      id: proposal.id,
      session: proposed,
      terms: {
        policyVersionId: proposal.policy_version_id,
        priceStatus: proposal.price_status,
        unitPriceCents: proposal.unit_price_cents,
        currency: proposal.currency,
        prepayment: policyRow?.full_payment === 1,
      },
      createdAt: proposal.created_at,
    });
  }
  const openRequests = await all<{id: string; kind: 'cancel' | 'change'; created_at: number}>(
    db,
    sql`SELECT id, kind, created_at FROM booking_requests WHERE booking_id = ${booking.id} AND status = 'open' ORDER BY created_at`,
  );
  return {
    bookingId: booking.id,
    reference: booking.reference,
    status: booking.status,
    version: booking.version,
    partySize: booking.party_size,
    leadName: booking.lead_name,
    session,
    locked: {
      policy: locked
        ? toPublicPolicy({...locked, state: locked.state === 'retired' ? 'approved' : locked.state})
        : null,
      priceStatus: booking.terms_price_status,
      unitPriceCents: booking.unit_price_cents,
      currency: booking.currency,
      acceptedAt: booking.accepted_at,
    },
    netPaidCents: booking.net,
    proposals: proposalViews,
    openRequests: openRequests.map(request => ({id: request.id, kind: request.kind, createdAt: request.created_at})),
    canWithdraw: ['inquiry', 'pending_payment'].includes(booking.status) && booking.net === 0,
  };
}
