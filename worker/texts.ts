// Text messages with the booking number, for guests who ask for one.
//
// Off until the business sets up an SMS provider (Twilio): with no account configured, the guest
// form offers no text, nothing is queued and nothing is claimed. When a write leaves a booking
// confirmed and its guest asked for a text, worker/rules.ts queues one in the same transaction;
// this module then sends it and records what the provider answered, each step through the
// ledger. A text's status is only ever what the provider said (or that no answer came back).
// The text carries the booking number and the date, never the private link.
import {sql} from './sql.ts';
import {all, first, type Db} from './db.ts';
import {payloadHash, runMutation, type ActionSpec} from './ledger.ts';
import {claimText, recordText, skipText} from './rules.ts';
import {formatShortDate, formatTime, type Lang} from '../shared/time.ts';
import type {Env} from './env.ts';
import type {TextStatus} from '../shared/types.ts';

export type SendResult = {ok: true; id: string} | {ok: false; error: string; answered: boolean};

export interface TextSender {
  send(to: string, body: string): Promise<SendResult>;
}

/** The configured sender, or null when texts are off. The fake sender exists only in local tests. */
export function textSender(env: Env): TextSender | null {
  if (env.TEXT_FAKE === '1' && env.APP_ENV === 'local') return fakeSender;
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  const service = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !(from || service)) return null;
  return twilioSender({sid, token, from, service});
}

export const textsOn = (env: Env) => textSender(env) !== null;

/**
 * A number in E.164 form, or null. Only +1 numbers (Puerto Rico, the U.S. and the rest of the
 * North American plan) can take a text: anyone can book, and an international or premium number
 * would make the business pay for it. Ten digits are read as +1.
 */
export function toE164(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  const national = digits.length === 10 && !trimmed.startsWith('+') ? `1${digits}` : digits;
  // +1, then an area code and an exchange that don't start with 0 or 1.
  return /^1[2-9]\d{2}[2-9]\d{6}$/.test(national) ? `+${national}` : null;
}

/** "••• 0142": enough for a guest to recognize their number, nothing more. */
export const maskNumber = (e164: string) => `••• ${e164.slice(-4)}`;

/** The text, in the guest's language: the business, that it is confirmed, the number, the date. */
export function bookingTextBody(p: {reference: string; startsAt: number | null; lang: Lang}): string {
  const when = p.startsAt === null ? null : `${formatShortDate(p.startsAt, p.lang)}, ${formatTime(p.startsAt, p.lang)}`;
  return p.lang === 'en'
    ? `Proyección al Paladar: reservation confirmed. Your number: ${p.reference}.` +
        (when ? ` ${when} (Puerto Rico time).` : '') +
        ' Show it at the door.'
    : `Proyección al Paladar: reservación confirmada. Tu número: ${p.reference}.` +
        (when ? ` ${when} (hora de Puerto Rico).` : '') +
        ' Muéstralo en la entrada.';
}

function twilioSender(c: {sid: string; token: string; from?: string; service?: string}): TextSender {
  return {
    async send(to, body) {
      const form = new URLSearchParams({To: to, Body: body});
      if (c.service) form.set('MessagingServiceSid', c.service);
      else form.set('From', c.from!);
      let response: Response;
      try {
        response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.sid)}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${c.sid}:${c.token}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form,
            signal: AbortSignal.timeout(8000),
          },
        );
      } catch (error) {
        // No answer: it may or may not have been sent.
        return {ok: false, error: error instanceof Error ? error.name : 'network', answered: false};
      }
      const data = (await response.json().catch(() => null)) as {sid?: string; code?: number} | null;
      if (response.ok && data?.sid) return {ok: true, id: data.sid};
      return {ok: false, error: `twilio_${data?.code ?? response.status}`, answered: true};
    },
  };
}

/** Local tests only: accepts every number except one ending in 0000, which it refuses. */
const fakeSender: TextSender = {
  async send(to) {
    if (to.endsWith('0000')) return {ok: false, error: 'fake_refused', answered: true};
    return {ok: true, id: `fake-${crypto.randomUUID().slice(0, 8)}`};
  },
};

async function systemWrite(
  db: Db,
  now: number,
  targetId: string,
  action: string,
  payload: unknown,
  spec: (mid: string) => ActionSpec,
) {
  return runMutation(
    db,
    {
      // A new ID each time: of two requests sending the same text, only one can claim it.
      mutationId: crypto.randomUUID(),
      action,
      targetType: 'message',
      targetId,
      actor: 'system',
      expectedVersion: null,
      payloadHash: await payloadHash({action, payload}),
    },
    spec,
    now,
  );
}

/** Sends a booking's queued texts, records each outcome, and returns its latest text's status. */
export async function deliverTexts(
  db: Db,
  env: Env,
  now: number,
  bookingId: string,
  sender: TextSender | null = textSender(env),
): Promise<TextStatus | null> {
  const queued = await all<{id: string; to_number: string}>(
    db,
    sql`SELECT id, to_number FROM text_messages WHERE booking_id = ${bookingId} AND status = 'queued' ORDER BY created_at`,
  );
  for (const row of queued) {
    const claim = await systemWrite(db, now, row.id, 'text_claim', {}, mid =>
      claimText({id: row.id, mutationId: mid, now}),
    );
    if (claim.kind === 'rejected' && claim.reason === 'text_booking_not_confirmed') {
      // The booking stopped being confirmed before its text went out: it never will.
      await systemWrite(db, now, row.id, 'text_skip', {}, mid => skipText({id: row.id, mutationId: mid, now}));
      continue;
    }
    if (claim.kind !== 'applied') continue; // another request is sending it
    const booking = await first<{reference: string; lang: string; starts_at: number | null}>(
      db,
      sql`SELECT b.reference, b.lang, s.starts_at FROM bookings AS b JOIN sessions AS s ON s.id = b.session_id
        WHERE b.id = ${bookingId}`,
    );
    const body = booking
      ? bookingTextBody({
          reference: booking.reference,
          startsAt: booking.starts_at,
          lang: booking.lang === 'en' ? 'en' : 'es',
        })
      : null;
    let outcome: {status: 'sent' | 'failed' | 'unknown' | 'skipped'; providerId: string | null; error: string | null};
    if (!sender || !body) {
      outcome = {status: 'skipped', providerId: null, error: sender ? 'booking_missing' : 'texts_off'};
    } else {
      const sent = await sender.send(row.to_number, body);
      outcome = sent.ok
        ? {status: 'sent', providerId: sent.id, error: null}
        : {status: sent.answered ? 'failed' : 'unknown', providerId: null, error: sent.error};
    }
    await systemWrite(db, now, row.id, 'text_result', outcome, mid =>
      recordText({id: row.id, ...outcome, body, mutationId: mid, now}),
    );
  }
  return latestText(db, bookingId);
}

/** The booking's latest text, as a guest or staff member may see it. "sending" reads as unknown. */
export async function latestText(db: Db, bookingId: string): Promise<TextStatus | null> {
  const row = await first<{status: string; to_number: string; updated_at: number}>(
    db,
    sql`SELECT status, to_number, updated_at FROM text_messages WHERE booking_id = ${bookingId}
      ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  );
  if (!row) return null;
  const status = row.status === 'sending' ? 'unknown' : (row.status as TextStatus['status']);
  return {status, to: maskNumber(row.to_number), at: row.updated_at};
}
