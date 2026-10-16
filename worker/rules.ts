// The rules for every action, as SQL. Each action is a list of named checks; the write's
// WHERE is their AND, and a rejection reports the first check that fails, so the condition
// that blocks a write and the reason shown for it can never disagree. Every write also
// carries the mutation ledger's claim guard (worker/ledger.ts).
//
// Aliases: s = the booking's session (or the session being edited), d = a destination
// session, x = a session whose terms are proposed, b = the booking.
import {and, join, raw, sql, type Sql} from './sql.ts';
import type {ActionSpec} from './ledger.ts';
import type {BookingStatus} from '../shared/types.ts';

export interface Check {
  code: string;
  when: Sql;
}

// Each check is parenthesized, so a check with a top-level OR can never swallow the checks or
// the ledger guard that follow it.
export const allOf = (checks: Check[]) => and(checks.map(check => sql`(${check.when})`));

/** The first failing check's code. NULL counts as failing, as it does in a WHERE. */
export function firstFailure(checks: Check[], fallback = 'rejected'): Sql {
  if (!checks.length) return sql`${fallback}`;
  const whens = checks.map(check => sql`WHEN COALESCE(${check.when}, 0) = 0 THEN ${check.code}`);
  return sql`CASE ${join(whens, ' ')} ELSE ${fallback} END`;
}

type Num = number | Sql;
const A = raw;

// ---------------------------------------------------------------- session checks

export const open = (s = 's'): Check => ({code: 'session_not_open', when: A(`${s}.state = 'published'`)});

export const future = (now: number, s = 's'): Check => ({
  code: 'session_not_future',
  when: sql`(${A(s)}.starts_at IS NOT NULL AND ${A(s)}.starts_at > ${now})`,
});

export const futureOrTbd = (now: number, s = 's'): Check => ({
  code: 'session_not_future',
  when: sql`(${A(s)}.starts_at IS NULL OR ${A(s)}.starts_at > ${now})`,
});

/** Everything a session needs before anyone can be confirmed in it. */
export const confirmable = (now: number, s = 's'): Check[] => [
  {code: 'mode_not_confirmed', when: A(`${s}.booking_mode = 'confirmed'`)},
  {
    code: 'confirmations_off',
    when: A(`EXISTS (SELECT 1 FROM settings st WHERE st.key = 'confirmed_bookings_enabled' AND st.value = '1')`),
  },
  {
    code: 'contact_setting_missing',
    when: A(
      `EXISTS (SELECT 1 FROM settings st WHERE st.key = 'required_contact' AND st.value IN ('phone', 'email', 'either'))`,
    ),
  },
  {
    code: 'venue_not_approved',
    when: A(`EXISTS (SELECT 1 FROM venues v WHERE v.id = ${s}.venue_id AND v.approved = 1)`),
  },
  {
    code: 'capacity_missing',
    when: A(`(${s}.capacity IS NOT NULL AND ${s}.party_min IS NOT NULL AND ${s}.party_max IS NOT NULL)`),
  },
  {code: 'price_missing', when: A(`${s}.price_status IN ('approved', 'not_charged')`)},
  {code: 'policy_not_approved', when: policyApplies(now, s)},
];

/** The session's policy is approved, has every rule set, and is in force for this booking. */
function policyApplies(now: number, s: string): Sql {
  const at = sql`(CASE pv.applies_to WHEN 'booking_time' THEN ${now} ELSE ${A(s)}.starts_at END)`;
  return sql`EXISTS (SELECT 1 FROM policy_versions pv WHERE pv.id = ${A(s)}.policy_version_id
    AND pv.state = 'approved' AND pv.applies_to IS NOT NULL AND pv.full_payment IS NOT NULL
    AND ${at} >= COALESCE(pv.effective_from, 0)
    AND (pv.effective_until IS NULL OR ${at} < pv.effective_until))`;
}

export const limits = (n: Num, s = 's'): Check => ({
  code: 'party_size_limits',
  when: sql`((${A(s)}.party_min IS NULL OR ${n} >= ${A(s)}.party_min) AND (${A(s)}.party_max IS NULL OR ${n} <= ${A(s)}.party_max))`,
});

/** Seats held in a session: only confirmed bookings hold seats. */
export const confirmedSeats = (s = 's') =>
  A(
    `(SELECT COALESCE(SUM(seat.party_size), 0) FROM bookings seat WHERE seat.session_id = ${s}.id AND seat.status = 'confirmed')`,
  );

