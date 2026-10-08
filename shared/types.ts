// Shapes shared by the Worker and the browser.

export type BookingStatus =
  'inquiry' | 'pending_payment' | 'confirmed' | 'exception' | 'cancelled' | 'fulfilled' | 'no_show';

export type SessionState = 'draft' | 'published' | 'cancelled' | 'archived';
export type PriceStatus = 'unset' | 'approved' | 'not_charged';
export type ContactKind = 'phone' | 'email';
export type Source = 'web' | 'instagram_dm' | 'phone' | 'in_person' | 'other';
export type Role = 'owner' | 'staff';

/** What a guest sees about availability. "few_left" only with real inventory and a threshold. */
export type Availability = 'available' | 'few_left' | 'sold_out' | 'cancelled' | 'date_tbd' | 'past';

/** What a guest can do: reserve (accepting terms), request (inquiry), or nothing. */
export type GuestAction = 'reserve' | 'request' | 'none';

export interface Localized {
  es: string;
  en: string | null;
}

export interface PublicTerms {
  policyVersionId: string;
  priceStatus: 'approved' | 'not_charged';
  unitPriceCents: number | null;
  currency: string | null;
  prepayment: boolean;
}

export interface PublicPolicy {
  id: string;
  title: string;
  text: Localized;
  state: 'approved' | 'announced';
  effectiveFrom: number | null;
  sourceUrl: string | null;
  sourceNote: string | null;
}

export interface PublicVenue {
  name: string;
  address: string | null;
  instructions: string | null;
}

export interface PublicSession {
  id: string;
  experienceId: string;
  title: Localized;
  description: Localized | null;
  inclusions: {es: string[]; en: string[] | null};
  photoSlot: string | null;
  startsAt: number | null;
  endsAt: number | null;
  state: SessionState;
  availability: Availability;
  /** Seats left, only when the session has a real capacity and confirms bookings. */
  remaining: number | null;
  action: GuestAction;
  partyMin: number | null;
  partyMax: number | null;
  price: {status: PriceStatus; cents: number | null; currency: string | null};
  venue: PublicVenue | null;
  policy: PublicPolicy | null;
  /** The exact terms a guest accepts when reserving (only when action is "reserve"). */
  terms: PublicTerms | null;
  synthetic: boolean;
}

export interface PublicConfig {
  environment: 'local' | 'demo' | 'production';
  demo: boolean;
  requiredContact: 'phone' | 'email' | 'either' | null;
  instagramUrl: string;
  now: number;
}

export interface ManageProposal {
  id: string;
  session: PublicSession;
  terms: PublicTerms;
  createdAt: number;
}

export interface ManageView {
  bookingId: string;
  reference: string;
  status: BookingStatus;
  version: number;
  partySize: number;
  leadName: string;
  session: PublicSession;
  locked: {
    policy: PublicPolicy | null;
    priceStatus: 'approved' | 'not_charged' | null;
    unitPriceCents: number | null;
    currency: string | null;
    acceptedAt: number | null;
  };
  netPaidCents: number;
  proposals: ManageProposal[];
  openRequests: {id: string; kind: 'cancel' | 'change'; createdAt: number}[];
  canWithdraw: boolean;
}

/** The answer to any write. */
export type WriteResponse =
  | {ok: true; replayed: boolean; outcome: Record<string, unknown> | null}
  | {ok: false; error: string; replayed?: boolean};

export interface CreateBookingResponse {
  ok: true;
  replayed: boolean;
  bookingId: string;
  reference: string;
  status: BookingStatus;
  version: number;
}
