// Staff: the calendar, the sessions list and one session's page (form, publishing checklist
// driven by the server's own checks, state changes, its reservations and the CSV).
import {useId, useMemo, useState} from 'react';
import {CircleCheck, CircleX, ChevronLeft, ChevronRight, Download, Plus} from 'lucide-react';
import {
  addMonths,
  formatLongDate,
  formatMonth,
  parsePrLocal,
  prDateKey,
  prDateParts,
  prMonthBounds,
  toPrLocalFields,
} from '../../shared/time.ts';
import {formatMoney} from '../lib/format.ts';
import {Link, navigate} from '../lib/router.tsx';
import {helper, numbers, pageTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {centsText, intOrNull, parseMoney, useQuery, useWrite} from './api.ts';
import {
  BookingStatus,
  Card,
  CheckField,
  Confirm,
  Demo,
  NoticeLine,
  Pill,
  QueryView,
  SelectField,
  TextField,
  When,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {useMe} from './me.ts';

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

export function PageHeading({children, actions}: {children: string; actions?: React.ReactNode}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
        {children}
      </h1>
      {actions}
    </div>
  );
}

function StatePill({state}: {state: StaffSession['state']}) {
  const {t} = useStaffT();
  return <Pill strong={state === 'published'}>{t(`ses.state.${state}`)}</Pill>;
}

function Seats({session}: {session: StaffSession}) {
  const {t} = useStaffT();
  return (
    <span className={cn('text-sm leading-5 text-ink', numbers)}>
      {session.capacity === null
        ? t('ses.seatsUnknown')
        : t('ses.seats', {taken: session.seats_taken, capacity: session.capacity - session.blocked_seats})}
    </span>
  );
}

function SessionRow({session}: {session: StaffSession}) {
  const {t} = useStaffT();
  return (
    <li>
      <Link
        to={`/equipo/sesiones/${session.id}/`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-300 bg-surface p-3 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-4"
      >
        <div className="min-w-0 space-y-1">
          <p className={cn('text-sm font-semibold leading-5 text-ink', numbers)}>
            <When ms={session.starts_at} />
          </p>
          <p className="text-base font-medium leading-6 text-ink">{session.title_es}</p>
          <p className={cn(helper, numbers)}>
            {t('ses.counts', {
              inquiries: session.inquiries ?? 0,
              pending: session.pending ?? 0,
              exceptions: session.exceptions ?? 0,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Demo synthetic={session.synthetic} />
          <StatePill state={session.state} />
          <Seats session={session} />
        </div>
      </Link>
    </li>
  );
}

function NewSessionButton() {
  const {t} = useStaffT();
  return (
    <Link to="/equipo/sesiones/nueva/" className={buttonVariants({variant: 'primary'})}>
      <Plus aria-hidden="true" />
      {t('ses.new')}
    </Link>
  );
}

export function CalendarView() {
  const {t, lang} = useStaffT();
  const me = useMe();
  const today = prDateParts(me.now);
  const [month, setMonth] = useState({year: today.year, month: today.month});
  const [from, to] = prMonthBounds(month.year, month.month);
  const {query, reload} = useQuery<{sessions: StaffSession[]}>(`/api/equipo/sessions?from=${from}&to=${to}`);
  return (
    <>
      <PageHeading actions={<NewSessionButton />}>{t('nav.calendar')}</PageHeading>
      <Card>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            aria-label={t('ses.prev')}
            className="w-11 px-0"
            onClick={() => setMonth(m => addMonths(m.year, m.month, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2
            aria-live="polite"
            className="min-w-36 text-center text-lg font-semibold leading-7 text-ink first-letter:uppercase"
          >
            {formatMonth(month.year, month.month, lang)}
          </h2>
          <Button
            variant="ghost"
            aria-label={t('ses.next')}
            className="w-11 px-0"
            onClick={() => setMonth(m => addMonths(m.year, m.month, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button variant="secondary" onClick={() => setMonth({year: today.year, month: today.month})}>
            {t('ses.today')}
          </Button>
        </div>
        <QueryView query={query} onRetry={() => void reload()}>
          {({sessions}) => {
            if (!sessions.length) return <p className="text-base leading-6 text-ink">{t('ses.empty')}</p>;
            const groups = new Map<string, StaffSession[]>();
            for (const session of sessions) {
              const key = session.starts_at === null ? 'tbd' : prDateKey(session.starts_at);
              groups.set(key, [...(groups.get(key) ?? []), session]);
            }
            return (
              <div className="space-y-5">
                {[...groups.entries()].map(([key, list]) => (
                  <section key={key} aria-labelledby={`staff-day-${key}`} className="space-y-2">
                    <h3
                      id={`staff-day-${key}`}
                      className="text-sm font-semibold leading-5 text-muted first-letter:uppercase"
                    >
                      {key === 'tbd' ? t('staff.dateTbd') : formatLongDate(list[0].starts_at!, lang)}
                    </h3>
                    <ul className="space-y-2">
                      {list.map(session => (
                        <SessionRow key={session.id} session={session} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            );
          }}
        </QueryView>
      </Card>
    </>
  );
}

export function SessionsList() {
  const {t} = useStaffT();
  const ids = useId();
  const [state, setState] = useState<'all' | StaffSession['state']>('all');
  const {query, reload} = useQuery<{sessions: StaffSession[]}>('/api/equipo/sessions');
  return (
    <>
      <PageHeading actions={<NewSessionButton />}>{t('nav.sessions')}</PageHeading>
      <Card>
        <div className="max-w-xs">
          <SelectField
            id={`${ids}-state`}
            label={t('ses.state')}
            value={state}
            onChange={setState}
            options={[
              {value: 'all', label: t('ses.allStates')},
              {value: 'draft', label: t('ses.state.draft')},
              {value: 'published', label: t('ses.state.published')},
              {value: 'cancelled', label: t('ses.state.cancelled')},
              {value: 'archived', label: t('ses.state.archived')},
            ]}
          />
        </div>
        <QueryView query={query} onRetry={() => void reload()}>
          {({sessions}) => {
            const shown = state === 'all' ? sessions : sessions.filter(session => session.state === state);
            return shown.length ? (
              <ul className="space-y-2">
                {shown.map(session => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </ul>
            ) : (
              <p className="text-base leading-6 text-ink">{t('ses.empty')}</p>
            );
          }}
        </QueryView>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ one session

interface Form {
  experienceId: string;
  venueId: string;
  tbd: boolean;
  date: string;
  start: string;
  end: string;
  capacity: string;
  blocked: string;
  partyMin: string;
  partyMax: string;
  bookingMode: 'inquiry' | 'confirmed';
  priceStatus: 'unset' | 'approved' | 'not_charged';
  amount: string;
  policyId: string;
  threshold: string;
}

function toForm(row: StaffSession | null, now: number): Form {
  const start = row?.starts_at ?? null;
  const fields = start === null ? toPrLocalFields(now + 14 * 24 * 60 * 60 * 1000) : toPrLocalFields(start);
  return {
    experienceId: row?.experience_id ?? '',
    venueId: row?.venue_id ?? '',
    tbd: row ? start === null : false,
    date: fields.date,
    start: start === null ? '19:00' : fields.time,
    end: row?.ends_at ? toPrLocalFields(row.ends_at).time : '',
    capacity: row?.capacity === null || row?.capacity === undefined ? '' : String(row.capacity),
    blocked: String(row?.blocked_seats ?? 0),
    partyMin: row?.party_min ? String(row.party_min) : '',
    partyMax: row?.party_max ? String(row.party_max) : '',
    bookingMode: row?.booking_mode ?? 'inquiry',
    priceStatus: row?.price_status ?? 'unset',
    amount: centsText(row?.price_cents ?? null),
    policyId: row?.policy_version_id ?? '',
    threshold: row?.low_seats_threshold ? String(row.low_seats_threshold) : '',
  };
}

type Errors = Partial<Record<keyof Form, string>>;

function toFields(form: Form, t: (key: string) => string): {fields: Record<string, unknown>} | {errors: Errors} {
  const errors: Errors = {};
  let startsAt: number | null = null;
  let endsAt: number | null = null;
  if (!form.experienceId) errors.experienceId = t('ses.pickExperience');
  if (!form.tbd) {
    startsAt = parsePrLocal(form.date, form.start);
    if (startsAt === null) errors.date = t('ses.invalidDate');
    if (form.end) {
      endsAt = parsePrLocal(form.date, form.end);
      if (endsAt === null) errors.end = t('ses.invalidDate');
      else if (startsAt !== null && endsAt <= startsAt) errors.end = t('ses.invalidEnd');
    }
  }
  const numbersOf = {
    capacity: intOrNull(form.capacity),
    partyMin: intOrNull(form.partyMin),
    partyMax: intOrNull(form.partyMax),
    threshold: intOrNull(form.threshold),
  };
  const blocked = intOrNull(form.blocked) ?? 0;
  for (const [key, value] of Object.entries(numbersOf)) {
    if (Number.isNaN(value) || (value === 0 && key !== 'capacity')) errors[key as keyof Form] = t('ses.invalidNumber');
  }
  if (Number.isNaN(blocked)) errors.blocked = t('ses.invalidNumber');
  if (numbersOf.partyMin && numbersOf.partyMax && numbersOf.partyMin > numbersOf.partyMax)
    errors.partyMax = t('ses.invalidParty');
  let priceCents: number | null = null;
  if (form.priceStatus === 'approved') {
    priceCents = parseMoney(form.amount);
    if (priceCents === null) errors.amount = t('ses.invalidAmount');
  }
  if (Object.keys(errors).length) return {errors};
  return {
    fields: {
      experienceId: form.experienceId,
      venueId: form.venueId || null,
      startsAt,
      endsAt,
      capacity: numbersOf.capacity,
      blockedSeats: blocked,
      partyMin: numbersOf.partyMin,
      partyMax: numbersOf.partyMax,
      bookingMode: form.bookingMode,
      priceStatus: form.priceStatus,
      priceCents,
      currency: form.priceStatus === 'approved' ? 'USD' : null,
      policyVersionId: form.policyId || null,
      lowSeatsThreshold: numbersOf.threshold,
    },
  };
}

function SessionForm({
  row,
  catalog,
  onSaved,
  setNotice,
}: {
  row: StaffSession | null;
  catalog: Catalog;
  onSaved: (id: string) => void;
  setNotice: (notice: Notice) => void;
}) {
  const {t} = useStaffT();
  const me = useMe();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setFormState] = useState<Form>(() => toForm(row, me.now));
  const [errors, setErrors] = useState<Errors>({});
  const set = (patch: Partial<Form>) => setFormState(current => ({...current, ...patch}));
  const owner = me.role === 'owner';
  const id = (name: string) => `${ids}-${name}`;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const built = toFields(form, t);
    if ('errors' in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    const result = row
      ? await run(`/api/equipo/sessions/${row.id}`, {expectedVersion: row.version, fields: built.fields})
      : await run('/api/equipo/sessions', {fields: built.fields});
    if (result.kind === 'error' && result.code === 'version_conflict') {
      setNotice({tone: 'problem', text: t('ses.stale')});
      return;
    }
    setNotice(outcome(result, row ? t('ses.saved') : t('ses.created')));
    if (result.kind === 'ok') {
      const saved = (result.data.outcome as {id?: string} | null)?.id ?? row?.id;
      if (saved) onSaved(saved);
    }
  };

  const experiences = catalog.experiences.filter(e => e.status !== 'archived' || e.id === form.experienceId);
  const policies = catalog.policies.filter(p => p.state !== 'retired' || p.id === form.policyId);

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <SelectField
        id={id('experience')}
        label={t('ses.experience')}
        value={form.experienceId}
        onChange={value => set({experienceId: value})}
        options={[
          {value: '', label: t('ses.pickExperience')},
          ...experiences.map(e => ({value: e.id, label: `${e.title_es} · ${t(`exp.status.${e.status}`)}`})),
        ]}
      />
      {errors.experienceId ? (
        <p role="alert" className="text-sm font-medium leading-5 text-ink">
          {errors.experienceId}
        </p>
      ) : null}
      <CheckField id={id('tbd')} label={t('ses.tbd')} checked={form.tbd} onChange={value => set({tbd: value})} />
      {form.tbd ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            id={id('date')}
            type="date"
            label={t('ses.date')}
            value={form.date}
            onChange={value => set({date: value})}
            error={errors.date}
            help={t('ses.tzHelp')}
          />
          <TextField
            id={id('start')}
            type="time"
            label={t('ses.start')}
            value={form.start}
            onChange={value => set({start: value})}
          />
          <TextField
            id={id('end')}
            type="time"
            label={t('ses.end')}
            value={form.end}
            onChange={value => set({end: value})}
            error={errors.end}
          />
        </div>
      )}
      <SelectField
        id={id('venue')}
        label={t('ses.venue')}
        value={form.venueId}
        onChange={value => set({venueId: value})}
        options={[
          {value: '', label: t('ses.noVenue')},
          ...catalog.venues.map(v => ({
            value: v.id,
            label: `${v.name} · ${v.approved ? t('venue.ok') : t('venue.pending')}`,
          })),
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={id('capacity')}
          label={t('ses.capacity')}
          inputMode="numeric"
          value={form.capacity}
          onChange={value => set({capacity: value})}
          error={errors.capacity}
          disabled={!owner}
          help={owner ? t('ses.capacityHelp') : t('ses.ownerOnly')}
        />
        <TextField
          id={id('blocked')}
          label={t('ses.blocked')}
          inputMode="numeric"
          value={form.blocked}
          onChange={value => set({blocked: value})}
          error={errors.blocked}
          disabled={!owner}
        />
        <TextField
          id={id('min')}
          label={t('ses.partyMin')}
          inputMode="numeric"
          value={form.partyMin}
          onChange={value => set({partyMin: value})}
          error={errors.partyMin}
        />
        <TextField
          id={id('max')}
          label={t('ses.partyMax')}
          inputMode="numeric"
          value={form.partyMax}
          onChange={value => set({partyMax: value})}
          error={errors.partyMax}
        />
      </div>
      <SelectField
        id={id('mode')}
        label={t('ses.mode')}
        value={form.bookingMode}
        onChange={value => set({bookingMode: value})}
        options={[
          {value: 'inquiry', label: t('ses.mode.inquiry')},
          {value: 'confirmed', label: t('ses.mode.confirmed')},
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id={id('price')}
          label={t('ses.price')}
          value={form.priceStatus}
          onChange={value => set({priceStatus: value})}
          options={[
            {value: 'unset', label: t('ses.price.unset')},
            {value: 'approved', label: t('ses.price.approved')},
            {value: 'not_charged', label: t('ses.price.not_charged')},
          ]}
        />
        {form.priceStatus === 'approved' ? (
          <TextField
            id={id('amount')}
            label={t('ses.amount')}
            inputMode="decimal"
            value={form.amount}
            onChange={value => set({amount: value})}
            error={errors.amount}
          />
        ) : null}
      </div>
      <SelectField
        id={id('policy')}
        label={t('ses.policy')}
        value={form.policyId}
        onChange={value => set({policyId: value})}
        options={[
          {value: '', label: t('ses.noPolicy')},
          ...policies.map(p => ({value: p.id, label: `${p.title} · ${t(`pol.state.${p.state}`)}`})),
        ]}
      />
      <TextField
        id={id('threshold')}
        label={t('ses.threshold')}
        inputMode="numeric"
        value={form.threshold}
        onChange={value => set({threshold: value})}
        error={errors.threshold}
        help={t('ses.thresholdHelp')}
      />
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? t('flow.sending') : t('ses.save')}
      </Button>
    </form>
  );
}

function Checklist({title, items}: {title: string; items: {code: string; ok: boolean}[]}) {
  const {t} = useStaffT();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold leading-5 text-ink">{title}</h3>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item.code} className="flex items-start gap-2 text-sm leading-5 text-ink">
            {item.ok ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="sr-only">{item.ok ? t('ses.checkOk') : t('ses.checkMissing')}: </span>
              <span className={item.ok ? '' : 'font-semibold'}>{t(`check.${item.code}`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SessionData {
  session: StaffSession;
  bookings: StaffBookingRow[];
  checklist: {publish: {code: string; ok: boolean}[]; confirmable: {code: string; ok: boolean}[]};
}

export function SessionPage({id}: {id: string | null}) {
  const {t, lang} = useStaffT();
  const me = useMe();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const catalog = useQuery<Catalog>('/api/equipo/catalog');
  const one = useQuery<SessionData>(id ? `/api/equipo/sessions/${id}` : null);

  const transition = async (session: StaffSession, to: 'publish' | 'unpublish' | 'cancel' | 'archive') => {
    const result = await run(`/api/equipo/sessions/${session.id}/state`, {
      expectedVersion: session.version,
      transition: to,
    });
    setNotice(outcome(result, t('ses.stateDone')));
    void one.reload(true);
  };

  const form = (row: StaffSession | null) => (
    <QueryView query={catalog.query} onRetry={() => void catalog.reload()}>
      {data => (
        <SessionForm
          key={row ? `${row.id}:${row.version}` : 'new'}
          row={row}
          catalog={data}
          setNotice={setNotice}
          onSaved={saved => {
            if (!row) navigate(`/equipo/sesiones/${saved}/`);
            else void one.reload(true);
          }}
        />
      )}
    </QueryView>
  );

  if (!id) {
    return (
      <>
        <PageHeading>{t('ses.new')}</PageHeading>
        <div className="max-w-2xl space-y-4">
          <NoticeLine notice={notice} />
          <Card>{form(null)}</Card>
        </div>
      </>
    );
  }

  return (
    <QueryView query={one.query} onRetry={() => void one.reload()}>
      {({session, bookings, checklist}) => {
        const experience =
          catalog.query.state === 'ready'
            ? catalog.query.data.experiences.find(e => e.id === session.experience_id)
            : undefined;
        const title = experience?.title_es ?? t('nav.sessions');
        const price =
          session.price_status === 'approved' && session.price_cents !== null && session.currency
            ? formatMoney(session.price_cents, session.currency, lang)
            : t(`ses.price.${session.price_status}`);
        return (
          <>
            <Link to="/equipo/sesiones/" className={cn(buttonVariants({variant: 'ghost'}), '-ml-3 mb-2')}>
              <ChevronLeft aria-hidden="true" />
              {t('ses.back')}
            </Link>
            <PageHeading>{title}</PageHeading>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Demo synthetic={session.synthetic} />
              <StatePill state={session.state} />
              <span className="text-sm leading-5 text-ink">
                <When ms={session.starts_at} />
              </span>
              <Seats session={session} />
              <span className={cn('text-sm leading-5 text-ink', numbers)}>{price}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-4">
                <NoticeLine notice={notice} />
                {notice?.text === t('ses.stale') ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNotice(null);
                      void one.reload(true);
                    }}
                  >
                    {t('ses.loadCurrent')}
                  </Button>
                ) : null}
                <Card title={t('ses.edit')}>{form(session)}</Card>
                <Card
                  title={t('ses.bookings')}
                  actions={
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/equipo/reservaciones/nueva/?session=${session.id}`}
                        className={buttonVariants({variant: 'secondary'})}
                      >
                        <Plus aria-hidden="true" />
                        {t('bk.new')}
                      </Link>
                      <a
                        href={`/api/equipo/export.csv?session=${session.id}`}
                        download
                        className={buttonVariants({variant: 'ghost'})}
                      >
                        <Download aria-hidden="true" />
                        {t('ses.export')}
                      </a>
                    </div>
                  }
                >
                  {bookings.length ? (
                    <BookingTable bookings={bookings} />
                  ) : (
                    <p className="text-base leading-6 text-ink">{t('ses.noBookings')}</p>
                  )}
                </Card>
              </div>
              <div className="space-y-4">
                <Card title={t('ses.state')}>
                  <div className="flex flex-wrap gap-2">
                    {session.state === 'draft' ? (
                      <Confirm
                        variant="primary"
                        trigger={t('ses.publish')}
                        title={t('ses.publish')}
                        body={t('ses.publishBody')}
                        confirmLabel={t('ses.publish')}
                        disabled={busy}
                        onConfirm={() => transition(session, 'publish')}
                      />
                    ) : null}
                    {session.state === 'published' ? (
                      <Confirm
                        variant="secondary"
                        trigger={t('ses.unpublish')}
                        title={t('ses.unpublish')}
                        body={t('ses.unpublishBody')}
                        confirmLabel={t('ses.unpublish')}
                        disabled={busy}
                        onConfirm={() => transition(session, 'unpublish')}
                      />
                    ) : null}
                    {session.state === 'draft' || session.state === 'published' ? (
                      <Confirm
                        trigger={t('ses.cancel')}
                        title={t('ses.cancel')}
                        body={t('ses.cancelBody')}
                        confirmLabel={t('ses.cancel')}
                        disabled={busy}
                        onConfirm={() => transition(session, 'cancel')}
                      />
                    ) : null}
                    {session.state === 'cancelled' ||
                    (session.state === 'published' && session.starts_at !== null && session.starts_at < me.now) ? (
                      <Confirm
                        trigger={t('ses.archive')}
                        title={t('ses.archive')}
                        body={t('ses.archiveBody')}
                        confirmLabel={t('ses.archive')}
                        disabled={busy}
                        onConfirm={() => transition(session, 'archive')}
                      />
                    ) : null}
                  </div>
                </Card>
                <Card>
                  <Checklist title={t('ses.checklist')} items={checklist.publish} />
                  <Checklist title={t('ses.checklistConfirm')} items={checklist.confirmable} />
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </QueryView>
  );
}

export function BookingTable({bookings, showSession}: {bookings: StaffBookingRow[]; showSession?: boolean}) {
  const {t, lang} = useStaffT();
  const rows = useMemo(() => bookings, [bookings]);
  return (
    <ul className="divide-y divide-border/70">
      {rows.map(booking => (
        <li key={booking.id}>
          <Link
            to={`/equipo/reservaciones/${booking.id}/`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-3 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="min-w-0 space-y-0.5">
              <span className="block text-base font-medium leading-6 text-ink">{booking.lead_name}</span>
              <span className={cn('block', helper, numbers)}>
                {booking.reference} ·{' '}
                {booking.party_size === 1 ? t('bk.person') : t('bk.people', {count: booking.party_size})}
                {showSession ? (
                  <>
                    {' · '}
                    {booking.title_es} · <When ms={booking.starts_at ?? null} />
                  </>
                ) : null}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Demo synthetic={booking.synthetic} />
              {booking.net > 0 ? (
                <span className={cn('text-sm leading-5 text-ink', numbers)}>
                  {formatMoney(booking.net, 'USD', lang)}
                </span>
              ) : null}
              <BookingStatus status={booking.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
