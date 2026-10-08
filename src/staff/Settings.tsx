// Staff: experiences, and Configuración (rules, places, terms, team, demo reset). Owner-only
// changes are refused by the server for other roles; the forms say so instead of hiding it.
import {useId, useState, type FormEvent, type ReactNode} from 'react';
import {Plus} from 'lucide-react';
import {formatLongDate, parsePrLocal, toPrLocalFields} from '../../shared/time.ts';
import {helper} from '../lib/styles.ts';
import {Button} from '../components/ui/button.tsx';
import {useQuery, useWrite} from './api.ts';
import {
  Card,
  CheckField,
  Confirm,
  Demo,
  NoticeLine,
  Pill,
  QueryView,
  SelectField,
  TextField,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {PageHeading, type Catalog} from './Sessions.tsx';
import {useMe} from './me.ts';

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const orNull = (text: string) => (text.trim() ? text.trim() : null);

/** A list of records, each opening an inline editor; plus a "new" editor. */
function Editable<R extends Row>({
  rows,
  newLabel,
  canCreate = true,
  render,
  editor,
}: {
  rows: R[];
  newLabel: string;
  canCreate?: boolean;
  render: (row: R) => ReactNode;
  editor: (row: R | null, close: () => void) => ReactNode;
}) {
  const {t} = useStaffT();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border/70">
        {rows.map(row => {
          const id = String(row.id ?? row.email);
          return (
            <li key={id} className="space-y-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">{render(row)}</div>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(editing === id ? null : id)}
                  aria-expanded={editing === id}
                >
                  {t('staff.edit')}
                </Button>
              </div>
              {editing === id ? editor(row, () => setEditing(null)) : null}
            </li>
          );
        })}
      </ul>
      {canCreate ? (
        editing === '__new' ? (
          editor(null, () => setEditing(null))
        ) : (
          <Button variant="secondary" onClick={() => setEditing('__new')}>
            <Plus aria-hidden="true" />
            {newLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ experiences

function ExperienceEditor({
  row,
  onDone,
  setNotice,
}: {
  row: Row | null;
  onDone: () => void;
  setNotice: (n: Notice) => void;
}) {
  const {t} = useStaffT();
  const me = useMe();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setForm] = useState({
    titleEs: str(row?.title_es),
    titleEn: str(row?.title_en),
    descriptionEs: str(row?.description_es),
    descriptionEn: str(row?.description_en),
    inclusionsEs: str(row?.inclusions_es),
    inclusionsEn: str(row?.inclusions_en),
    photoSlot: str(row?.photo_slot),
    status: (str(row?.status) || 'draft') as 'draft' | 'approved' | 'archived',
  });
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (form.titleEs.trim().length < 2) {
      setError(t('reason.invalid'));
      return;
    }
    setError(null);
    const result = await run(row ? `/api/equipo/experiences/${row.id}` : '/api/equipo/experiences', {
      expectedVersion: row ? row.version : null,
      fields: {
        titleEs: form.titleEs.trim(),
        titleEn: orNull(form.titleEn),
        descriptionEs: orNull(form.descriptionEs),
        descriptionEn: orNull(form.descriptionEn),
        inclusionsEs: orNull(form.inclusionsEs),
        inclusionsEn: orNull(form.inclusionsEn),
        photoSlot: form.photoSlot || null,
        status: form.status,
      },
    });
    setNotice(outcome(result, t('exp.saved')));
    if (result.kind === 'ok') onDone();
  };
  const id = (name: string) => `${ids}-${name}`;
  return (
    <form onSubmit={save} noValidate className="space-y-4 rounded-2xl border border-stone-300 p-4">
      <TextField
        id={id('tes')}
        label={t('exp.titleEs')}
        value={form.titleEs}
        onChange={v => set({titleEs: v})}
        error={error}
        maxLength={120}
      />
      <TextField
        id={id('ten')}
        label={t('exp.titleEn')}
        value={form.titleEn}
        onChange={v => set({titleEn: v})}
        maxLength={120}
      />
      <TextField
        id={id('des')}
        label={t('exp.descEs')}
        value={form.descriptionEs}
        onChange={v => set({descriptionEs: v})}
        multiline
        maxLength={600}
      />
      <TextField
        id={id('den')}
        label={t('exp.descEn')}
        value={form.descriptionEn}
        onChange={v => set({descriptionEn: v})}
        multiline
        maxLength={600}
      />
      <TextField
        id={id('ies')}
        label={t('exp.inclEs')}
        value={form.inclusionsEs}
        onChange={v => set({inclusionsEs: v})}
        multiline
        maxLength={800}
      />
      <TextField
        id={id('ien')}
        label={t('exp.inclEn')}
        value={form.inclusionsEn}
        onChange={v => set({inclusionsEn: v})}
        multiline
        maxLength={800}
      />
      <SelectField
        id={id('photo')}
        label={t('exp.photo')}
        value={form.photoSlot}
        onChange={v => set({photoSlot: v})}
        options={[
          {value: '', label: t('exp.noPhoto')},
          {value: 'room', label: t('exp.photo.room')},
          {value: 'table-food', label: t('exp.photo.table-food')},
          {value: 'food', label: t('exp.photo.food')},
        ]}
      />
      <SelectField
        id={id('status')}
        label={t('exp.status')}
        value={form.status}
        onChange={v => set({status: v})}
        help={me.role === 'owner' ? undefined : t('exp.approveOwner')}
        options={[
          {value: 'draft', label: t('exp.status.draft')},
          {value: 'approved', label: t('exp.status.approved')},
          {value: 'archived', label: t('exp.status.archived')},
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? t('flow.sending') : t('exp.save')}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t('staff.cancelAction')}
        </Button>
      </div>
    </form>
  );
}

export function Experiences() {
  const {t} = useStaffT();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<Catalog>('/api/equipo/catalog');
  return (
    <>
      <PageHeading>{t('exp.title')}</PageHeading>
      <div className="max-w-3xl space-y-4">
        <NoticeLine notice={notice} />
        <Card>
          <QueryView query={query} onRetry={() => void reload()}>
            {data => (
              <Editable
                rows={data.experiences as Row[]}
                newLabel={t('exp.new')}
                render={row => (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium leading-6 text-ink">{str(row.title_es)}</span>
                    <Pill strong={row.status === 'approved'}>{t(`exp.status.${row.status}`)}</Pill>
                    <Demo synthetic={row.synthetic} />
                  </div>
                )}
                editor={(row, close) => (
                  <ExperienceEditor
                    key={row ? `${row.id}:${row.version}` : 'new'}
                    row={row}
                    setNotice={setNotice}
                    onDone={() => {
                      close();
                      void reload(true);
                    }}
                  />
                )}
              />
            )}
          </QueryView>
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ settings

function RuleSettings({
  catalog,
  onSaved,
  setNotice,
}: {
  catalog: Catalog;
  onSaved: () => void;
  setNotice: (n: Notice) => void;
}) {
  const {t} = useStaffT();
  const me = useMe();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const value = (key: string) => catalog.settings.find(s => s.key === key)?.value ?? '';
  const [confirmations, setConfirmations] = useState(value('confirmed_bookings_enabled') || '0');
  const [contact, setContact] = useState(value('required_contact'));
  const [processText, setProcessText] = useState(value('exception_process_text'));
  const [processApproved, setProcessApproved] = useState(value('exception_process_approved') === '1');
  const owner = me.role === 'owner';

  const save = async (key: string, next: string) => {
    const result = await run('/api/equipo/settings', {key, value: next});
    setNotice(outcome(result, t('set.saved')));
    onSaved();
  };

  return (
    <Card title={t('set.rules')}>
      {owner ? null : <p className="text-sm font-medium leading-5 text-ink">{t('set.ownerOnly')}</p>}
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <SelectField
          id={`${ids}-conf`}
          label={t('set.confirmations')}
          help={t('set.confirmationsHelp')}
          value={confirmations}
          onChange={setConfirmations}
          disabled={!owner}
          options={[
            {value: '0', label: t('set.off')},
            {value: '1', label: t('set.on')},
          ]}
        />
        <Button
          variant="secondary"
          disabled={!owner || busy}
          onClick={() => void save('confirmed_bookings_enabled', confirmations)}
        >
          {t('staff.save')}
        </Button>
      </div>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <SelectField
          id={`${ids}-contact`}
          label={t('set.contact')}
          value={contact}
          onChange={setContact}
          disabled={!owner}
          options={[
            ...(contact ? [] : [{value: '', label: t('set.contact.unset')}]),
            {value: 'phone', label: t('set.contact.phone')},
            {value: 'email', label: t('set.contact.email')},
            {value: 'either', label: t('set.contact.either')},
          ]}
        />
        <Button
          variant="secondary"
          disabled={!owner || busy || !contact}
          onClick={() => void save('required_contact', contact)}
        >
          {t('staff.save')}
        </Button>
      </div>
      <div className="space-y-3 border-t border-border/70 pt-4">
        <h3 className="text-sm font-semibold leading-5 text-ink">{t('set.exception')}</h3>
        <TextField
          id={`${ids}-ptext`}
          label={t('set.exceptionText')}
          value={processText}
          onChange={setProcessText}
          multiline
          maxLength={1000}
          disabled={!owner}
        />
        <CheckField
          id={`${ids}-papproved`}
          label={t('set.exceptionApproved')}
          checked={processApproved}
          onChange={setProcessApproved}
          disabled={!owner}
        />
        <Button
          variant="secondary"
          disabled={!owner || busy}
          onClick={async () => {
            await save('exception_process_text', processText.trim());
            await save('exception_process_approved', processApproved ? '1' : '0');
          }}
        >
          {t('staff.save')}
        </Button>
      </div>
    </Card>
  );
}

function VenueEditor({row, onDone, setNotice}: {row: Row | null; onDone: () => void; setNotice: (n: Notice) => void}) {
  const {t} = useStaffT();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setForm] = useState({
    name: str(row?.name),
    address: str(row?.address),
    instructions: str(row?.instructions),
    approved: Boolean(row?.approved),
    allowOverlap: Boolean(row?.allow_overlap),
  });
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(row ? `/api/equipo/venues/${row.id}` : '/api/equipo/venues', {
      expectedVersion: row ? row.version : null,
      fields: {
        name: form.name.trim(),
        address: orNull(form.address),
        instructions: orNull(form.instructions),
        approved: form.approved,
        allowOverlap: form.allowOverlap,
      },
    });
    setNotice(outcome(result, t('venue.saved')));
    if (result.kind === 'ok') onDone();
  };
  return (
    <form onSubmit={save} noValidate className="space-y-4 rounded-2xl border border-stone-300 p-4">
      <TextField
        id={`${ids}-name`}
        label={t('venue.name')}
        value={form.name}
        onChange={v => set({name: v})}
        maxLength={120}
      />
      <TextField
        id={`${ids}-address`}
        label={t('venue.address')}
        value={form.address}
        onChange={v => set({address: v})}
        maxLength={240}
      />
      <TextField
        id={`${ids}-instr`}
        label={t('venue.instructions')}
        value={form.instructions}
        onChange={v => set({instructions: v})}
        multiline
        maxLength={400}
      />
      <CheckField
        id={`${ids}-approved`}
        label={t('venue.approved')}
        checked={form.approved}
        onChange={v => set({approved: v})}
      />
      <CheckField
        id={`${ids}-overlap`}
        label={t('venue.overlap')}
        checked={form.allowOverlap}
        onChange={v => set({allowOverlap: v})}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy || form.name.trim().length < 2}>
          {busy ? t('flow.sending') : t('venue.save')}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t('staff.cancelAction')}
        </Button>
      </div>
    </form>
  );
}

const dateField = (ms: unknown) => (typeof ms === 'number' ? toPrLocalFields(ms).date : '');

function PolicyEditor({row, onDone, setNotice}: {row: Row | null; onDone: () => void; setNotice: (n: Notice) => void}) {
  const {t} = useStaffT();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setForm] = useState({
    title: str(row?.title),
    textEs: str(row?.text_es),
    textEn: str(row?.text_en),
    sourceUrl: str(row?.source_url),
    sourceNote: str(row?.source_note),
    publicAnnouncement: Boolean(row?.public_announcement),
    appliesTo: str(row?.applies_to),
    effectiveFrom: dateField(row?.effective_from),
    effectiveUntil: dateField(row?.effective_until),
    fullPayment: row?.full_payment === null || row?.full_payment === undefined ? '' : String(row.full_payment),
    refundPercent: typeof row?.refund_fraction_bp === 'number' ? String(row.refund_fraction_bp / 100) : '',
    cutoffRule: str(row?.cutoff_rule),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    const from = form.effectiveFrom ? parsePrLocal(form.effectiveFrom, '00:00') : null;
    const until = form.effectiveUntil ? parsePrLocal(form.effectiveUntil, '00:00') : null;
    if (form.effectiveFrom && from === null) found.effectiveFrom = t('pol.invalidDate');
    if (form.effectiveUntil && until === null) found.effectiveUntil = t('pol.invalidDate');
    const percent = form.refundPercent.trim() ? Number(form.refundPercent.replace(',', '.')) : null;
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100))
      found.refundPercent = t('pol.invalidPercent');
    if (form.title.trim().length < 2 || form.textEs.trim().length < 2) found.title = t('reason.invalid');
    setErrors(found);
    if (Object.keys(found).length) return;
    const result = await run(row ? `/api/equipo/policies/${row.id}` : '/api/equipo/policies', {
      expectedVersion: row ? row.version : null,
      fields: {
        title: form.title.trim(),
        textEs: form.textEs.trim(),
        textEn: orNull(form.textEn),
        sourceUrl: orNull(form.sourceUrl),
        sourceNote: orNull(form.sourceNote),
        publicAnnouncement: form.publicAnnouncement,
        appliesTo: form.appliesTo || null,
        effectiveFrom: from,
        effectiveUntil: until,
        fullPayment: form.fullPayment === '' ? null : form.fullPayment === '1',
        refundFractionBp: percent === null ? null : Math.round(percent * 100),
        cutoffRule: orNull(form.cutoffRule),
      },
    });
    setNotice(outcome(result, t('pol.saved')));
    if (result.kind === 'ok') onDone();
  };
  const id = (name: string) => `${ids}-${name}`;
  return (
    <form onSubmit={save} noValidate className="space-y-4 rounded-2xl border border-stone-300 p-4">
      <TextField
        id={id('title')}
        label={t('pol.name')}
        value={form.title}
        onChange={v => set({title: v})}
        error={errors.title}
        maxLength={120}
      />
      <TextField
        id={id('es')}
        label={t('pol.textEs')}
        value={form.textEs}
        onChange={v => set({textEs: v})}
        multiline
        maxLength={4000}
      />
      <TextField
        id={id('en')}
        label={t('pol.textEn')}
        value={form.textEn}
        onChange={v => set({textEn: v})}
        multiline
        maxLength={4000}
      />
      <TextField
        id={id('src')}
        label={t('pol.source')}
        type="url"
        value={form.sourceUrl}
        onChange={v => set({sourceUrl: v})}
        maxLength={400}
      />
      <TextField
        id={id('srcn')}
        label={t('pol.sourceNote')}
        value={form.sourceNote}
        onChange={v => set({sourceNote: v})}
        maxLength={400}
      />
      <CheckField
        id={id('ann')}
        label={t('pol.announce')}
        checked={form.publicAnnouncement}
        onChange={v => set({publicAnnouncement: v})}
      />
      <SelectField
        id={id('applies')}
        label={t('pol.appliesTo')}
        value={form.appliesTo}
        onChange={v => set({appliesTo: v})}
        options={[
          {value: '', label: t('pol.applies.unset')},
          {value: 'booking_time', label: t('pol.applies.booking_time')},
          {value: 'session_time', label: t('pol.applies.session_time')},
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={id('from')}
          type="date"
          label={t('pol.from')}
          value={form.effectiveFrom}
          onChange={v => set({effectiveFrom: v})}
          error={errors.effectiveFrom}
        />
        <TextField
          id={id('until')}
          type="date"
          label={t('pol.until')}
          value={form.effectiveUntil}
          onChange={v => set({effectiveUntil: v})}
          error={errors.effectiveUntil}
        />
        <SelectField
          id={id('full')}
          label={t('pol.fullPayment')}
          value={form.fullPayment}
          onChange={v => set({fullPayment: v})}
          options={[
            {value: '', label: t('pol.unknown')},
            {value: '1', label: t('pol.yes')},
            {value: '0', label: t('pol.no')},
          ]}
        />
        <TextField
          id={id('refund')}
          label={t('pol.refund')}
          inputMode="decimal"
          value={form.refundPercent}
          onChange={v => set({refundPercent: v})}
          error={errors.refundPercent}
        />
      </div>
      <TextField
        id={id('cutoff')}
        label={t('pol.cutoff')}
        value={form.cutoffRule}
        onChange={v => set({cutoffRule: v})}
        maxLength={400}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? t('flow.sending') : t('pol.save')}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t('staff.cancelAction')}
        </Button>
      </div>
    </form>
  );
}

