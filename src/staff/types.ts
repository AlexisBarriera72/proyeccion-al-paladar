// The shapes the staff endpoints answer with (worker/staff-api.ts). Reads only; every write goes
// through the API and the server's mutation ledger.
import type {PublicPolicy} from '../../shared/types.ts';

export interface StaffSession {
  id: string;
  version: number;
  experience_id: string;
  venue_id: string | null;
  starts_at: number | null;
  ends_at: number | null;
  state: 'draft' | 'published' | 'cancelled' | 'archived';
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
  title_es?: string;
  seats_taken: number;
  inquiries?: number;
  pending?: number;
  exceptions?: number;
}

export interface StaffBookingRow {
  id: string;
  reference: string;
  session_id: string;
  party_size: number;
  lead_name: string;
  contact_kind: 'phone' | 'email';
  contact_value: string;
  note: string | null;
  status: string;
  exception_reason: string | null;
  source: string;
  checked_in_at: number | null;
  version: number;
  synthetic: number;
  created_at: number;
  net: number;
  starts_at?: number | null;
  title_es?: string;
  has_link?: number;
}

export interface Catalog {
  experiences: {
    id: string;
    title_es: string;
    status: string;
    version: number;
    synthetic: number;
    [key: string]: unknown;
  }[];
  venues: {id: string; name: string; approved: number; version: number; [key: string]: unknown}[];
  policies: {id: string; title: string; state: string; version: number; [key: string]: unknown}[];
  settings: {key: string; value: string; updated_at: number; updated_by: string}[];
  staff: {email: string; role: 'owner' | 'staff'; active: number; version: number}[];
}

export interface SessionData {
  session: StaffSession;
  bookings: StaffBookingRow[];
  checklist: {publish: {code: string; ok: boolean}[]; confirmable: {code: string; ok: boolean}[]};
}

export interface AuditEvent {
  mutation_id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  before_json: string | null;
  after_json: string | null;
  at: number;
}

export interface Payment {
  id: string;
  kind: 'payment' | 'refund' | 'reversal';
  method: string;
  amount_cents: number;
  currency: string;
  external_reference: string | null;
  reverses_payment_id: string | null;
  note: string | null;
  recorded_by: string;
  recorded_at: number;
}

export interface BookingData {
  booking: StaffBookingRow & {
    accepted_policy_version_id: string | null;
    accepted_at: number | null;
    terms_price_status: 'approved' | 'not_charged' | null;
    unit_price_cents: number | null;
    currency: string | null;
    has_link: number;
    updated_at: number;
  };
  session: (StaffSession & {title_es: string; seats_taken: number}) | null;
  payments: Payment[];
  acceptances: {
    id: string;
    session_id: string;
    policy_version_id: string;
    price_status: string;
    unit_price_cents: number | null;
    currency: string | null;
    accepted_at: number;
  }[];
  proposals: {
    id: string;
    session_id: string;
    status: 'open' | 'accepted' | 'withdrawn';
    created_at: number;
    created_by: string;
  }[];
  requests: {
    id: string;
    kind: 'cancel' | 'change';
    details: string | null;
    status: 'open' | 'resolved';
    created_at: number;
  }[];
  audit: AuditEvent[];
  lockedPolicy: PublicPolicy | null;
  lockedRules: {
    state: string;
    fullPayment: number | null;
    refundFractionBp: number | null;
    cutoffRule: string | null;
  } | null;
}