/** capacity − blocked − (confirmed seats − own) ≥ n. `own` is the booking's current seats, or 0. */
export const free = (n: Num, own: Num, s = 's'): Check => ({
  code: 'no_seats',
  when: sql`(${A(s)}.capacity IS NOT NULL AND ${A(s)}.capacity - ${A(s)}.blocked_seats - (${confirmedSeats(s)} - ${own}) >= ${n})`,
});

/** For inquiries: only checked when the session has a capacity. */
export const freeIfCapacity = (n: Num, s = 's'): Check => ({
  code: 'no_seats',
  when: sql`(${A(s)}.capacity IS NULL OR ${A(s)}.capacity - ${A(s)}.blocked_seats - ${confirmedSeats(s)} >= ${n})`,
});

/** The contact kind is the one the business asks for (any kind while unset, for inquiries). */
export const contactAllowed = (kind: string): Check => ({
  code: 'contact_kind_not_accepted',
  when: sql`(NOT EXISTS (SELECT 1 FROM settings st WHERE st.key = 'required_contact')
    OR EXISTS (SELECT 1 FROM settings st WHERE st.key = 'required_contact' AND st.value IN ('either', ${kind})))`,
});

// ---------------------------------------------------------------- terms and money

/** The booking's locked terms equal session `s`'s current terms. */
export const sameTerms = (b = 'b', s = 's') =>
  A(
    `(${b}.accepted_policy_version_id IS ${s}.policy_version_id AND ${b}.terms_price_status IS ${s}.price_status` +
      ` AND ${b}.unit_price_cents IS ${s}.price_cents AND ${b}.currency IS ${s}.currency)`,
  );

/** The booking's latest acceptance for session `s` matches `s`'s current terms. */
export const accepted = (b = 'b', s = 's'): Check => ({
  code: 'terms_not_accepted',
  when: A(`EXISTS (SELECT 1 FROM term_acceptances ta WHERE ta.rowid = (
      SELECT ta2.rowid FROM term_acceptances ta2 WHERE ta2.booking_id = ${b}.id AND ta2.session_id = ${s}.id
      ORDER BY ta2.accepted_at DESC, ta2.rowid DESC LIMIT 1)
    AND ta.policy_version_id IS ${s}.policy_version_id AND ta.price_status IS ${s}.price_status
    AND ta.unit_price_cents IS ${s}.price_cents AND ta.currency IS ${s}.currency)`),
});

/** Money received for a booking, net of refunds; a reversal undoes the entry it points to. */
export const net = (b = 'b') =>
  A(`(SELECT COALESCE(SUM(CASE pm.kind
      WHEN 'payment' THEN pm.amount_cents
      WHEN 'refund' THEN -pm.amount_cents
      ELSE (CASE (SELECT orig.kind FROM payments orig WHERE orig.id = pm.reverses_payment_id)
            WHEN 'payment' THEN -pm.amount_cents ELSE pm.amount_cents END) END), 0)
    FROM payments pm WHERE pm.booking_id = ${b}.id)`);

/** Under session `s`'s current terms: full payment covers price × n (always true without prepayment). */
export const paidUnder = (n: Num, b = 'b', s = 's'): Check => ({
  code: 'payment_short',
  when: sql`(EXISTS (SELECT 1 FROM policy_versions pp WHERE pp.id = ${A(s)}.policy_version_id AND pp.full_payment = 0)
    OR ${net(b)} >= COALESCE(${A(s)}.price_cents, 0) * ${n})`,
});

/** Under the booking's locked terms. */
export const paidLocked = (n: Num, b = 'b'): Check => ({
  code: 'payment_short',
  when: sql`(EXISTS (SELECT 1 FROM policy_versions pp WHERE pp.id = ${A(b)}.accepted_policy_version_id AND pp.full_payment = 0)
    OR ${net(b)} >= COALESCE(${A(b)}.unit_price_cents, 0) * ${n})`,
});

// ---------------------------------------------------------------- booking checks

export const version = (expected: number, alias = 'b'): Check => ({
  code: 'version_conflict',
  when: sql`${A(alias)}.version = ${expected}`,
});

export const ACTIVE: BookingStatus[] = ['inquiry', 'pending_payment', 'confirmed', 'exception'];

export const statusIn = (statuses: BookingStatus[], b = 'b'): Check => ({
  code: 'status_not_allowed',
  // Fixed literals from the BookingStatus union, never user input.
  when: A(`${b}.status IN (${statuses.map(status => `'${status}'`).join(', ')})`),
});

