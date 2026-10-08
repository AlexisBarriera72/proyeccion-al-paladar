// Rules for sessions, the catalog (experiences, venues, policies), settings, staff and the
// demo reset. Same shape as worker/rules.ts: named checks, one guarded write, the first
// failing check as the reason.
import {raw, sql, type Sql, type SqlValue} from './sql.ts';
import type {ActionSpec} from './ledger.ts';
import {allOf, confirmable, confirmedSeats, firstFailure, futureOrTbd, version, type Check} from './rules.ts';
import {seedInsert, type SeedRow} from './seed.ts';

export interface SessionFields {
  experienceId: string;
  venueId: string | null;
  startsAt: number | null;
  endsAt: number | null;
  capacity: number | null;
  blockedSeats: number;
  partyMin: number | null;
  partyMax: number | null;
  bookingMode: 'inquiry' | 'confirmed';
  priceStatus: 'unset' | 'approved' | 'not_charged';
  priceCents: number | null;
  currency: string | null;
  policyVersionId: string | null;
  lowSeatsThreshold: number | null;
}

const sessionSnapshot = (id: string) =>
  sql`(SELECT json_object('id', id, 'state', state, 'startsAt', starts_at, 'capacity', capacity, 'bookingMode', booking_mode,
    'priceStatus', price_status, 'priceCents', price_cents, 'policyVersionId', policy_version_id, 'venueId', venue_id,
    'version', version) FROM sessions WHERE id = ${id})`;

const sessionCarries = (id: string, mutationId: string) =>
  sql`EXISTS (SELECT 1 FROM sessions WHERE id = ${id} AND last_mutation_id = ${mutationId})`;

const referencesExist = (f: SessionFields): Check[] => [
  {code: 'experience_not_found', when: sql`EXISTS (SELECT 1 FROM experiences WHERE id = ${f.experienceId})`},
  {code: 'venue_not_found', when: sql`(${f.venueId} IS NULL OR EXISTS (SELECT 1 FROM venues WHERE id = ${f.venueId}))`},
  {
    code: 'policy_not_found',
    when: sql`(${f.policyVersionId} IS NULL OR EXISTS (SELECT 1 FROM policy_versions WHERE id = ${f.policyVersionId}))`,
  },
];

/** No other published session at the same venue overlaps, when the venue disallows overlap. */
function noOverlap(venue: Sql, start: Sql, end: Sql, self: Sql): Check {
  return {
    code: 'overlaps_session',
    when: sql`NOT EXISTS (SELECT 1 FROM sessions o JOIN venues ov ON ov.id = o.venue_id
      WHERE o.venue_id = ${venue} AND ov.allow_overlap = 0 AND o.id <> ${self} AND o.state = 'published'
        AND o.starts_at IS NOT NULL AND ${start} IS NOT NULL
        AND o.starts_at < COALESCE(${end}, ${start} + 1) AND ${start} < COALESCE(o.ends_at, o.starts_at + 1))`,
  };
}

const lit = (value: SqlValue) => sql`${value}`;

