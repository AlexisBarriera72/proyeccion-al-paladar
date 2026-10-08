-- Proyección al Paladar: sessions, group reservations and the staff workspace.
-- Times are UTC milliseconds; money is integer cents. Every write goes through the
-- mutation ledger (worker/ledger.ts). The rules for each action live in worker/rules.ts.

-- Which environment this database belongs to. Written once by `cf.mjs <env> init-db`;
-- cf.mjs and the Worker refuse to write when it doesn't match APP_ENV.
CREATE TABLE deployment_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  environment TEXT NOT NULL CHECK (environment IN ('local', 'demo', 'production')),
  created_at INTEGER NOT NULL
);
CREATE TRIGGER deployment_meta_no_update BEFORE UPDATE ON deployment_meta
BEGIN SELECT RAISE(ABORT, 'deployment_meta is written once'); END;
CREATE TRIGGER deployment_meta_no_delete BEFORE DELETE ON deployment_meta
BEGIN SELECT RAISE(ABORT, 'deployment_meta is written once'); END;

-- While a row exists here, the append-only tables accept deletes. Only a demo or local
-- database can hold it (the demo reset inserts it and removes it in the same batch).
CREATE TABLE reset_lock (id INTEGER PRIMARY KEY CHECK (id = 1));
CREATE TRIGGER reset_lock_demo_only BEFORE INSERT ON reset_lock
WHEN COALESCE((SELECT environment FROM deployment_meta WHERE id = 1), '') NOT IN ('demo', 'local')
BEGIN SELECT RAISE(ABORT, 'reset is only possible in a demo or local database'); END;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  last_mutation_id TEXT
);

CREATE TABLE staff_members (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_mutation_id TEXT
);

CREATE TABLE experiences (
  id TEXT PRIMARY KEY,
  title_es TEXT NOT NULL,
  title_en TEXT,
  description_es TEXT,
  description_en TEXT,
  inclusions_es TEXT, -- one item per line
  inclusions_en TEXT,
  photo_slot TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  last_mutation_id TEXT
);

CREATE TABLE venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  instructions TEXT,
  approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0, 1)),
  allow_overlap INTEGER NOT NULL DEFAULT 0 CHECK (allow_overlap IN (0, 1)),
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  last_mutation_id TEXT
);

-- A policy is a draft until the owner approves it with every rule set. Unknown rules stay
-- NULL, and a policy with a NULL rule can't be attached to a confirmable session.
CREATE TABLE policy_versions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text_es TEXT NOT NULL, -- the owners' exact wording
  text_en TEXT,
  source_url TEXT,
  source_note TEXT,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'approved', 'retired')),
  public_announcement INTEGER NOT NULL DEFAULT 0 CHECK (public_announcement IN (0, 1)),
  applies_to TEXT CHECK (applies_to IN ('booking_time', 'session_time')),
  effective_from INTEGER,
  effective_until INTEGER,
  full_payment INTEGER CHECK (full_payment IN (0, 1)),
  refund_fraction_bp INTEGER CHECK (refund_fraction_bp BETWEEN 0 AND 10000),
  cutoff_rule TEXT,
  approved_at INTEGER,
  approved_by TEXT,
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  last_mutation_id TEXT,
  CHECK (state <> 'approved' OR (applies_to IS NOT NULL AND full_payment IS NOT NULL AND approved_at IS NOT NULL))
);
-- Approved terms never change (a booking may have accepted them); they can only be retired.
CREATE TRIGGER policy_versions_approved_frozen BEFORE UPDATE ON policy_versions
WHEN OLD.state = 'approved' AND NOT (
  NEW.state = 'retired'
  AND NEW.text_es IS OLD.text_es AND NEW.text_en IS OLD.text_en
  AND NEW.applies_to IS OLD.applies_to AND NEW.effective_from IS OLD.effective_from
  AND NEW.full_payment IS OLD.full_payment AND NEW.refund_fraction_bp IS OLD.refund_fraction_bp
  AND NEW.cutoff_rule IS OLD.cutoff_rule
)
BEGIN SELECT RAISE(ABORT, 'approved policies can only be retired'); END;
CREATE TRIGGER policy_versions_retired_frozen BEFORE UPDATE ON policy_versions
WHEN OLD.state = 'retired'
BEGIN SELECT RAISE(ABORT, 'retired policies never change'); END;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  experience_id TEXT NOT NULL REFERENCES experiences (id),
  venue_id TEXT REFERENCES venues (id),
  starts_at INTEGER, -- NULL: "Fecha por confirmar"
  ends_at INTEGER,
  tz TEXT NOT NULL DEFAULT 'America/Puerto_Rico',
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  blocked_seats INTEGER NOT NULL DEFAULT 0 CHECK (blocked_seats >= 0),
  party_min INTEGER CHECK (party_min IS NULL OR party_min >= 1),
  party_max INTEGER CHECK (party_max IS NULL OR party_max >= 1),
  booking_mode TEXT NOT NULL DEFAULT 'inquiry' CHECK (booking_mode IN ('inquiry', 'confirmed')),
  price_status TEXT NOT NULL DEFAULT 'unset' CHECK (price_status IN ('unset', 'approved', 'not_charged')),
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  currency TEXT,
  policy_version_id TEXT REFERENCES policy_versions (id),
  low_seats_threshold INTEGER CHECK (low_seats_threshold IS NULL OR low_seats_threshold >= 1),
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'cancelled', 'archived')),
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  last_mutation_id TEXT,
  CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at > starts_at)),
  CHECK (party_min IS NULL OR party_max IS NULL OR party_min <= party_max),
  CHECK (price_status <> 'approved' OR (price_cents IS NOT NULL AND currency IS NOT NULL)),
  CHECK (price_status = 'approved' OR (price_cents IS NULL AND currency IS NULL))
);
CREATE INDEX sessions_starts_at ON sessions (starts_at);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions (id),
  party_size INTEGER NOT NULL CHECK (party_size >= 1),
  lead_name TEXT NOT NULL,
  contact_kind TEXT NOT NULL CHECK (contact_kind IN ('phone', 'email')),
  contact_value TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('inquiry', 'pending_payment', 'confirmed', 'exception', 'cancelled', 'fulfilled', 'no_show')
  ),
  exception_reason TEXT,
  source TEXT NOT NULL CHECK (source IN ('web', 'instagram_dm', 'phone', 'in_person', 'other')),
  token_digest TEXT UNIQUE,
  -- Locked terms: what the guest accepted. Later session edits never change them.
  accepted_policy_version_id TEXT REFERENCES policy_versions (id),
  accepted_at INTEGER,
  terms_price_status TEXT CHECK (terms_price_status IN ('approved', 'not_charged')),
  unit_price_cents INTEGER,
  currency TEXT,
  checked_in_at INTEGER,
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  last_mutation_id TEXT,
  prev_status TEXT,
  prev_party_size INTEGER,
  prev_session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX bookings_session_status ON bookings (session_id, status);