export const tokenMatches = (digest: string): Check => ({
  code: 'link_replaced',
  when: sql`b.token_digest = ${digest}`,
});

const destinationExists: Check = {code: 'destination_not_found', when: A('d.id IS NOT NULL')};
const notSameSession: Check = {code: 'same_session', when: A('d.id <> b.session_id')};

/** Terms at the destination: the same as the locked ones, or a new acceptance of them. */
const termsForDestination: Check = {
  code: 'terms_not_accepted',
  when: sql`(${sameTerms('b', 'd')} OR ${accepted('b', 'd').when})`,
};

// ---------------------------------------------------------------- specs

const bookingSnapshot = (id: string) =>
  sql`(SELECT json_object('id', id, 'reference', reference, 'status', status, 'sessionId', session_id,
    'partySize', party_size, 'version', version, 'checkedInAt', checked_in_at,
    'exceptionReason', exception_reason) FROM bookings WHERE id = ${id})`;

const bookingCarries = (id: string, mutationId: string) =>
  sql`EXISTS (SELECT 1 FROM bookings WHERE id = ${id} AND last_mutation_id = ${mutationId})`;

/** Locks the terms of session `alias` onto the booking. */
const lockTermsOf = (alias: string) =>
  A(
    `accepted_policy_version_id = ${alias}.policy_version_id, terms_price_status = ${alias}.price_status,` +
      ` unit_price_cents = ${alias}.price_cents, currency = ${alias}.currency`,
  );

const latestAcceptanceAt = (alias: string) =>
  A(
    `COALESCE((SELECT MAX(ta.accepted_at) FROM term_acceptances ta WHERE ta.booking_id = b.id AND ta.session_id = ${alias}.id), b.accepted_at)`,
  );

interface BookingUpdate {
  id: string;
  mutationId: string;
  now: number;
  set: Sql;
  checks: Check[];
  destination?: string;
  extra?: (guard: Sql) => Sql[];
}

