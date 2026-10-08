// Staff queues: Excepciones, guest requests, tonight's check-in list and the audit history.
import {formatShortDate, formatTime} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {helper, numbers} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {useState} from 'react';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {useQuery, useWrite} from './api.ts';
import {
  BookingStatus,
  Card,
  Confirm,
  Demo,
  NoticeLine,
  Pill,
  QueryView,
  When,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {PageHeading, type Catalog, type StaffBookingRow} from './Sessions.tsx';

export function Exceptions() {
  const {t, lang} = useStaffT();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<{exceptions: StaffBookingRow[]}>('/api/equipo/exceptions');
  const catalog = useQuery<Catalog>('/api/equipo/catalog');
  const setting = (key: string) =>
    catalog.query.state === 'ready' ? catalog.query.data.settings.find(s => s.key === key)?.value : undefined;
  const approved = setting('exception_process_approved') === '1';
  const processText = setting('exception_process_text');

  const act = async (booking: StaffBookingRow, action: 'resolve_same' | 'cancel') => {
    const result = await run(`/api/equipo/bookings/${booking.id}/actions`, {action, expectedVersion: booking.version});
    const next = outcome(result, t('bk.done'));
    setNotice(
      result.kind === 'ok' || action !== 'resolve_same'
        ? next
        : {tone: 'problem', text: `${next?.text} ${t('exc.failKept')}`},
    );
    void reload(true);
  };

  return (
    <>
      <PageHeading>{t('exc.title')}</PageHeading>
      <div className="space-y-4">
        <p className="text-base leading-6 text-ink">{t('exc.help')}</p>
        <Card title={t('exc.process')}>
          {approved && processText ? (
            <p className="whitespace-pre-line text-base leading-6 text-ink">{processText}</p>
          ) : (
            <p className="text-base font-medium leading-6 text-ink">{t('exc.processMissing')}</p>
          )}
        </Card>
        <NoticeLine notice={notice} />
        <QueryView query={query} onRetry={() => void reload()}>
          {({exceptions}) =>
            exceptions.length ? (
              <ul className="space-y-3">
                {exceptions.map(booking => (
                  <li key={booking.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Link
                            to={`/equipo/reservaciones/${booking.id}/`}
                            className={buttonVariants({variant: 'link'})}
                          >
                            {booking.lead_name} · {booking.reference}
                          </Link>
                          <p className={cn(helper, numbers)}>
                            {booking.title_es} · <When ms={booking.starts_at ?? null} /> ·{' '}
                            {booking.party_size === 1 ? t('bk.person') : t('bk.people', {count: booking.party_size})}
                          </p>
                          <p className={cn('text-sm leading-5 text-ink', numbers)}>
                            {t('bk.net', {amount: formatMoney(booking.net, 'USD', lang)})}
                          </p>
                          {booking.exception_reason ? (
                            <p className="text-sm leading-5 text-ink">
                              {t('bk.exceptionReason', {reason: t(`reason.${booking.exception_reason}`)})}
                            </p>
                          ) : null}
                        </div>
                        <Demo synthetic={booking.synthetic} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Confirm
                          variant="primary"
                          trigger={t('exc.same')}
                          title={t('exc.same')}
                          body={t('bk.confirmBody')}
                          confirmLabel={t('exc.same')}
                          disabled={busy}
                          onConfirm={() => act(booking, 'resolve_same')}
                        />
                        <Link
                          to={`/equipo/reservaciones/${booking.id}/`}
                          className={buttonVariants({variant: 'secondary'})}
                        >
                          {t('exc.other')}
                        </Link>
                        <Confirm
                          trigger={t('exc.cancel')}
                          title={t('bk.cancel')}
                          body={t('bk.cancelBody')}
                          confirmLabel={t('bk.cancel')}
                          disabled={busy}
                          onConfirm={() => act(booking, 'cancel')}
                        />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base leading-6 text-ink">{t('exc.empty')}</p>
            )
          }
        </QueryView>
      </div>
    </>
  );
}

interface GuestRequest {
  id: string;
  booking_id: string;
  kind: 'cancel' | 'change';
  details: string | null;
  created_at: number;
  reference: string;
  lead_name: string;
  booking_status: string;
}

export function Requests() {
  const {t, lang} = useStaffT();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<{requests: GuestRequest[]}>('/api/equipo/requests');
  return (
    <>
      <PageHeading>{t('req.title')}</PageHeading>
      <div className="space-y-4">
        <NoticeLine notice={notice} />
        <QueryView query={query} onRetry={() => void reload()}>
          {({requests}) =>
            requests.length ? (
              <ul className="space-y-3">
                {requests.map(r => (
                  <li key={r.id}>
                    <Card>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          to={`/equipo/reservaciones/${r.booking_id}/`}
                          className={buttonVariants({variant: 'link'})}
                        >
                          {r.lead_name} · {r.reference}
                        </Link>
                        <div className="flex flex-wrap gap-2">
                          <Pill strong>{t(`req.kind.${r.kind}`)}</Pill>
                          <BookingStatus status={r.booking_status} />
                        </div>
                      </div>
                      {r.details ? <p className="text-base leading-6 text-ink">{r.details}</p> : null}
                      <p className={helper}>
                        {formatShortDate(r.created_at, lang)} {formatTime(r.created_at, lang)}
                      </p>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          const result = await run(`/api/equipo/requests/${r.id}/resolve`, {});
                          setNotice(outcome(result, t('req.resolved')));
                          void reload(true);
                        }}
                      >
                        {t('bk.resolve')}
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base leading-6 text-ink">{t('req.empty')}</p>
            )
          }
        </QueryView>
      </div>
    </>
  );
}

export function Tonight() {
  const {t, lang} = useStaffT();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<{bookings: StaffBookingRow[]; dayStart: number}>('/api/equipo/tonight');
  return (
    <>
      <PageHeading>{t('ton.title')}</PageHeading>
      <div className="max-w-2xl space-y-4">
        <NoticeLine notice={notice} />
        <QueryView query={query} onRetry={() => void reload()}>
          {({bookings}) => {
            if (!bookings.length) return <p className="text-base leading-6 text-ink">{t('ton.empty')}</p>;
            const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'fulfilled');
            const total = confirmed.reduce((sum, b) => sum + b.party_size, 0);
            const arrived = confirmed.filter(b => b.checked_in_at).reduce((sum, b) => sum + b.party_size, 0);
            return (
              <>
                <p className={cn('text-lg font-semibold leading-7 text-ink', numbers)} aria-live="polite">
                  {t('ton.summary', {arrived, total})}
                </p>
                <ul className="space-y-2">
                  {bookings.map(b => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-300 bg-surface p-3"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/equipo/reservaciones/${b.id}/`}
                          className="text-base font-medium leading-6 text-ink underline-offset-4 hover:underline"
                        >
                          {b.lead_name}
                        </Link>
                        <p className={cn(helper, numbers)}>
                          {b.party_size === 1 ? t('bk.person') : t('bk.people', {count: b.party_size})} · {b.reference}
                          {b.starts_at ? ` · ${formatTime(b.starts_at, lang)}` : ''}
                        </p>
                        {b.checked_in_at ? (
                          <p className={cn('text-sm font-medium leading-5 text-ink', numbers)}>
                            {t('bk.checkedIn', {time: formatTime(b.checked_in_at, lang)})}
                          </p>
                        ) : null}
                      </div>
                      {b.status === 'confirmed' ? (
                        <Button
                          variant={b.checked_in_at ? 'secondary' : 'primary'}
                          disabled={busy}
                          onClick={async () => {
                            const result = await run(`/api/equipo/bookings/${b.id}/actions`, {
                              action: b.checked_in_at ? 'undo_check_in' : 'check_in',
                              expectedVersion: b.version,
                            });
                            setNotice(outcome(result, t('bk.done')));
                            void reload(true);
                          }}
                        >
                          {b.checked_in_at ? t('bk.undoCheckIn') : t('bk.checkIn')}
                        </Button>
                      ) : (
                        <BookingStatus status={b.status} />
                      )}
                    </li>
                  ))}
                </ul>
              </>
            );
          }}
        </QueryView>
      </div>
    </>
  );
}

interface AuditEvent {
  mutation_id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  before_json: string | null;
  after_json: string | null;
  at: number;
}

export function History() {
  const {t, lang} = useStaffT();
  const {query, reload} = useQuery<{events: AuditEvent[]}>('/api/equipo/audit?limit=200');
  return (
    <>
      <PageHeading>{t('hist.title')}</PageHeading>
      <Card>
        <QueryView query={query} onRetry={() => void reload()}>
          {({events}) =>
            events.length ? (
              <ul className="divide-y divide-border/70">
                {events.map(event => (
                  <li key={event.mutation_id} className="space-y-1 py-3">
                    <p className="text-sm font-semibold leading-5 text-ink">
                      {event.action} · {event.target_type} {event.target_id}
                    </p>
                    <p className={helper}>
                      {t('hist.by', {
                        who: event.actor,
                        date: `${formatShortDate(event.at, lang)} ${formatTime(event.at, lang)}`,
                      })}
                    </p>
                    <details className="text-sm leading-5 text-ink">
                      <summary className="cursor-pointer text-muted">
                        {t('hist.before')} / {t('hist.after')}
                      </summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-stone-50 p-3 font-mono text-xs leading-5">
                        {t('hist.before')}: {event.before_json ?? '—'}
                        {'\n'}
                        {t('hist.after')}: {event.after_json ?? '—'}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base leading-6 text-ink">{t('hist.empty')}</p>
            )
          }
        </QueryView>
      </Card>
    </>
  );
}