export function createSession(p: {
  id: string;
  fields: SessionFields;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const f = p.fields;
  const checks = referencesExist(f);
  return {
    snapshot: raw('NULL'),
    writes: guard => [
      sql`INSERT INTO sessions (id, experience_id, venue_id, starts_at, ends_at, capacity, blocked_seats, party_min, party_max,
          booking_mode, price_status, price_cents, currency, policy_version_id, low_seats_threshold, state, synthetic,
          version, created_at, updated_at, updated_by, last_mutation_id)
        SELECT ${p.id}, ${f.experienceId}, ${f.venueId}, ${f.startsAt}, ${f.endsAt}, ${f.capacity}, ${f.blockedSeats},
          ${f.partyMin}, ${f.partyMax}, ${f.bookingMode}, ${f.priceStatus}, ${f.priceCents}, ${f.currency},
          ${f.policyVersionId}, ${f.lowSeatsThreshold}, 'draft',
          COALESCE((SELECT synthetic FROM experiences WHERE id = ${f.experienceId}), 0),
          1, ${p.now}, ${p.now}, ${p.actor}, ${p.mutationId}
        WHERE ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: sessionCarries(p.id, p.mutationId),
    rejectReason: sql`(SELECT ${firstFailure(checks)})`,
    outcome: sessionSnapshot(p.id),
  };
}

export function updateSession(p: {
  id: string;
  fields: SessionFields;
  expectedVersion: number;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const f = p.fields;
  const checks: Check[] = [
    version(p.expectedVersion, 's'),
    {code: 'session_closed', when: raw(`s.state IN ('draft', 'published')`)},
    ...referencesExist(f),
    {
      code: 'capacity_below_confirmed',
      when: sql`(${confirmedSeats('s')} = 0 OR (${f.capacity} IS NOT NULL AND ${f.capacity} - ${f.blockedSeats} >= ${confirmedSeats('s')}))`,
    },
    {
      ...noOverlap(lit(f.venueId), lit(f.startsAt), lit(f.endsAt), raw('s.id')),
      when: sql`(s.state <> 'published' OR ${noOverlap(lit(f.venueId), lit(f.startsAt), lit(f.endsAt), raw('s.id')).when})`,
    },
  ];
  return {
    snapshot: sessionSnapshot(p.id),
    writes: guard => [
      sql`UPDATE sessions AS s SET experience_id = ${f.experienceId}, venue_id = ${f.venueId}, starts_at = ${f.startsAt},
          ends_at = ${f.endsAt}, capacity = ${f.capacity}, blocked_seats = ${f.blockedSeats}, party_min = ${f.partyMin},
          party_max = ${f.partyMax}, booking_mode = ${f.bookingMode}, price_status = ${f.priceStatus},
          price_cents = ${f.priceCents}, currency = ${f.currency}, policy_version_id = ${f.policyVersionId},
          low_seats_threshold = ${f.lowSeatsThreshold}, version = s.version + 1, updated_at = ${p.now},
          updated_by = ${p.actor}, last_mutation_id = ${p.mutationId}
        WHERE s.id = ${p.id} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: sessionCarries(p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM sessions AS s WHERE s.id = ${p.id}), 'not_found')`,
    outcome: sessionSnapshot(p.id),
  };
}

/** What publishing needs, as named checks over `s` (also shown as the staff checklist). */
export function publishChecks(now: number): Check[] {
  return [
    {
      code: 'experience_not_approved',
      when: raw(`EXISTS (SELECT 1 FROM experiences e WHERE e.id = s.experience_id AND e.status = 'approved')`),
    },
    futureOrTbd(now),
    // A session that confirms bookings needs every confirmable part; one that takes requests doesn't.
    ...confirmable(now).map(check => ({...check, when: sql`(s.booking_mode = 'inquiry' OR ${check.when})`})),
    noOverlap(raw('s.venue_id'), raw('s.starts_at'), raw('s.ends_at'), raw('s.id')),
  ];
}

const ACTIVE_BOOKINGS = `EXISTS (SELECT 1 FROM bookings ab WHERE ab.session_id = s.id
  AND ab.status IN ('inquiry', 'pending_payment', 'confirmed', 'exception'))`;

export type SessionTransition = 'publish' | 'unpublish' | 'cancel' | 'archive';

export function setSessionState(p: {
  id: string;
  transition: SessionTransition;
  expectedVersion: number;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const byTransition: Record<SessionTransition, {to: string; checks: Check[]}> = {
    publish: {
      to: 'published',
      checks: [{code: 'state_not_allowed', when: raw(`s.state = 'draft'`)}, ...publishChecks(p.now)],
    },
    unpublish: {
      to: 'draft',
      checks: [
        {code: 'state_not_allowed', when: raw(`s.state = 'published'`)},
        {code: 'has_active_bookings', when: raw(`NOT ${ACTIVE_BOOKINGS}`)},
      ],
    },
    cancel: {to: 'cancelled', checks: [{code: 'state_not_allowed', when: raw(`s.state IN ('draft', 'published')`)}]},
    archive: {
      to: 'archived',
      checks: [
        {
          code: 'state_not_allowed',
          when: sql`(s.state = 'cancelled' OR (s.state = 'published' AND s.starts_at IS NOT NULL AND s.starts_at < ${p.now}))`,
        },
        {code: 'has_active_bookings', when: raw(`NOT ${ACTIVE_BOOKINGS}`)},
      ],
    },
  };
  const {to, checks: transitionChecks} = byTransition[p.transition];
  const checks = [version(p.expectedVersion, 's'), ...transitionChecks];
  return {
    snapshot: sessionSnapshot(p.id),
    writes: guard => [
      sql`UPDATE sessions AS s SET state = ${to}, version = s.version + 1, updated_at = ${p.now}, updated_by = ${p.actor},
          last_mutation_id = ${p.mutationId}
        WHERE s.id = ${p.id} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: sessionCarries(p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM sessions AS s WHERE s.id = ${p.id}), 'not_found')`,
    outcome: sessionSnapshot(p.id),
  };
}

// ---------------------------------------------------------------- catalog

export interface ExperienceFields {
  titleEs: string;
  titleEn: string | null;
  descriptionEs: string | null;
  descriptionEn: string | null;
  inclusionsEs: string | null;
  inclusionsEn: string | null;
  photoSlot: string | null;
  status: 'draft' | 'approved' | 'archived';
}

const rowSnapshot = (table: string, id: string) =>
  sql`(SELECT json_object('id', id, 'version', version) FROM ${raw(table)} WHERE id = ${id})`;
const rowCarries = (table: string, id: string, mutationId: string) =>
  sql`EXISTS (SELECT 1 FROM ${raw(table)} WHERE id = ${id} AND last_mutation_id = ${mutationId})`;

export function saveExperience(p: {
  id: string;
  fields: ExperienceFields;
  expectedVersion: number | null; // null: create
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const f = p.fields;
  if (p.expectedVersion === null) {
    return {
      snapshot: raw('NULL'),
      writes: guard => [
        sql`INSERT INTO experiences (id, title_es, title_en, description_es, description_en, inclusions_es, inclusions_en,
            photo_slot, status, version, created_at, updated_at, updated_by, last_mutation_id)
          SELECT ${p.id}, ${f.titleEs}, ${f.titleEn}, ${f.descriptionEs}, ${f.descriptionEn}, ${f.inclusionsEs},
            ${f.inclusionsEn}, ${f.photoSlot}, ${f.status}, 1, ${p.now}, ${p.now}, ${p.actor}, ${p.mutationId}
          WHERE NOT EXISTS (SELECT 1 FROM experiences WHERE id = ${p.id}) AND ${guard}`,
      ],
      appliedWhen: rowCarries('experiences', p.id, p.mutationId),
      rejectReason: sql`'already_exists'`,
      outcome: rowSnapshot('experiences', p.id),
    };
  }
  const checks = [version(p.expectedVersion, 'e')];
  return {
    snapshot: rowSnapshot('experiences', p.id),
    writes: guard => [
      sql`UPDATE experiences AS e SET title_es = ${f.titleEs}, title_en = ${f.titleEn}, description_es = ${f.descriptionEs},
          description_en = ${f.descriptionEn}, inclusions_es = ${f.inclusionsEs}, inclusions_en = ${f.inclusionsEn},
          photo_slot = ${f.photoSlot}, status = ${f.status}, version = e.version + 1, updated_at = ${p.now},
          updated_by = ${p.actor}, last_mutation_id = ${p.mutationId}
        WHERE e.id = ${p.id} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: rowCarries('experiences', p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM experiences AS e WHERE e.id = ${p.id}), 'not_found')`,
    outcome: rowSnapshot('experiences', p.id),
  };
}

export interface VenueFields {
  name: string;
  address: string | null;
  instructions: string | null;
  approved: boolean;
  allowOverlap: boolean;
}

export function saveVenue(p: {
  id: string;
  fields: VenueFields;
  expectedVersion: number | null;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const f = p.fields;
  if (p.expectedVersion === null) {
    return {
      snapshot: raw('NULL'),
      writes: guard => [
        sql`INSERT INTO venues (id, name, address, instructions, approved, allow_overlap, version, created_at, updated_at,
            updated_by, last_mutation_id)
          SELECT ${p.id}, ${f.name}, ${f.address}, ${f.instructions}, ${f.approved}, ${f.allowOverlap}, 1, ${p.now},
            ${p.now}, ${p.actor}, ${p.mutationId}
          WHERE NOT EXISTS (SELECT 1 FROM venues WHERE id = ${p.id}) AND ${guard}`,
      ],
      appliedWhen: rowCarries('venues', p.id, p.mutationId),
      rejectReason: sql`'already_exists'`,
      outcome: rowSnapshot('venues', p.id),
    };
  }
  const checks = [version(p.expectedVersion, 'v')];
  return {
    snapshot: rowSnapshot('venues', p.id),
    writes: guard => [
      sql`UPDATE venues AS v SET name = ${f.name}, address = ${f.address}, instructions = ${f.instructions},
          approved = ${f.approved}, allow_overlap = ${f.allowOverlap}, version = v.version + 1, updated_at = ${p.now},
          updated_by = ${p.actor}, last_mutation_id = ${p.mutationId}
        WHERE v.id = ${p.id} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: rowCarries('venues', p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM venues AS v WHERE v.id = ${p.id}), 'not_found')`,
    outcome: rowSnapshot('venues', p.id),
  };
}

export interface PolicyFields {
  title: string;
  textEs: string;
  textEn: string | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  publicAnnouncement: boolean;
  appliesTo: 'booking_time' | 'session_time' | null;
  effectiveFrom: number | null;
  effectiveUntil: number | null;
  fullPayment: boolean | null;
  refundFractionBp: number | null;
  cutoffRule: string | null;
}

/** Create or edit a draft. Approved and retired policies never change (triggers enforce it too). */
export function savePolicyDraft(p: {
  id: string;
  fields: PolicyFields;
  expectedVersion: number | null;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const f = p.fields;
  const fullPayment = f.fullPayment === null ? null : f.fullPayment ? 1 : 0;
  if (p.expectedVersion === null) {
    return {
      snapshot: raw('NULL'),
      writes: guard => [
        sql`INSERT INTO policy_versions (id, title, text_es, text_en, source_url, source_note, state, public_announcement,
            applies_to, effective_from, effective_until, full_payment, refund_fraction_bp, cutoff_rule, version,
            created_at, updated_at, updated_by, last_mutation_id)
          SELECT ${p.id}, ${f.title}, ${f.textEs}, ${f.textEn}, ${f.sourceUrl}, ${f.sourceNote}, 'draft',
            ${f.publicAnnouncement}, ${f.appliesTo}, ${f.effectiveFrom}, ${f.effectiveUntil}, ${fullPayment},
            ${f.refundFractionBp}, ${f.cutoffRule}, 1, ${p.now}, ${p.now}, ${p.actor}, ${p.mutationId}
          WHERE NOT EXISTS (SELECT 1 FROM policy_versions WHERE id = ${p.id}) AND ${guard}`,
      ],
      appliedWhen: rowCarries('policy_versions', p.id, p.mutationId),
      rejectReason: sql`'already_exists'`,
      outcome: rowSnapshot('policy_versions', p.id),
    };
  }
  const checks: Check[] = [
    version(p.expectedVersion, 'pv'),
    {code: 'policy_not_draft', when: raw(`pv.state = 'draft'`)},
  ];
  return {
    snapshot: rowSnapshot('policy_versions', p.id),
    writes: guard => [
      sql`UPDATE policy_versions AS pv SET title = ${f.title}, text_es = ${f.textEs}, text_en = ${f.textEn},
          source_url = ${f.sourceUrl}, source_note = ${f.sourceNote}, public_announcement = ${f.publicAnnouncement},
          applies_to = ${f.appliesTo}, effective_from = ${f.effectiveFrom}, effective_until = ${f.effectiveUntil},
          full_payment = ${fullPayment}, refund_fraction_bp = ${f.refundFractionBp}, cutoff_rule = ${f.cutoffRule},
          version = pv.version + 1, updated_at = ${p.now}, updated_by = ${p.actor}, last_mutation_id = ${p.mutationId}
        WHERE pv.id = ${p.id} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: rowCarries('policy_versions', p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM policy_versions AS pv WHERE pv.id = ${p.id}), 'not_found')`,
    outcome: rowSnapshot('policy_versions', p.id),
  };
}

/** The owner approves a draft whose every rule is set; or retires an approved policy. */
export function setPolicyState(p: {
  id: string;
  to: 'approved' | 'retired';
  expectedVersion: number;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const checks: Check[] =
    p.to === 'approved'
      ? [
          version(p.expectedVersion, 'pv'),
          {code: 'policy_not_draft', when: raw(`pv.state = 'draft'`)},
          {
            code: 'policy_rules_missing',
            when: raw(`(pv.applies_to IS NOT NULL AND pv.full_payment IS NOT NULL AND pv.refund_fraction_bp IS NOT NULL
              AND pv.cutoff_rule IS NOT NULL AND pv.cutoff_rule <> '' AND pv.effective_from IS NOT NULL)`),
          },
        ]
      : [version(p.expectedVersion, 'pv'), {code: 'policy_not_approved', when: raw(`pv.state = 'approved'`)}];
  const approvedFields =
    p.to === 'approved' ? sql`, approved_at = ${p.now}, approved_by = ${p.actor}, public_announcement = 0` : raw('');
  return {
    snapshot: rowSnapshot('policy_versions', p.id),
    writes: guard => [
      sql`UPDATE policy_versions AS pv SET state = ${p.to}${approvedFields}, version = pv.version + 1,
          updated_at = ${p.now}, updated_by = ${p.actor}, last_mutation_id = ${p.mutationId}
        WHERE pv.id = ${p.id} AND ${allOf(checks)} AND ${guard}`,
    ],
    appliedWhen: rowCarries('policy_versions', p.id, p.mutationId),
    rejectReason: sql`COALESCE((SELECT ${firstFailure(checks)} FROM policy_versions AS pv WHERE pv.id = ${p.id}), 'not_found')`,
    outcome: rowSnapshot('policy_versions', p.id),
  };
}

export const SETTING_KEYS = {
  confirmed_bookings_enabled: ['0', '1'],
  required_contact: ['phone', 'email', 'either'],
  exception_process_approved: ['0', '1'],
  exception_process_text: null, // free text
} as const;
export type SettingKey = keyof typeof SETTING_KEYS;

export function setSetting(p: {
  key: SettingKey;
  value: string;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const snapshot = sql`(SELECT json_object('key', key, 'value', value) FROM settings WHERE key = ${p.key})`;
  return {
    snapshot,
    writes: guard => [
      sql`INSERT INTO settings (key, value, updated_at, updated_by, last_mutation_id)
        SELECT ${p.key}, ${p.value}, ${p.now}, ${p.actor}, ${p.mutationId} WHERE ${guard}
        ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
          updated_by = excluded.updated_by, last_mutation_id = excluded.last_mutation_id`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM settings WHERE key = ${p.key} AND last_mutation_id = ${p.mutationId})`,
    rejectReason: sql`'rejected'`,
    outcome: snapshot,
  };
}

