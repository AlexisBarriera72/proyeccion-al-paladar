-- The door and text messages.
--
-- 1. Walk-ins: staff register guests who arrive without a reservation, and record that the
--    guest accepted the session's terms in person. term_acceptances.channel gains 'in_person'.
--    SQLite can't change a CHECK in place, so the table is rebuilt with its index and triggers
--    (dropping a table drops its triggers without firing them).
-- 2. Bookings record where the guest agreed to get their number by text (text_to, a number in
--    E.164 form, set only with their consent) and the language they booked in.
-- 3. text_messages: one row per text, its status only from what the provider answered.

CREATE TABLE term_acceptances_v2 (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  session_id TEXT NOT NULL REFERENCES sessions (id),
  policy_version_id TEXT NOT NULL REFERENCES policy_versions (id),
  price_status TEXT NOT NULL CHECK (price_status IN ('approved', 'not_charged')),
  unit_price_cents INTEGER,
  currency TEXT,
  accepted_at INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'guest_page' CHECK (channel IN ('guest_page', 'in_person')),
  mutation_id TEXT NOT NULL UNIQUE
);
INSERT INTO term_acceptances_v2 (id, booking_id, session_id, policy_version_id, price_status, unit_price_cents,
  currency, accepted_at, channel, mutation_id)
SELECT id, booking_id, session_id, policy_version_id, price_status, unit_price_cents, currency, accepted_at, channel,
  mutation_id
FROM term_acceptances;
DROP TABLE term_acceptances;
ALTER TABLE term_acceptances_v2 RENAME TO term_acceptances;
CREATE INDEX term_acceptances_booking ON term_acceptances (booking_id, session_id);
CREATE TRIGGER term_acceptances_no_update BEFORE UPDATE ON term_acceptances
BEGIN SELECT RAISE(ABORT, 'acceptances are append-only'); END;
CREATE TRIGGER term_acceptances_no_delete BEFORE DELETE ON term_acceptances
WHEN NOT EXISTS (SELECT 1 FROM reset_lock)
BEGIN SELECT RAISE(ABORT, 'acceptances are append-only'); END;

ALTER TABLE bookings ADD COLUMN text_to TEXT;
ALTER TABLE bookings ADD COLUMN lang TEXT NOT NULL DEFAULT 'es';

CREATE TABLE text_messages (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  kind TEXT NOT NULL CHECK (kind IN ('booking_number')),
  to_number TEXT NOT NULL,
  body TEXT,
  -- queued: waiting to be sent; sending: handed to the sender; sent: the provider accepted it;
  -- failed: the provider refused it; unknown: no answer came back; skipped: texts were off.
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'unknown', 'skipped')),
  provider_id TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE,
  last_mutation_id TEXT
);
CREATE INDEX text_messages_booking ON text_messages (booking_id, status);
