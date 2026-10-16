// Business time: every customer-facing date and time is shown in Puerto Rico time, with a
// label, whatever the visitor's device zone is. Instants are stored as UTC milliseconds.
import {TZDate} from '@date-fns/tz';

export const BUSINESS_TZ = 'America/Puerto_Rico';
export type Lang = 'es' | 'en';

const locale = (lang: Lang) => (lang === 'en' ? 'en-US' : 'es-PR');

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(lang: Lang, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = lang + JSON.stringify(options);
  let format = cache.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale(lang), {timeZone: BUSINESS_TZ, ...options});
    cache.set(key, format);
  }
  return format;
}

/** "domingo, 11 de octubre de 2026" / "Sunday, October 11, 2026" */
export const formatLongDate = (ms: number, lang: Lang) =>
  fmt(lang, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(ms);

/** "dom., 11 oct." / "Sun, Oct 11" */
export const formatShortDate = (ms: number, lang: Lang) =>
  fmt(lang, {weekday: 'short', day: 'numeric', month: 'short'}).format(ms);

/** The parts of a date stub: {weekday: "mié", day: "14", month: "oct"}, in Puerto Rico time. */
export function stubParts(ms: number, lang: Lang): {weekday: string; day: string; month: string} {
  const parts = fmt(lang, {weekday: 'short', day: 'numeric', month: 'short'}).formatToParts(ms);
  const get = (type: string) => (parts.find(part => part.type === type)?.value ?? '').replace(/\.$/, '');
  return {weekday: get('weekday'), day: get('day'), month: get('month')};
}

/** "7:00 p. m." / "7:00 PM" */
export const formatTime = (ms: number, lang: Lang) => fmt(lang, {hour: 'numeric', minute: '2-digit'}).format(ms);

/** "octubre de 2026" / "October 2026" */
export const formatMonth = (year: number, month: number, lang: Lang) =>
  fmt(lang, {month: 'long', year: 'numeric'}).format(prLocalToUtc(year, month, 15, 12, 0));

/** The Puerto Rico calendar date of an instant: {year, month (1-12), day}. */
export function prDateParts(ms: number): {year: number; month: number; day: number} {
  const parts = fmt('en', {year: 'numeric', month: 'numeric', day: 'numeric'}).formatToParts(ms);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return {year: get('year'), month: get('month'), day: get('day')};
}

/** "2026-10-11": the Puerto Rico date of an instant, for grouping and comparisons. */
export function prDateKey(ms: number): string {
  const {year, month, day} = prDateParts(ms);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The UTC instant of a Puerto Rico wall-clock time (month is 1-12). */
export function prLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): number {
  return new TZDate(year, month - 1, day, hour, minute, 0, 0, BUSINESS_TZ).getTime();
}

/** Parses "YYYY-MM-DD" and "HH:MM" as Puerto Rico time. Null when either is malformed. */
export function parsePrLocal(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const ms = prLocalToUtc(year, month, day, hour, minute);
  // Reject dates that roll over (February 30 and the like).
  return prDateKey(ms) === date ? ms : null;
}

/** "YYYY-MM-DD" and "HH:MM" for an instant, in Puerto Rico time (for staff form fields). */
export function toPrLocalFields(ms: number): {date: string; time: string} {
  const parts = fmt('en', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(ms);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '00';
  return {date: prDateKey(ms), time: `${get('hour')}:${get('minute')}`};
}

/** [start, end) UTC instants of the Puerto Rico day containing `ms`. */
export function prDayBounds(ms: number): [number, number] {
  const {year, month, day} = prDateParts(ms);
  const start = prLocalToUtc(year, month, day, 0, 0);
  const next = new TZDate(year, month - 1, day + 1, 0, 0, 0, 0, BUSINESS_TZ).getTime();
  return [start, next];
}

/** [start, end) UTC instants of a Puerto Rico calendar month (month is 1-12). */
export function prMonthBounds(year: number, month: number): [number, number] {
  return [
    new TZDate(year, month - 1, 1, 0, 0, 0, 0, BUSINESS_TZ).getTime(),
    new TZDate(year, month, 1, 0, 0, 0, 0, BUSINESS_TZ).getTime(),
  ];
}

/** Adds months to a {year, month} pair. */
export function addMonths(year: number, month: number, delta: number): {year: number; month: number} {
  const index = year * 12 + (month - 1) + delta;
  return {year: Math.floor(index / 12), month: (index % 12) + 1};
}

/** Days of the month grid (weeks start on Monday), with null for padding cells. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new TZDate(year, month - 1, 1, 12, 0, 0, 0, BUSINESS_TZ);
  const daysInMonth = new TZDate(year, month, 0, 12, 0, 0, 0, BUSINESS_TZ).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (number | null)[] = Array.from({length: offset}, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return cells;
}