function PolicyState({row, onChanged, setNotice}: {row: Row; onChanged: () => void; setNotice: (n: Notice) => void}) {
  const {t} = useStaffT();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const change = async (to: 'approved' | 'retired') => {
    const result = await run(`/api/equipo/policies/${row.id}/state`, {expectedVersion: row.version, to});
    setNotice(outcome(result, t('ses.stateDone')));
    onChanged();
  };
  if (row.state === 'draft') {
    return (
      <Confirm
        variant="primary"
        trigger={t('pol.approve')}
        title={t('pol.approve')}
        body={t('pol.approveBody')}
        confirmLabel={t('pol.approve')}
        disabled={busy}
        onConfirm={() => change('approved')}
      />
    );
  }
  if (row.state === 'approved') {
    return (
      <Confirm
        trigger={t('pol.retire')}
        title={t('pol.retire')}
        body={t('pol.retireBody')}
        confirmLabel={t('pol.retire')}
        disabled={busy}
        onConfirm={() => change('retired')}
      />
    );
  }
  return null;
}

function TeamEditor({row, onDone, setNotice}: {row: Row | null; onDone: () => void; setNotice: (n: Notice) => void}) {
  const {t} = useStaffT();
  const ids = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [email, setEmail] = useState(str(row?.email));
  const [role, setRole] = useState<'owner' | 'staff'>((str(row?.role) || 'staff') as 'owner' | 'staff');
  const [active, setActive] = useState(row ? Boolean(row.active) : true);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run('/api/equipo/staff', {email: email.trim().toLowerCase(), role, active});
    setNotice(outcome(result, t('team.saved')));
    if (result.kind === 'ok') onDone();
  };
  return (
    <form onSubmit={save} noValidate className="space-y-4 rounded-2xl border border-stone-300 p-4">
      <TextField
        id={`${ids}-email`}
        type="email"
        label={t('team.email')}
        value={email}
        onChange={setEmail}
        disabled={Boolean(row)}
        maxLength={120}
      />
      <SelectField
        id={`${ids}-role`}
        label={t('team.role')}
        value={role}
        onChange={setRole}
        options={[
          {value: 'staff', label: t('role.staff')},
          {value: 'owner', label: t('role.owner')},
        ]}
      />
      <CheckField id={`${ids}-active`} label={t('team.active')} checked={active} onChange={setActive} />
      <p className={helper}>{t('team.removeHelp')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy || !email.includes('@')}>
          {busy ? t('flow.sending') : t('team.save')}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t('staff.cancelAction')}
        </Button>
      </div>
    </form>
  );
}

