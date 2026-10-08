// Request bodies, validated the same way in the browser and in the Worker. The Worker never
// trusts a client's price, status, seats, role or total: these schemas carry only what a
// person typed or chose, and the rules in worker/rules.ts decide everything else.
import {z} from 'zod';

export const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const id = z.string().min(1).max(80);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform(value => (value ? value : null));

const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const contactSchema = z
  .object({
    contactKind: z.enum(['phone', 'email']),
    contactValue: z.string().trim().min(3).max(120),
  })
  .refine(c => (c.contactKind === 'phone' ? PHONE.test(c.contactValue) : EMAIL.test(c.contactValue)), {
    message: 'contact_invalid',
    path: ['contactValue'],
  });

export const termsSchema = z.object({
  policyVersionId: id,
  priceStatus: z.enum(['approved', 'not_charged']),
  unitPriceCents: z.number().int().min(0).nullable(),
  currency: z.string().length(3).nullable(),
});

export const createBookingSchema = z
  .object({
    intent: z.enum(['reserve', 'request']),
    sessionId: id,
    partySize: z.number().int().min(1).max(60),
    leadName: z.string().trim().min(2).max(80),
    contactKind: z.enum(['phone', 'email']),
    contactValue: z.string().trim().min(3).max(120),
    note: optionalText(280),
    token: z.string().regex(TOKEN),
    terms: termsSchema.nullable(),
    acceptedTerms: z.boolean(),
  })
  .refine(b => (b.contactKind === 'phone' ? PHONE.test(b.contactValue) : EMAIL.test(b.contactValue)), {
    message: 'contact_invalid',
    path: ['contactValue'],
  })
  .refine(b => b.intent === 'request' || (b.terms !== null && b.acceptedTerms), {
    message: 'terms_required',
    path: ['acceptedTerms'],
  });
export type CreateBookingBody = z.infer<typeof createBookingSchema>;

export const manageSchema = z.object({token: z.string().regex(TOKEN)});
export const withdrawSchema = manageSchema.extend({expectedVersion: z.number().int().min(1)});
export const acceptSchema = manageSchema.extend({proposalId: id});
export const guestRequestSchema = manageSchema.extend({
  kind: z.enum(['cancel', 'change']),
  details: optionalText(400),
});

// ------------------------------------------------------------------ staff

const cents = z.number().int().min(0).max(10_000_000);

export const sessionFieldsSchema = z
  .object({
    experienceId: id,
    venueId: id.nullable(),
    startsAt: z.number().int().nullable(),
    endsAt: z.number().int().nullable(),
    capacity: z.number().int().min(0).max(5000).nullable(),
    blockedSeats: z.number().int().min(0).max(5000),
    partyMin: z.number().int().min(1).max(60).nullable(),
    partyMax: z.number().int().min(1).max(60).nullable(),
    bookingMode: z.enum(['inquiry', 'confirmed']),
    priceStatus: z.enum(['unset', 'approved', 'not_charged']),
    priceCents: cents.nullable(),
    currency: z.string().length(3).nullable(),
    policyVersionId: id.nullable(),
    lowSeatsThreshold: z.number().int().min(1).max(5000).nullable(),
  })
  .refine(f => f.endsAt === null || (f.startsAt !== null && f.endsAt > f.startsAt), {message: 'end_before_start'})
  .refine(f => f.partyMin === null || f.partyMax === null || f.partyMin <= f.partyMax, {message: 'party_limits'})
  .refine(
    f =>
      f.priceStatus === 'approved'
        ? f.priceCents !== null && f.currency !== null
        : f.priceCents === null && f.currency === null,
    {message: 'price_fields'},
  );
export type SessionFieldsBody = z.infer<typeof sessionFieldsSchema>;

export const sessionCreateSchema = z.object({fields: sessionFieldsSchema});
export const sessionUpdateSchema = z.object({expectedVersion: z.number().int().min(1), fields: sessionFieldsSchema});
export const sessionStateSchema = z.object({
  expectedVersion: z.number().int().min(1),
  transition: z.enum(['publish', 'unpublish', 'cancel', 'archive']),
});

export const manualBookingSchema = z
  .object({
    sessionId: id,
    partySize: z.number().int().min(1).max(60),
    leadName: z.string().trim().min(2).max(80),
    contactKind: z.enum(['phone', 'email']),
    contactValue: z.string().trim().min(3).max(120),
    note: optionalText(280),
    source: z.enum(['instagram_dm', 'phone', 'in_person', 'other']),
  })
  .refine(b => (b.contactKind === 'phone' ? PHONE.test(b.contactValue) : EMAIL.test(b.contactValue)), {
    message: 'contact_invalid',
    path: ['contactValue'],
  });

