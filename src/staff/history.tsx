// Readable history rows: a label for each audit action code (falling back to the code), the
// record, who and when, and only the fields that changed (Campo | Antes | Después), read from the
// ledger's own before and after snapshots. Nothing here is inferred beyond those records.
import {formatShortDate, formatTime, type Lang} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {helper, numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {buttonVariants} from '../components/ui/button.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {rowItem, useStaffT} from './ui.tsx';
import type {AuditEvent} from './types.ts';

type T = (key: string, vars?: Record<string, string | number>) => string;

// Literal keys (no template keys), so tests/unit/copy.test.ts can check each one exists.
const ACTION_KEYS: Record<string, string> = {
  create_reservation: 'hist.action.create_reservation',
  create_inquiry: 'hist.action.create_inquiry',
  withdraw: 'hist.action.withdraw',
  accept_terms: 'hist.action.accept_terms',
  guest_request: 'hist.action.guest_request',
  session_create: 'hist.action.session_create',
  session_update: 'hist.action.session_update',
  session_publish: 'hist.action.session_publish',
  session_unpublish: 'hist.action.session_unpublish',
  session_cancel: 'hist.action.session_cancel',
  session_archive: 'hist.action.session_archive',
  record_payment: 'hist.action.record_payment',
  confirm: 'hist.action.confirm',
  cancel: 'hist.action.cancel',
  resize: 'hist.action.resize',
  move: 'hist.action.move',
  resolve_same: 'hist.action.resolve_same',
  resolve_other: 'hist.action.resolve_other',
  check_in: 'hist.action.check_in',
  undo_check_in: 'hist.action.undo_check_in',
  fulfilled: 'hist.action.fulfilled',
  no_show: 'hist.action.no_show',
  propose_terms: 'hist.action.propose_terms',
  reissue_link: 'hist.action.reissue_link',
  edit: 'hist.action.edit',
  resolve_request: 'hist.action.resolve_request',
  experience_save: 'hist.action.experience_save',
  venue_save: 'hist.action.venue_save',
  policy_save: 'hist.action.policy_save',
  policy_approved: 'hist.action.policy_approved',
  policy_retired: 'hist.action.policy_retired',
  setting_set: 'hist.action.setting_set',
  staff_save: 'hist.action.staff_save',
  demo_reset: 'hist.action.demo_reset',
};

const FIELD_KEYS: Record<string, string> = {
  status: 'bk.status',
  state: 'ses.state',
  partySize: 'bk.party',
  sessionId: 'bk.session',
  startsAt: 'ses.date',
  capacity: 'ses.capacity',
  checkedInAt: 'ton.arrived',
  netCents: 'bk.netShort',
  priceCents: 'ses.amount',
  priceStatus: 'ses.price',
  bookingMode: 'ses.mode',
  venueId: 'ses.venue',
  policyVersionId: 'ses.policy',
  reference: 'bk.reference',
  exceptionReason: 'hist.reason',
  kind: 'bk.kind',
  email: 'team.email',
  role: 'team.role',
  active: 'team.active',
};

export const actionLabel = (t: T, code: string) => (ACTION_KEYS[code] ? t(ACTION_KEYS[code]) : code);

export type HistoryType = 'bookings' | 'sessions' | 'payments' | 'settings';

/** Which "Tipo" filter an event belongs to, from its own action and target. */
export function historyType(event: AuditEvent): HistoryType {
  if (event.action === 'record_payment') return 'payments';
  if (event.target_type === 'booking' || event.target_type === 'request') return 'bookings';
  if (event.target_type === 'session') return 'sessions';
  return 'settings';
}

type Snapshot = Record<string, unknown>;

/** A snapshot object; null when there was none; undefined when it can't be read. */
function parse(text: string | null): Snapshot | null | undefined {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Snapshot) : undefined;
  } catch {
    return undefined;
  }
}