/** An UPDATE of one booking, joined to its session (and a destination when moving). */
function bookingUpdate(p: BookingUpdate): ActionSpec {
  const from = p.destination ? sql`, sessions AS d` : raw('');
  const where = p.destination ? sql` AND d.id = ${p.destination}` : raw('');
  const leftJoin = p.destination ? sql` LEFT JOIN sessions AS d ON d.id = ${p.destination}` : raw('');
  return {
    snapshot: bookingSnapshot(p.id),
    writes: guard => [
      sql`UPDATE bookings AS b SET ${p.set}, version = b.version + 1, last_mutation_id = ${p.mutationId}, updated_at = ${p.now}
        FROM sessions AS s${from} WHERE s.id = b.session_id${where} AND b.id = ${p.id} AND ${allOf(p.checks)} AND ${guard}`,
      ...(p.extra?.(guard) ?? []),
    ],
    appliedWhen: bookingCarries(p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(p.checks)} FROM bookings AS b JOIN sessions AS s ON s.id = b.session_id${leftJoin}
      WHERE b.id = ${p.id}), 'not_found')`,
    outcome: bookingSnapshot(p.id),
  };
}

/**
 * Money received but no seats: in the same transaction, a booking that has a verified net
 * payment and doesn't fit becomes an exception. It holds no seats. Runs after the write it
 * follows, and only applies when that write didn't (the version is still the expected one,
 * or — when recording money — the payment row exists).
 */
function toExceptionWhenPaidWithoutSeats(p: {
  id: string;
  mutationId: string;
  now: number;
  statuses: BookingStatus[];
  extraCondition: Sql;
}) {
  return (guard: Sql) => [
    sql`UPDATE bookings AS b SET status = 'exception', exception_reason = 'paid_without_seats', prev_status = b.status,
        version = b.version + 1, last_mutation_id = ${p.mutationId}, updated_at = ${p.now}
      FROM sessions AS s WHERE s.id = b.session_id AND b.id = ${p.id} AND ${statusIn(p.statuses).when}
        AND (b.last_mutation_id IS NULL OR b.last_mutation_id <> ${p.mutationId})
        AND ${p.extraCondition} AND ${net('b')} > 0 AND COALESCE(${free(A('b.party_size'), 0, 's').when}, 0) = 0
        AND ${guard}`,
  ];
}

export interface CreateBookingInput {
  bookingId: string;
  reference: string;
  sessionId: string;
  partySize: number;
  leadName: string;
  contactKind: 'phone' | 'email';
  contactValue: string;
  note: string | null;
  source: 'web' | 'instagram_dm' | 'phone' | 'in_person' | 'other';
  tokenDigest: string | null;
  mutationId: string;
  now: number;
}

/** A request that holds no seats. Guests only on inquiry-mode sessions; staff on any open one. */
export function createInquiry(input: CreateBookingInput, byStaff: boolean): ActionSpec {
  const checks: Check[] = [
    open(),
    futureOrTbd(input.now),
    {code: 'mode_requires_terms', when: byStaff ? raw('1') : A(`s.booking_mode = 'inquiry'`)},
    limits(input.partySize),
    freeIfCapacity(input.partySize),
    contactAllowed(input.contactKind),
  ];
  return createBooking(input, checks, raw(`'inquiry'`), false);
}

export interface SeenTerms {
  policyVersionId: string;
  priceStatus: 'approved' | 'not_charged';
  unitPriceCents: number | null;
  currency: string | null;
}

/** A guest accepting a confirmable session's terms: confirmed, or pending payment if prepaid. */
export function createReservation(input: CreateBookingInput, seen: SeenTerms): ActionSpec {
  const checks: Check[] = [
    open(),
    future(input.now),
    ...confirmable(input.now),
    {
      code: 'terms_changed',
      when: sql`(s.policy_version_id IS ${seen.policyVersionId} AND s.price_status IS ${seen.priceStatus}
        AND s.price_cents IS ${seen.unitPriceCents} AND s.currency IS ${seen.currency})`,
    },
    limits(input.partySize),
    free(input.partySize, 0),
    contactAllowed(input.contactKind),
  ];
  const status = A(
    `(CASE (SELECT pv.full_payment FROM policy_versions pv WHERE pv.id = s.policy_version_id) WHEN 1 THEN 'pending_payment' ELSE 'confirmed' END)`,
  );
  return createBooking(input, checks, status, true);
}

function createBooking(input: CreateBookingInput, checks: Check[], status: Sql, withTerms: boolean): ActionSpec {
  const terms = withTerms
    ? A('s.policy_version_id, s.price_status, s.price_cents, s.currency')
    : A('NULL, NULL, NULL, NULL');
  return {
    snapshot: raw('NULL'),
    writes: guard => [
      sql`INSERT INTO bookings (id, reference, session_id, party_size, lead_name, contact_kind, contact_value, note, status,
          source, token_digest, accepted_policy_version_id, terms_price_status, unit_price_cents, currency, accepted_at,
          synthetic, version, last_mutation_id, created_at, updated_at)
        SELECT ${input.bookingId}, ${input.reference}, s.id, ${input.partySize}, ${input.leadName}, ${input.contactKind},
          ${input.contactValue}, ${input.note}, ${status}, ${input.source}, ${input.tokenDigest}, ${terms},
          ${withTerms ? input.now : null}, s.synthetic, 1, ${input.mutationId}, ${input.now}, ${input.now}
        FROM sessions AS s WHERE s.id = ${input.sessionId} AND ${allOf(checks)} AND ${guard}`,
      ...(withTerms
        ? [
            sql`INSERT INTO term_acceptances (id, booking_id, session_id, policy_version_id, price_status, unit_price_cents,
                currency, accepted_at, channel, mutation_id)
              SELECT ${input.bookingId + ':terms'}, b.id, b.session_id, b.accepted_policy_version_id, b.terms_price_status,
                b.unit_price_cents, b.currency, ${input.now}, 'guest_page', ${input.mutationId}
              FROM bookings AS b WHERE b.id = ${input.bookingId} AND b.last_mutation_id = ${input.mutationId} AND ${guard}`,
          ]
        : []),
    ],
    appliedWhen: bookingCarries(input.bookingId, input.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM sessions AS s WHERE s.id = ${input.sessionId}), 'session_not_found')`,
    outcome: bookingSnapshot(input.bookingId),
  };
}

interface BookingAction {
  id: string;
  expectedVersion: number;
  mutationId: string;
  now: number;
}