const versioned = {expectedVersion: z.number().int().min(1)};
export const bookingActionSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('confirm'), ...versioned}),
  z.object({action: z.literal('cancel'), ...versioned}),
  z.object({action: z.literal('resize'), ...versioned, partySize: z.number().int().min(1).max(60)}),
  z.object({action: z.literal('move'), ...versioned, destination: id}),
  z.object({action: z.literal('resolve_same'), ...versioned}),
  z.object({action: z.literal('resolve_other'), ...versioned, destination: id}),
  z.object({action: z.literal('check_in'), ...versioned}),
  z.object({action: z.literal('undo_check_in'), ...versioned}),
  z.object({action: z.literal('fulfilled'), ...versioned}),
  z.object({action: z.literal('no_show'), ...versioned}),
  z.object({action: z.literal('propose_terms'), ...versioned, sessionId: id}),
  z.object({action: z.literal('reissue_link'), ...versioned, token: z.string().regex(TOKEN)}),
  z.object({
    action: z.literal('edit'),
    ...versioned,
    partySize: z.number().int().min(1).max(60),
    leadName: z.string().trim().min(2).max(80),
    contactKind: z.enum(['phone', 'email']),
    contactValue: z.string().trim().min(3).max(120),
    note: optionalText(280),
  }),
]);
export type BookingActionBody = z.infer<typeof bookingActionSchema>;

export const PAYMENT_METHODS = ['ath_movil', 'efectivo', 'tarjeta', 'transferencia', 'otro', 'prueba'] as const;

export const paymentSchema = z
  .object({
    kind: z.enum(['payment', 'refund', 'reversal']),
    method: z.enum(PAYMENT_METHODS),
    amountCents: z.number().int().min(1).max(10_000_000),
    currency: z.string().length(3),
    externalReference: optionalText(80),
    reversesPaymentId: id.nullable(),
    note: optionalText(280),
  })
  .refine(p => (p.kind === 'reversal') === (p.reversesPaymentId !== null), {message: 'reversal_fields'});

export const experienceSchema = z.object({
  expectedVersion: z.number().int().min(1).nullable(),
  fields: z.object({
    titleEs: z.string().trim().min(2).max(120),
    titleEn: optionalText(120),
    descriptionEs: optionalText(600),
    descriptionEn: optionalText(600),
    inclusionsEs: optionalText(800),
    inclusionsEn: optionalText(800),
    photoSlot: z.enum(['room', 'table-food', 'food']).nullable(),
    status: z.enum(['draft', 'approved', 'archived']),
  }),
});

export const venueSchema = z.object({
  expectedVersion: z.number().int().min(1).nullable(),
  fields: z.object({
    name: z.string().trim().min(2).max(120),
    address: optionalText(240),
    instructions: optionalText(400),
    approved: z.boolean(),
    allowOverlap: z.boolean(),
  }),
});

export const policySchema = z.object({
  expectedVersion: z.number().int().min(1).nullable(),
  fields: z.object({
    title: z.string().trim().min(2).max(120),
    textEs: z.string().trim().min(2).max(4000),
    textEn: optionalText(4000),
    sourceUrl: z.url().max(400).nullable(),
    sourceNote: optionalText(400),
    publicAnnouncement: z.boolean(),
    appliesTo: z.enum(['booking_time', 'session_time']).nullable(),
    effectiveFrom: z.number().int().nullable(),
    effectiveUntil: z.number().int().nullable(),
    fullPayment: z.boolean().nullable(),
    refundFractionBp: z.number().int().min(0).max(10000).nullable(),
    cutoffRule: optionalText(400),
  }),
});

export const policyStateSchema = z.object({
  expectedVersion: z.number().int().min(1),
  to: z.enum(['approved', 'retired']),
});

export const settingSchema = z.discriminatedUnion('key', [
  z.object({key: z.literal('confirmed_bookings_enabled'), value: z.enum(['0', '1'])}),
  z.object({key: z.literal('required_contact'), value: z.enum(['phone', 'email', 'either'])}),
  z.object({key: z.literal('exception_process_approved'), value: z.enum(['0', '1'])}),
  z.object({key: z.literal('exception_process_text'), value: z.string().trim().max(1000)}),
]);

export const staffMemberSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL).max(120),
  role: z.enum(['owner', 'staff']),
  active: z.boolean(),
});
