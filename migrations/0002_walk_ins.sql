-- Walk-ins: staff register guests who arrive without a reservation, and record that the guest
-- accepted the session's terms in person. term_acceptances.channel gains 'in_person'. SQLite
-- can't change a CHECK in place, so the table is rebuilt with its index and triggers (dropping a
-- table drops its triggers without firing them).

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