/** Staff confirm an inquiry or a pending payment under the session's current terms. */
export function confirm(p: BookingAction): ActionSpec {
  const n = A('b.party_size');
  return bookingUpdate({
    ...p,
    set: sql`status = 'confirmed', prev_status = b.status, exception_reason = NULL, ${lockTermsOf('s')},
      accepted_at = ${latestAcceptanceAt('s')}`,
    checks: [
      version(p.expectedVersion),
      statusIn(['inquiry', 'pending_payment']),
      open(),
      future(p.now),
      ...confirmable(p.now),
      limits(n),
      free(n, 0),
      accepted(),
      paidUnder(n),
    ],
    extra: toExceptionWhenPaidWithoutSeats({
      id: p.id,
      mutationId: p.mutationId,
      now: p.now,
      statuses: ['inquiry', 'pending_payment'],
      extraCondition: sql`b.version = ${p.expectedVersion}`,
    }),
  });
}

/** Resolve an exception in its own session. It holds no seats, so `free` counts zero own seats. */
export function resolveSame(p: BookingAction): ActionSpec {
  const n = A('b.party_size');
  return bookingUpdate({
    ...p,
    set: sql`status = 'confirmed', prev_status = b.status, exception_reason = NULL, ${lockTermsOf('s')},
      accepted_at = ${latestAcceptanceAt('s')}`,
    checks: [
      version(p.expectedVersion),
      statusIn(['exception']),
      open(),
      future(p.now),
      ...confirmable(p.now),
      limits(n),
      free(n, 0),
      accepted(),
      paidUnder(n),
    ],
  });
}

/** Resolve an exception by confirming it in another session D. */
export function resolveOther(p: BookingAction & {destination: string}): ActionSpec {
  const n = A('b.party_size');
  return bookingUpdate({
    ...p,
    set: sql`session_id = d.id, prev_session_id = b.session_id, status = 'confirmed', prev_status = b.status,
      exception_reason = NULL, ${lockTermsOf('d')},
      accepted_at = CASE WHEN ${sameTerms('b', 'd')} THEN b.accepted_at ELSE ${latestAcceptanceAt('d')} END`,
    checks: [
      version(p.expectedVersion),
      statusIn(['exception']),
      destinationExists,
      notSameSession,
      open('d'),
      future(p.now, 'd'),
      ...confirmable(p.now, 'd'),
      limits(n, 'd'),
      free(n, 0, 'd'),
      termsForDestination,
      paidUnder(n, 'b', 'd'),
    ],
  });
}

/** Resize a confirmed booking from n to m, leaving out its own seats before checking m. */
export function resize(p: BookingAction & {partySize: number}): ActionSpec {
  return bookingUpdate({
    ...p,
    set: sql`party_size = ${p.partySize}, prev_party_size = b.party_size`,
    checks: [
      version(p.expectedVersion),
      statusIn(['confirmed']),
      open(),
      future(p.now),
      limits(p.partySize),
      free(p.partySize, A('b.party_size')),
      paidLocked(p.partySize),
    ],
  });
}

/** Move a confirmed booking to session D: one UPDATE moves all its seats. */
export function moveConfirmed(p: BookingAction & {destination: string}): ActionSpec {
  const n = A('b.party_size');
  return bookingUpdate({
    ...p,
    set: sql`session_id = d.id, prev_session_id = b.session_id, ${lockTermsOf('d')},
      accepted_at = CASE WHEN ${sameTerms('b', 'd')} THEN b.accepted_at ELSE ${latestAcceptanceAt('d')} END`,
    checks: [
      version(p.expectedVersion),
      statusIn(['confirmed']),
      destinationExists,
      notSameSession,
      open('d'),
      future(p.now, 'd'),
      ...confirmable(p.now, 'd'),
      limits(n, 'd'),
      free(n, 0, 'd'),
      termsForDestination,
      paidUnder(n, 'b', 'd'),
    ],
  });
}

/** Move a request that holds no seats. A pending booking keeps (or relocks after acceptance) its terms. */
export function moveRequest(
  p: BookingAction & {destination: string; status: 'inquiry' | 'pending_payment'},
): ActionSpec {
  const n = A('b.party_size');
  const checks: Check[] =
    p.status === 'inquiry'
      ? [
          version(p.expectedVersion),
          statusIn(['inquiry']),
          destinationExists,
          notSameSession,
          open('d'),
          futureOrTbd(p.now, 'd'),
          limits(n, 'd'),
          freeIfCapacity(n, 'd'),
        ]
      : [
          version(p.expectedVersion),
          statusIn(['pending_payment']),
          destinationExists,
          notSameSession,
          open('d'),
          future(p.now, 'd'),
          ...confirmable(p.now, 'd'),
          limits(n, 'd'),
          free(n, 0, 'd'),
          termsForDestination,
        ];
  const relock =
    p.status === 'pending_payment'
      ? sql`, ${lockTermsOf('d')}, accepted_at = CASE WHEN ${sameTerms('b', 'd')} THEN b.accepted_at ELSE ${latestAcceptanceAt('d')} END`
      : raw('');
  return bookingUpdate({...p, set: sql`session_id = d.id, prev_session_id = b.session_id${relock}`, checks});
}