export function saveStaffMember(p: {
  email: string;
  role: 'owner' | 'staff';
  active: boolean;
  actor: string;
  mutationId: string;
  now: number;
}): ActionSpec {
  const snapshot = sql`(SELECT json_object('email', email, 'role', role, 'active', active) FROM staff_members WHERE email = ${p.email})`;
  // The last active owner can't be removed or demoted (nobody could manage staff after that).
  const keepsAnOwner: Check = {
    code: 'last_owner',
    when: sql`(${p.role} = 'owner' AND ${p.active} = 1) OR EXISTS (SELECT 1 FROM staff_members o
      WHERE o.role = 'owner' AND o.active = 1 AND o.email <> ${p.email})`,
  };
  return {
    snapshot,
    writes: guard => [
      sql`INSERT INTO staff_members (email, role, active, version, created_at, updated_at, last_mutation_id)
        SELECT ${p.email}, ${p.role}, ${p.active}, 1, ${p.now}, ${p.now}, ${p.mutationId}
        WHERE ${keepsAnOwner.when} AND ${guard}
        ON CONFLICT (email) DO UPDATE SET role = excluded.role, active = excluded.active,
          version = staff_members.version + 1, updated_at = excluded.updated_at, last_mutation_id = excluded.last_mutation_id`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM staff_members WHERE email = ${p.email} AND last_mutation_id = ${p.mutationId})`,
    rejectReason: sql`(SELECT ${firstFailure([keepsAnOwner])})`,
    outcome: snapshot,
  };
}

/**
 * "Restablecer demostración": deletes the demo's bookings, money records, sessions and catalog
 * and writes the demo seed again, in one transaction. The reset lock can only be inserted in a
 * demo or local database (a trigger aborts it elsewhere), and every delete requires it.
 * Staff members, the audit log and this mutation's own ledger row stay.
 */
export function demoReset(p: {seed: SeedRow[]; mutationId: string; now: number; actor: string}): ActionSpec {
  const locked = raw('EXISTS (SELECT 1 FROM reset_lock)');
  const tables = [
    'payments',
    'term_acceptances',
    'term_proposals',
    'booking_requests',
    'bookings',
    'sessions',
    'experiences',
    'venues',
    'policy_versions',
    'settings',
  ];
  const snapshot = raw(
    `json_object('bookings', (SELECT COUNT(*) FROM bookings), 'sessions', (SELECT COUNT(*) FROM sessions))`,
  );
  return {
    snapshot,
    writes: guard => [
      sql`INSERT INTO reset_lock (id) SELECT 1 WHERE ${guard}`,
      ...tables.map(table => sql`DELETE FROM ${raw(table)} WHERE ${locked} AND ${guard}`),
      sql`DELETE FROM mutations WHERE mutation_id <> ${p.mutationId} AND ${locked} AND ${guard}`,
      ...p.seed.map(row => seedInsert(row, sql`${locked} AND ${guard}`)),
      sql`INSERT INTO settings (key, value, updated_at, updated_by, last_mutation_id)
        SELECT 'demo_seed_mutation', ${p.mutationId}, ${p.now}, ${p.actor}, ${p.mutationId} WHERE ${locked} AND ${guard}`,
      sql`DELETE FROM reset_lock WHERE ${guard}`,
    ],
    appliedWhen: sql`EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seed_mutation' AND value = ${p.mutationId})`,
    rejectReason: sql`'rejected'`,
    outcome: snapshot,
  };
}