function show(field: string, value: unknown, t: T, lang: Lang): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && /At$/.test(field) && value > 1e11)
    return `${formatShortDate(value, lang)} ${formatTime(value, lang)}`;
  if (typeof value === 'number' && /Cents$/.test(field)) return formatMoney(value, 'USD', lang);
  if (typeof value === 'string' && field === 'status') {
    const key = `bstatus.${value}`;
    return t(key) === key ? value : t(key);
  }
  if (typeof value === 'string' && field === 'state') {
    const key = `ses.state.${value}`;
    return t(key) === key ? value : t(key);
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function fieldLabel(field: string, t: T) {
  return FIELD_KEYS[field] ? t(FIELD_KEYS[field]) : field;
}

/** The changed fields, or null when a snapshot can't be read (then the raw values show). */
function changes(event: AuditEvent): {field: string; before: unknown; after: unknown}[] | null {
  const before = parse(event.before_json);
  const after = parse(event.after_json);
  if (before === undefined || after === undefined) return null;
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(
    field => field !== 'version' && field !== 'id',
  );
  return fields
    .filter(field => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null))
    .map(field => ({field, before: before?.[field], after: after?.[field]}));
}

function ChangeTable({event}: {event: AuditEvent}) {
  const {t, lang} = useStaffT();
  const list = changes(event);
  const cell = 'py-2 pr-3 align-top break-words';
  if (list === null) {
    return (
      <dl className="grid grid-cols-1 gap-2 text-sm leading-5 text-ink">
        <div>
          <dt className="text-muted">{t('hist.before')}</dt>
          <dd className="break-all">{event.before_json ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('hist.after')}</dt>
          <dd className="break-all">{event.after_json ?? '—'}</dd>
        </div>
      </dl>
    );
  }
  return (
    <table className="w-full table-fixed border-collapse text-left text-sm leading-5 text-ink">
      <thead>
        <tr className="text-muted">
          <th scope="col" className={cn(cell, 'font-medium')}>
            {t('hist.field')}
          </th>
          <th scope="col" className={cn(cell, 'font-medium')}>
            {t('hist.before')}
          </th>
          <th scope="col" className={cn(cell, 'font-medium')}>
            {t('hist.after')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/70 border-t border-border/70">
        {list.map(change => (
          <tr key={change.field}>
            <th scope="row" className={cn(cell, 'font-medium')}>
              {fieldLabel(change.field, t)}
            </th>
            <td className={cn(cell, numbers)}>{show(change.field, change.before, t, lang)}</td>
            <td className={cn(cell, numbers)}>{show(change.field, change.after, t, lang)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RecordLink({event}: {event: AuditEvent}) {
  const {t} = useStaffT();
  const snapshot = parse(event.after_json) ?? parse(event.before_json) ?? {};
  const link = buttonVariants({variant: 'link'});
  if (event.target_type === 'booking') {
    const ref = typeof snapshot.reference === 'string' ? snapshot.reference : event.target_id;
    return (
      <Link to={`/equipo/reservaciones/${event.target_id}/`} className={link}>
        {t('hist.record.booking', {ref})}
      </Link>
    );
  }
  if (event.target_type === 'request' && typeof snapshot.bookingId === 'string') {
    return (
      <Link to={`/equipo/reservaciones/${snapshot.bookingId}/`} className={link}>
        {t('hist.record.booking', {ref: snapshot.bookingId})}
      </Link>
    );
  }
  if (event.target_type === 'session') {
    return (
      <Link to={`/equipo/sesiones/${event.target_id}/`} className={link}>
        {t('hist.record.session', {ref: event.target_id})}
      </Link>
    );
  }
  return <span className={cn(helper, 'break-all')}>{event.target_id}</span>;
}

/** One audit event. On Historial the day is the group heading, so only the time shows. */
export function AuditRow({
  event,
  showRecord = true,
  withDate,
  className,
}: {
  event: AuditEvent;
  showRecord?: boolean;
  withDate?: boolean;
  className?: string;
}) {
  const {t, lang} = useStaffT();
  const list = changes(event);
  const time = formatTime(event.at, lang);
  return (
    <li className={cn(rowItem, 'flex flex-col gap-1', className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-medium leading-6 text-ink">
        <span>{actionLabel(t, event.action)}</span>
        {showRecord ? <RecordLink event={event} /> : null}
      </p>
      <p className={cn(helper, numbers, 'break-all')}>
        {t('hist.by', {who: event.actor, date: withDate ? `${formatShortDate(event.at, lang)} ${time}` : time})}
      </p>
      {list === null || list.length ? (
        <Disclosure variant="link" summary={t('hist.changes')}>
          <ChangeTable event={event} />
        </Disclosure>
      ) : null}
    </li>
  );
}