/** Staff edit a request that holds no seats. A new size re-runs the create rules for that size. */
export function editRequest(
  p: BookingAction & {
    status: 'inquiry' | 'pending_payment';
    partySize: number;
    sizeChanged: boolean;
    leadName: string;
    contactKind: 'phone' | 'email';
    contactValue: string;
    note: string | null;
  },
): ActionSpec {
  const sizeChecks: Check[] = !p.sizeChanged
    ? []
    : p.status === 'inquiry'
      ? [open(), futureOrTbd(p.now), limits(p.partySize), freeIfCapacity(p.partySize)]
      : [open(), future(p.now), ...confirmable(p.now), limits(p.partySize), free(p.partySize, 0)];
  return bookingUpdate({
    ...p,
    set: sql`party_size = ${p.partySize}, prev_party_size = b.party_size, lead_name = ${p.leadName},
      contact_kind = ${p.contactKind}, contact_value = ${p.contactValue}, note = ${p.note}`,
    checks: [version(p.expectedVersion), statusIn([p.status]), ...sizeChecks],
  });
}

/** Staff cancel any active booking. No session checks: a past or unconfigured session is fine. */
export function cancel(p: BookingAction): ActionSpec {
  return bookingUpdate({
    ...p,
    set: raw(`status = 'cancelled', prev_status = b.status`),
    checks: [version(p.expectedVersion), statusIn(ACTIVE)],
  });
}

/** A guest withdraws an inquiry, or a pending booking with no money recorded. */
export function withdraw(p: BookingAction & {tokenDigest: string}): ActionSpec {
  return bookingUpdate({
    ...p,
    set: raw(`status = 'cancelled', prev_status = b.status`),
    checks: [
      tokenMatches(p.tokenDigest),
      version(p.expectedVersion),
      statusIn(['inquiry', 'pending_payment']),
      {code: 'has_payment', when: sql`${net('b')} = 0`},
    ],
  });
}

/** Check-in (or undo) on the session's own Puerto Rico date. */
export function checkIn(p: BookingAction & {undo: boolean; dayStart: number; dayEnd: number}): ActionSpec {
  return bookingUpdate({
    ...p,
    set: p.undo ? raw('checked_in_at = NULL') : sql`checked_in_at = ${p.now}`,
    checks: [
      version(p.expectedVersion),
      statusIn(['confirmed']),
      {code: 'not_session_day', when: sql`(s.starts_at >= ${p.dayStart} AND s.starts_at < ${p.dayEnd})`},
      p.undo
        ? {code: 'not_checked_in', when: raw('b.checked_in_at IS NOT NULL')}
        : {code: 'already_checked_in', when: raw('b.checked_in_at IS NULL')},
    ],
  });
}

/** After the start: fulfilled or no-show. */
export function markOutcome(p: BookingAction & {outcome: 'fulfilled' | 'no_show'}): ActionSpec {
  return bookingUpdate({
    ...p,
    set: sql`status = ${p.outcome}, prev_status = b.status`,
    checks: [
      version(p.expectedVersion),
      statusIn(['confirmed']),
      {code: 'session_not_started', when: sql`(s.starts_at IS NOT NULL AND s.starts_at <= ${p.now})`},
    ],
  });
}

/** Staff issue a new management link. The old digest is replaced, so the old link stops working. */
export function reissueLink(p: BookingAction & {tokenDigest: string}): ActionSpec {
  return bookingUpdate({
    ...p,
    set: sql`token_digest = ${p.tokenDigest}`,
    checks: [version(p.expectedVersion)],
  });
}

export interface PaymentInput {
  paymentId: string;
  bookingId: string;
  kind: 'payment' | 'refund' | 'reversal';
  method: string;
  amountCents: number;
  currency: string;
  externalReference: string | null;
  reversesPaymentId: string | null;
  note: string | null;
  recordedBy: string;
  mutationId: string;
  now: number;
}

/**
 * Money recorded from outside the site, on a booking in any status (cancelled included).
 * Append-only. The status changes only in one case: a pending booking with money received
 * and no seats becomes an exception.
 */