export function Settings() {
  const {t, lang} = useStaffT();
  const me = useMe();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<Catalog>('/api/equipo/catalog');
  const owner = me.role === 'owner';
  const refresh = () => void reload(true);
  return (
    <>
      <PageHeading>{t('set.title')}</PageHeading>
      <div className="max-w-3xl space-y-4">
        <NoticeLine notice={notice} />
        <Card title={t('set.fixed')}>
          <ul className="space-y-1 text-base leading-6 text-ink">
            <li>{t('set.tz')}</li>
            <li>{t('set.currency')}</li>
            <li>{t('set.sender')}</li>
          </ul>
        </Card>
        <QueryView query={query} onRetry={() => void reload()}>
          {data => (
            <>
              <RuleSettings
                key={data.settings.map(s => `${s.key}:${s.updated_at}`).join('|')}
                catalog={data}
                onSaved={refresh}
                setNotice={setNotice}
              />
              <Card title={t('venue.title')}>
                {owner ? null : <p className="text-sm font-medium leading-5 text-ink">{t('set.ownerOnly')}</p>}
                <Editable
                  rows={data.venues as Row[]}
                  newLabel={t('venue.new')}
                  canCreate={owner}
                  render={row => (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium leading-6 text-ink">{str(row.name)}</span>
                      <Pill strong={Boolean(row.approved)}>{row.approved ? t('venue.ok') : t('venue.pending')}</Pill>
                      <Demo synthetic={row.synthetic} />
                    </div>
                  )}
                  editor={(row, close) => (
                    <VenueEditor
                      key={row ? `${row.id}:${row.version}` : 'new'}
                      row={row}
                      setNotice={setNotice}
                      onDone={() => {
                        close();
                        refresh();
                      }}
                    />
                  )}
                />
              </Card>
              <Card title={t('pol.title')}>
                {owner ? null : <p className="text-sm font-medium leading-5 text-ink">{t('set.ownerOnly')}</p>}
                <Editable
                  rows={data.policies as Row[]}
                  newLabel={t('pol.new')}
                  canCreate={owner}
                  render={row => (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-medium leading-6 text-ink">{str(row.title)}</span>
                        <Pill strong={row.state === 'approved'}>{t(`pol.state.${row.state}`)}</Pill>
                        <Demo synthetic={row.synthetic} />
                      </div>
                      {typeof row.approved_at === 'number' ? (
                        <p className={helper}>
                          {t('pol.approvedBy', {
                            who: str(row.approved_by),
                            date: formatLongDate(row.approved_at, lang),
                          })}
                        </p>
                      ) : null}
                      {owner ? <PolicyState row={row} onChanged={refresh} setNotice={setNotice} /> : null}
                    </div>
                  )}
                  editor={(row, close) =>
                    row && row.state !== 'draft' ? (
                      <p className="text-sm leading-5 text-ink">{t('reason.policy_not_draft')}</p>
                    ) : (
                      <PolicyEditor
                        key={row ? `${row.id}:${row.version}` : 'new'}
                        row={row}
                        setNotice={setNotice}
                        onDone={() => {
                          close();
                          refresh();
                        }}
                      />
                    )
                  }
                />
              </Card>
              {owner ? (
                <Card title={t('team.title')}>
                  <Editable
                    rows={data.staff as unknown as Row[]}
                    newLabel={t('team.add')}
                    render={row => (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base leading-6 text-ink">{str(row.email)}</span>
                        <Pill>{t(`role.${row.role}`)}</Pill>
                        <Pill strong={!row.active}>{row.active ? t('team.active') : t('team.inactive')}</Pill>
                      </div>
                    )}
                    editor={(row, close) => (
                      <TeamEditor
                        key={row ? `${row.email}:${row.version}` : 'new'}
                        row={row}
                        setNotice={setNotice}
                        onDone={() => {
                          close();
                          refresh();
                        }}
                      />
                    )}
                  />
                </Card>
              ) : null}
              {owner && me.demo ? (
                <Card title={t('reset.title')}>
                  <p className="text-base leading-6 text-ink">{t('reset.body')}</p>
                  <p className="text-base leading-6 text-ink">{t('reset.keeps')}</p>
                  <Confirm
                    trigger={t('reset.title')}
                    title={t('reset.title')}
                    body={
                      <>
                        <p>{t('reset.body')}</p>
                        <p className="mt-2">{t('reset.keeps')}</p>
                      </>
                    }
                    confirmLabel={t('reset.confirm')}
                    disabled={busy}
                    onConfirm={async () => {
                      const result = await run('/api/equipo/demo/reset', {});
                      setNotice(outcome(result, t('reset.done')));
                      refresh();
                    }}
                  />
                </Card>
              ) : null}
            </>
          )}
        </QueryView>
      </div>
    </>
  );
}
