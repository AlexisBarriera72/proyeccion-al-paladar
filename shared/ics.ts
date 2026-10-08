// "Añadir a mi calendario": one VEVENT per booking, never per session. Times are UTC
// instants, so any calendar shows the right Puerto Rico time. STATUS follows RFC 5545
// §3.8.1.11: CONFIRMED only for a confirmed booking; a request that holds no seats is
// TENTATIVE and says so; a cancelled booking is CANCELLED.
import type {BookingStatus} from './types.ts';

export type IcsStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';

export function icsStatusFor(status: BookingStatus): IcsStatus {
  if (status === 'confirmed' || status === 'fulfilled') return 'CONFIRMED';
  if (status === 'cancelled' || status === 'no_show') return 'CANCELLED';
  return 'TENTATIVE'; // inquiry, pending_payment, exception
}

export interface IcsEvent {
  uid: string;
  start: number;
  end: number | null;
  summary: string;
  description: string;
  location: string | null;
  url: string | null;
  status: IcsStatus;
  stamp: number;
}

const two = (n: number) => String(n).padStart(2, '0');

export function icsDate(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}` +
    `T${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}Z`
  );
}

/** Escapes TEXT values (RFC 5545 §3.3.11). */
export function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (size + bytes > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(event: IcsEvent): string {
  // Without a confirmed end time, the event marks the start only.
  const end = event.end ?? event.start + 60 * 60 * 1000;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Proyeccion al Paladar//Reservaciones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(event.stamp)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.summary)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    `STATUS:${event.status}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** A Google Calendar link with the same instants (UTC) and wording. */
export function googleCalendarUrl(event: Omit<IcsEvent, 'uid' | 'stamp' | 'status'>): string {
  const end = event.end ?? event.start + 60 * 60 * 1000;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${icsDate(event.start)}/${icsDate(end)}`,
    details: event.url ? `${event.description}\n\n${event.url}` : event.description,
    ctz: 'America/Puerto_Rico',
  });
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}