export function recordPayment(p: PaymentInput): ActionSpec {
  const checks: Check[] = [
    {
      code: 'refund_exceeds_net',
      when:
        p.kind === 'refund'
          ? sql`${net('b')} >= ${p.amountCents}`
          : p.kind === 'reversal'
            ? sql`((SELECT o.kind FROM payments o WHERE o.id = ${p.reversesPaymentId}) <> 'payment' OR ${net('b')} >= ${p.amountCents})`
            : raw('1'),
    },
    {
      code: 'reversal_invalid',
      when:
        p.kind === 'reversal'
          ? sql`EXISTS (SELECT 1 FROM payments o WHERE o.id = ${p.reversesPaymentId} AND o.booking_id = b.id
              AND o.kind IN ('payment', 'refund') AND o.amount_cents = ${p.amountCents}
              AND NOT EXISTS (SELECT 1 FROM payments r WHERE r.reverses_payment_id = o.id))`
          : raw('1'),
    },
    {
      code: 'duplicate_reference',
      when: sql`(${p.externalReference} IS NULL OR NOT EXISTS (SELECT 1 FROM payments x
        WHERE x.method = ${p.method} AND x.external_reference = ${p.externalReference}))`,
    },
  ];
  const snapshot = sql`(SELECT json_object('id', b.id, 'reference', b.reference, 'status', b.status, 'version', b.version,
    'netCents', ${net('b')}) FROM bookings AS b WHERE b.id = ${p.bookingId})`;
  return {
    snapshot,
    writes: guard => [
      sql`INSERT INTO payments (id, booking_id, kind, method, amount_cents, currency, external_reference,
          reverses_payment_id, note, recorded_by, recorded_at, mutation_id)
        SELECT ${p.paymentId}, b.id, ${p.kind}, ${p.method}, ${p.amountCents}, ${p.currency}, ${p.externalReference},
          ${p.reversesPaymentId}, ${p.note}, ${p.recordedBy}, ${p.now}, ${p.mutationId}
        FROM bookings AS b WHERE b.id = ${p.bookingId} AND ${allOf(checks)} AND ${guard}`,
      ...toExceptionWhenPaidWithoutSeats({
        id: p.bookingId,
        mutationId: p.mutationId,
        now: p.now,
        statuses: ['pending_payment'],
        extraCondition: sql`EXISTS (SELECT 1 FROM payments WHERE mutation_id = ${p.mutationId})`,
      })(guard),
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM payments WHERE mutation_id = ${p.mutationId})`,
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM bookings AS b WHERE b.id = ${p.bookingId}), 'not_found')`,
    outcome: snapshot,
  };
}

/** Staff ask the guest to accept session X's current terms (to confirm, or to move there). */
export function proposeTerms(p: BookingAction & {proposalId: string; sessionId: string; actor: string}): ActionSpec {
  const checks: Check[] = [
    version(p.expectedVersion),
    statusIn(ACTIVE),
    {code: 'session_not_found', when: A('x.id IS NOT NULL')},
    open('x'),
    future(p.now, 'x'),
    ...confirmable(p.now, 'x'),
  ];
  const snapshot = sql`(SELECT json_object('proposalId', id, 'bookingId', booking_id, 'sessionId', session_id, 'status', status)
    FROM term_proposals WHERE mutation_id = ${p.mutationId})`;
  return {
    snapshot: bookingSnapshot(p.id),
    writes: guard => [
      sql`INSERT INTO term_proposals (id, booking_id, session_id, policy_version_id, price_status, unit_price_cents, currency,
          status, created_at, created_by, mutation_id)
        SELECT ${p.proposalId}, b.id, x.id, x.policy_version_id, x.price_status, x.price_cents, x.currency, 'open',
          ${p.now}, ${p.actor}, ${p.mutationId}
        FROM bookings AS b, sessions AS x WHERE b.id = ${p.id} AND x.id = ${p.sessionId} AND ${allOf(checks)} AND ${guard}`,
      sql`UPDATE term_proposals SET status = 'withdrawn', last_mutation_id = ${p.mutationId}
        WHERE booking_id = ${p.id} AND status = 'open' AND mutation_id <> ${p.mutationId}
          AND EXISTS (SELECT 1 FROM term_proposals WHERE mutation_id = ${p.mutationId}) AND ${guard}`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM term_proposals WHERE mutation_id = ${p.mutationId})`,
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM bookings AS b LEFT JOIN sessions AS x ON x.id = ${p.sessionId}
      WHERE b.id = ${p.id}), 'not_found')`,
    outcome: snapshot,
  };
}