CREATE INDEX bookings_status ON bookings (status);

-- Each time a guest accepts a session's terms (policy version and price), on their page.
CREATE TABLE term_acceptances (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  session_id TEXT NOT NULL REFERENCES sessions (id),
  policy_version_id TEXT NOT NULL REFERENCES policy_versions (id),
  price_status TEXT NOT NULL CHECK (price_status IN ('approved', 'not_charged')),
  unit_price_cents INTEGER,
  currency TEXT,
  accepted_at INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'guest_page' CHECK (channel IN ('guest_page')),
  mutation_id TEXT NOT NULL UNIQUE
);
CREATE INDEX term_acceptances_booking ON term_acceptances (booking_id, session_id);
CREATE TRIGGER term_acceptances_no_update BEFORE UPDATE ON term_acceptances
BEGIN SELECT RAISE(ABORT, 'acceptances are append-only'); END;
CREATE TRIGGER term_acceptances_no_delete BEFORE DELETE ON term_acceptances
WHEN NOT EXISTS (SELECT 1 FROM reset_lock)
BEGIN SELECT RAISE(ABORT, 'acceptances are append-only'); END;

-- Staff ask a guest to accept a session's terms (to confirm, or to move to another date).
CREATE TABLE term_proposals (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  session_id TEXT NOT NULL REFERENCES sessions (id),
  policy_version_id TEXT NOT NULL REFERENCES policy_versions (id),
  price_status TEXT NOT NULL CHECK (price_status IN ('approved', 'not_charged')),
  unit_price_cents INTEGER,
  currency TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'accepted', 'withdrawn')),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE,
  last_mutation_id TEXT
);
CREATE INDEX term_proposals_booking ON term_proposals (booking_id, status);

-- Money recorded by staff from outside the site. Append-only, independent of booking status.
-- A mistake is corrected by a 'reversal' entry pointing to the original.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'refund', 'reversal')),
  method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  external_reference TEXT,
  reverses_payment_id TEXT UNIQUE REFERENCES payments (id),
  note TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE,
  CHECK ((kind = 'reversal') = (reverses_payment_id IS NOT NULL))
);
CREATE INDEX payments_booking ON payments (booking_id);
CREATE UNIQUE INDEX payments_method_reference ON payments (method, external_reference)
WHERE external_reference IS NOT NULL;
CREATE TRIGGER payments_no_update BEFORE UPDATE ON payments
BEGIN SELECT RAISE(ABORT, 'payments are append-only'); END;
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
WHEN NOT EXISTS (SELECT 1 FROM reset_lock)
BEGIN SELECT RAISE(ABORT, 'payments are append-only'); END;

-- Guest requests to staff (cancel, change) from the management page.
CREATE TABLE booking_requests (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  kind TEXT NOT NULL CHECK (kind IN ('cancel', 'change')),
  details TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  mutation_id TEXT NOT NULL UNIQUE,
  last_mutation_id TEXT
);
CREATE INDEX booking_requests_status ON booking_requests (status);

-- The mutation ledger. Each mutation ID is bound to (action, target_type, target_id, actor,
-- expected_version, payload_hash). A row is 'claimed' only inside its own batch; once
-- settled ('applied' or 'rejected') it never changes.
CREATE TABLE mutations (
  mutation_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  expected_version INTEGER,
  payload_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('claimed', 'applied', 'rejected')),
  reason TEXT,
  before_json TEXT, -- the target as it was when the mutation was claimed
  outcome_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE TRIGGER mutations_settled_immutable BEFORE UPDATE ON mutations
WHEN OLD.state <> 'claimed'
BEGIN SELECT RAISE(ABORT, 'a settled mutation is immutable'); END;
CREATE TRIGGER mutations_binding_immutable BEFORE UPDATE OF
  mutation_id, action, target_type, target_id, actor, expected_version, payload_hash, before_json, created_at ON mutations
BEGIN SELECT RAISE(ABORT, 'a mutation binding is immutable'); END;
CREATE TRIGGER mutations_no_delete BEFORE DELETE ON mutations
WHEN NOT EXISTS (SELECT 1 FROM reset_lock)
BEGIN SELECT RAISE(ABORT, 'mutations are append-only'); END;

-- One row per applied mutation, written in the same transaction.
CREATE TABLE audit_events (
  mutation_id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX audit_events_at ON audit_events (at);
CREATE INDEX audit_events_target ON audit_events (target_type, target_id);
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'the audit log is append-only'); END;
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'the audit log is append-only'); END;
