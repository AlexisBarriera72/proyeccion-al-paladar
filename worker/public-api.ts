// The guest API: sessions, policies, reservations and the guest's own page.
import {sql} from './sql.ts';
import {first, type Db} from './db.ts';
import {error, json, mutationIdOf, newReference, readJson, sha256Hex} from './http.ts';
import {answer, write} from './mutate.ts';
import {acceptTerms, createInquiry, createReservation, guestRequest, withdraw} from './rules.ts';
import {manageView, publicPolicies, publicSession, publicSessions} from './views.ts';
import {
  acceptSchema,
  createBookingSchema,
  guestRequestSchema,
  manageSchema,
  withdrawSchema,
} from '../shared/schemas.ts';
import type {Env} from './env.ts';
import type {PublicConfig} from '../shared/types.ts';

export const INSTAGRAM_URL = 'https://www.instagram.com/proyeccionalpaladarpr/';

interface Context {
  env: Env;
  db: Db;
  now: number;
}

function invalid(issues: {message: string; path: PropertyKey[]}[]) {
  const first = issues[0];
  return error(first?.message && /^[a-z_]+$/.test(first.message) ? first.message : 'invalid', 400, {
    field: first?.path?.join('.') || null,
  });
}

export async function handlePublic(request: Request, url: URL, ctx: Context): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  if (method === 'GET' && path === '/api/public/config') {
    const contact = await first<{value: string}>(
      ctx.db,
      sql`SELECT value FROM settings WHERE key = 'required_contact'`,
    );
    const config: PublicConfig = {
      environment: ctx.env.APP_ENV as PublicConfig['environment'],
      demo: ctx.env.DEMO_MODE === '1',
      requiredContact: (contact?.value as PublicConfig['requiredContact']) ?? null,
      instagramUrl: INSTAGRAM_URL,
      now: ctx.now,
    };
    return json(config);
  }

  if (method === 'GET' && path === '/api/public/sessions') {
    const from = Number(url.searchParams.get('from'));
    const since = Number.isFinite(from) && from > 0 ? from : ctx.now - 31 * 24 * 60 * 60 * 1000;
    return json({sessions: await publicSessions(ctx.db, ctx.now, since)});
  }

  const one = /^\/api\/public\/sessions\/([A-Za-z0-9_-]{1,80})$/.exec(path);
  if (method === 'GET' && one) {
    const session = await publicSession(ctx.db, ctx.now, one[1]);
    return session ? json({session}) : error('not_found', 404);
  }

  if (method === 'GET' && path === '/api/public/policies') return json(await publicPolicies(ctx.db));

  if (method !== 'POST') return error('not_found', 404);
  const mutationId = mutationIdOf(request);
  const body = await readJson(request);
  if (!body.ok) return body.response;

  if (path === '/api/public/manage') {
    const parsed = manageSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const view = await manageView(ctx.db, ctx.now, await sha256Hex(parsed.data.token));
    return view ? json({booking: view}) : error('link_invalid', 404);
  }

  if (!mutationId) return error('idempotency_key_required', 400);

  if (path === '/api/public/bookings') {
    const parsed = createBookingSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const b = parsed.data;
    const tokenDigest = await sha256Hex(b.token);
    const input = {
      bookingId: crypto.randomUUID(),
      reference: newReference(),
      sessionId: b.sessionId,
      partySize: b.partySize,
      leadName: b.leadName,
      contactKind: b.contactKind,
      contactValue: b.contactValue,
      note: b.note,
      source: 'web' as const,
      tokenDigest,
      mutationId,
      now: ctx.now,
    };
    // The payload covers what the guest sent (the token only as its digest), never server ids.
    const {token: _token, ...sent} = b;
    void _token;
    const result = await write({
      db: ctx.db,
      mutationId,
      action: b.intent === 'reserve' ? 'create_reservation' : 'create_inquiry',
      targetType: 'session',
      targetId: b.sessionId,
      actor: 'guest',
      expectedVersion: null,
      payload: {...sent, tokenDigest},
      now: ctx.now,
      makeSpec: mid =>
        b.intent === 'reserve' && b.terms
          ? createReservation({...input, mutationId: mid}, b.terms)
          : createInquiry({...input, mutationId: mid}, false),
    });
    if (result.kind === 'applied') {
      const outcome = result.outcome as {id: string; reference: string; status: string; version: number};
      if (result.replayed) {
        // A replay only restores access while the link it was created with still works.
        const current = await first<{token_digest: string | null}>(
          ctx.db,
          sql`SELECT token_digest FROM bookings WHERE id = ${outcome.id}`,
        );
        if (current?.token_digest !== tokenDigest) {
          return json({ok: true, replayed: true, reference: outcome.reference, linkReplaced: true});
        }
      }
      return json({
        ok: true,
        replayed: result.replayed,
        bookingId: outcome.id,
        reference: outcome.reference,
        status: outcome.status,
        version: outcome.version,
      });
    }
    return answer(result);
  }

  // The guest's own page: the token identifies the booking; the rules check it again.
  const byToken = async (token: string) => {
    const digest = await sha256Hex(token);
    const row = await first<{id: string}>(ctx.db, sql`SELECT id FROM bookings WHERE token_digest = ${digest}`);
    return row ? {id: row.id, digest} : null;
  };

  if (path === '/api/public/manage/withdraw') {
    const parsed = withdrawSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const booking = await byToken(parsed.data.token);
    if (!booking) return error('link_invalid', 404);
    return answer(
      await write({
        db: ctx.db,
        mutationId,
        action: 'withdraw',
        targetType: 'booking',
        targetId: booking.id,
        actor: 'guest',
        expectedVersion: parsed.data.expectedVersion,
        payload: {tokenDigest: booking.digest},
        now: ctx.now,
        makeSpec: mid =>
          withdraw({
            id: booking.id,
            expectedVersion: parsed.data.expectedVersion,
            mutationId: mid,
            now: ctx.now,
            tokenDigest: booking.digest,
          }),
      }),
    );
  }

  if (path === '/api/public/manage/accept') {
    const parsed = acceptSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const booking = await byToken(parsed.data.token);
    if (!booking) return error('link_invalid', 404);
    return answer(
      await write({
        db: ctx.db,
        mutationId,
        action: 'accept_terms',
        targetType: 'booking',
        targetId: booking.id,
        actor: 'guest',
        expectedVersion: null,
        payload: {tokenDigest: booking.digest, proposalId: parsed.data.proposalId},
        now: ctx.now,
        makeSpec: mid =>
          acceptTerms({
            bookingId: booking.id,
            proposalId: parsed.data.proposalId,
            tokenDigest: booking.digest,
            acceptanceId: crypto.randomUUID(),
            mutationId: mid,
            now: ctx.now,
          }),
      }),
    );
  }

  if (path === '/api/public/manage/request') {
    const parsed = guestRequestSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const booking = await byToken(parsed.data.token);
    if (!booking) return error('link_invalid', 404);
    return answer(
      await write({
        db: ctx.db,
        mutationId,
        action: 'guest_request',
        targetType: 'booking',
        targetId: booking.id,
        actor: 'guest',
        expectedVersion: null,
        payload: {tokenDigest: booking.digest, kind: parsed.data.kind, details: parsed.data.details},
        now: ctx.now,
        makeSpec: mid =>
          guestRequest({
            bookingId: booking.id,
            requestId: crypto.randomUUID(),
            tokenDigest: booking.digest,
            kind: parsed.data.kind,
            details: parsed.data.details,
            mutationId: mid,
            now: ctx.now,
          }),
      }),
    );
  }

  return error('not_found', 404);
}