/** The guest accepts an open proposal, on their page, while its terms are still current. */
export function acceptTerms(p: {
  bookingId: string;
  proposalId: string;
  tokenDigest: string;
  acceptanceId: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const checks: Check[] = [
    tokenMatches(p.tokenDigest),
    statusIn(ACTIVE),
    {code: 'proposal_not_open', when: A(`pr.status = 'open'`)},
    {
      code: 'terms_changed',
      when: A(
        `(pr.policy_version_id IS x.policy_version_id AND pr.price_status IS x.price_status` +
          ` AND pr.unit_price_cents IS x.price_cents AND pr.currency IS x.currency)`,
      ),
    },
  ];
  return {
    snapshot: bookingSnapshot(p.bookingId),
    writes: guard => [
      sql`INSERT INTO term_acceptances (id, booking_id, session_id, policy_version_id, price_status, unit_price_cents,
          currency, accepted_at, channel, mutation_id)
        SELECT ${p.acceptanceId}, b.id, pr.session_id, pr.policy_version_id, pr.price_status, pr.unit_price_cents,
          pr.currency, ${p.now}, 'guest_page', ${p.mutationId}
        FROM bookings AS b JOIN term_proposals AS pr ON pr.booking_id = b.id JOIN sessions AS x ON x.id = pr.session_id
        WHERE b.id = ${p.bookingId} AND pr.id = ${p.proposalId} AND ${allOf(checks)} AND ${guard}`,
      sql`UPDATE term_proposals SET status = 'accepted', last_mutation_id = ${p.mutationId}
        WHERE id = ${p.proposalId} AND status = 'open'
          AND EXISTS (SELECT 1 FROM term_acceptances WHERE mutation_id = ${p.mutationId}) AND ${guard}`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM term_acceptances WHERE mutation_id = ${p.mutationId})`,
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM bookings AS b
        LEFT JOIN term_proposals AS pr ON pr.id = ${p.proposalId} AND pr.booking_id = b.id
        LEFT JOIN sessions AS x ON x.id = pr.session_id
      WHERE b.id = ${p.bookingId}), 'not_found')`,
    outcome: bookingSnapshot(p.bookingId),
  };
}

/** A guest asks staff to cancel or change a booking. At most three open requests per booking. */
export function guestRequest(p: {
  bookingId: string;
  requestId: string;
  tokenDigest: string;
  kind: 'cancel' | 'change';
  details: string | null;
  mutationId: string;
  now: number;
}): ActionSpec {
  const checks: Check[] = [
    tokenMatches(p.tokenDigest),
    statusIn(ACTIVE),
    {
      code: 'too_many_requests',
      when: A(`(SELECT COUNT(*) FROM booking_requests rq WHERE rq.booking_id = b.id AND rq.status = 'open') < 3`),
    },
  ];
  return {
    snapshot: bookingSnapshot(p.bookingId),
    writes: guard => [
      sql`INSERT INTO booking_requests (id, booking_id, kind, details, status, created_at, mutation_id)
        SELECT ${p.requestId}, b.id, ${p.kind}, ${p.details}, 'open', ${p.now}, ${p.mutationId}
        FROM bookings AS b WHERE b.id = ${p.bookingId} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM booking_requests WHERE mutation_id = ${p.mutationId})`,
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM bookings AS b WHERE b.id = ${p.bookingId}), 'not_found')`,
    outcome: bookingSnapshot(p.bookingId),
  };
}

export function resolveRequest(p: {requestId: string; actor: string; mutationId: string; now: number}): ActionSpec {
  const snapshot = sql`(SELECT json_object('id', id, 'bookingId', booking_id, 'kind', kind, 'status', status)
    FROM booking_requests WHERE id = ${p.requestId})`;
  return {
    snapshot,
    writes: guard => [
      sql`UPDATE booking_requests SET status = 'resolved', resolved_at = ${p.now}, resolved_by = ${p.actor},
          last_mutation_id = ${p.mutationId}
        WHERE id = ${p.requestId} AND status = 'open' AND ${guard}`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM booking_requests WHERE id = ${p.requestId} AND last_mutation_id = ${p.mutationId})`,
    rejectReason: sql`COALESCE((SELECT CASE WHEN status <> 'open' THEN 'already_resolved' ELSE 'rejected' END
      FROM booking_requests WHERE id = ${p.requestId}), 'not_found')`,
    outcome: snapshot,
  };
}
