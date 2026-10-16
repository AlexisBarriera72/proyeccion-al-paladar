// Staff: experiences, and Configuración (rules, places, terms, team, demo reset) as tabs synced
// to ?tab=. Editors open in sheets and dialogs so the lists stay put. Owner-only changes are
// refused by the server for other roles; their controls stay visible but disabled.
import {useId, useState, type FormEvent, type ReactNode} from 'react';
import {Tabs} from 'radix-ui';
import {motion} from 'motion/react';
import {Archive, CircleCheck, Eye, Lock, PencilLine, Pencil, Plus, RotateCcw} from 'lucide-react';
import {formatLongDate, parsePrLocal, toPrLocalFields} from '../../shared/time.ts';
import {navigate, useLocation} from '../lib/router.tsx';
import {useMediaQuery} from '../lib/media.ts';
import {helper, rows, sectionTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button} from '../components/ui/button.tsx';
import {Choices} from '../components/ui/choice.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {useQuery, useWrite} from './api.ts';
import {
  Callout,
  CheckField,
  Confirm,
  Demo,
  Empty,
  Facts,
  FormFooter,
  NoticeLine,
  Page,
  PageHeader,
  Panel,
  Pill,
  QueryView,
  SelectField,
  StatusPill,
  TextField,
  fieldClass,
  flushList,
  rowItem,
  useOnOpen,
  useOutcome,
  useStaffT,
  type Notice,
} from './ui.tsx';
import {useMe} from './me.ts';
import type {Catalog} from './types.ts';

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const orNull = (text: string) => (text.trim() ? text.trim() : null);

/** "Editar" with the record's name for screen readers, so row buttons can be told apart. */
function Named({label, name}: {label: string; name: string}) {
  return (
    <>
      {label}
      <span className="sr-only"> {name}</span>
    </>
  );
}

const tabTrigger =
  'inline-flex min-h-11 items-center rounded-2xl border border-stone-400 bg-surface px-4 text-sm font-medium leading-5 text-ink hover:bg-stone-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-white';

// ------------------------------------------------------------------ experiences

const PHOTO_KEYS: Record<string, string> = {
  room: 'exp.photo.room',
  'table-food': 'exp.photo.table-food',
  food: 'exp.photo.food',
};

function ExperienceStatus({status}: {status: string}) {
  const {t} = useStaffT();
  const [icon, tone] =
    status === 'approved'
      ? ([CircleCheck, 'normal'] as const)
      : status === 'archived'
        ? ([Archive, 'ended'] as const)
        : ([PencilLine, 'normal'] as const);
  return (
    <StatusPill icon={icon} tone={tone}>
      {t(`exp.status.${status}`)}
    </StatusPill>
  );
}

const blankExperience = (row: Row | null) => ({
  titleEs: str(row?.title_es),
  titleEn: str(row?.title_en),
  descriptionEs: str(row?.description_es),
  descriptionEn: str(row?.description_en),
  inclusionsEs: str(row?.inclusions_es),
  inclusionsEn: str(row?.inclusions_en),
  photoSlot: str(row?.photo_slot),
  status: (str(row?.status) || 'draft') as 'draft' | 'approved' | 'archived',
});

/** "Editar experiencia" or "Nueva experiencia": Spanish and English fields under two tabs. */
function ExperienceSheet({
  open,
  onOpenChange,
  row,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Row | null;
  onSaved: (notice: Notice) => void;
}) {
  const {t} = useStaffT();
  const me = useMe();
  const ids = useId();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setForm] = useState(() => blankExperience(row));
  const [language, setLanguage] = useState('es');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  useOnOpen(open, () => {
    setForm(blankExperience(row));
    setLanguage('es');
    setError(null);
    setNotice(null);
  });
  const set = (patch: Partial<typeof form>) => setForm(current => ({...current, ...patch}));
  const id = (name: string) => `${ids}-${name}`;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (form.titleEs.trim().length < 2) {
      setError(t('reason.invalid'));
      setLanguage('es');
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
    if (result.kind !== 'ok') {
      setNotice(outcome(result, ''));
      return;
    }
    onOpenChange(false);
    onSaved({tone: 'ok', text: t('exp.saved')});
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="sheet"
      size="wide"
      title={row ? t('exp.edit') : t('exp.new')}
      closeLabel={t('staff.close')}
      footer={
        <div>
          <NoticeLine notice={notice} className="mb-3" />
          <FormFooter formId={formId} label={t('exp.save')} busy={busy} onCancel={() => onOpenChange(false)} />
        </div>
      }
    >
      <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-6">
        <Tabs.Root value={language} onValueChange={setLanguage} className="flex flex-col gap-4">
          <Tabs.List aria-label={t('exp.lang')} className="flex flex-wrap gap-2">
            <Tabs.Trigger value="es" className={tabTrigger}>
              {t('exp.tabEs')}
            </Tabs.Trigger>
            <Tabs.Trigger value="en" className={tabTrigger}>
              {t('exp.tabEn')}
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="es" className="flex flex-col gap-4 focus-visible:outline-none">
            <TextField
              id={id('tes')}
              label={t('exp.titleEs')}
              value={form.titleEs}
              onChange={v => set({titleEs: v})}
              error={error}
              maxLength={120}
            />
            <TextField
              id={id('des')}
              label={t('exp.descEs')}
              value={form.descriptionEs}
              onChange={v => set({descriptionEs: v})}
              multiline
              maxLength={600}
              counter
            />
            <TextField
              id={id('ies')}
              label={t('exp.inclEs')}
              value={form.inclusionsEs}
              onChange={v => set({inclusionsEs: v})}
              multiline
              maxLength={800}
            />
          </Tabs.Content>
          <Tabs.Content value="en" className="flex flex-col gap-4 focus-visible:outline-none">
            <TextField
              id={id('ten')}
              label={t('exp.titleEn')}
              value={form.titleEn}
              onChange={v => set({titleEn: v})}
              maxLength={120}
            />
            <TextField
              id={id('den')}
              label={t('exp.descEn')}
              value={form.descriptionEn}
              onChange={v => set({descriptionEn: v})}
              multiline
              maxLength={600}
              counter
            />
            <TextField
              id={id('ien')}
              label={t('exp.inclEn')}
              value={form.inclusionsEn}
              onChange={v => set({inclusionsEn: v})}
              multiline
              maxLength={800}
            />
          </Tabs.Content>
        </Tabs.Root>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
          <p id={id('photo')} className="text-sm font-medium leading-5 text-ink">
            {t('exp.photo')}
          </p>
          <Choices
            name={id('photo-slot')}
            label={t('exp.photo')}
            value={form.photoSlot || 'none'}
            onChange={v => set({photoSlot: v === 'none' ? '' : v})}
            options={[
              {value: 'none', label: t('exp.noPhoto')},
              {value: 'room', label: t('exp.photo.room')},
              {value: 'table-food', label: t('exp.photo.table-food')},
              {value: 'food', label: t('exp.photo.food')},
            ]}
          />
        </div>
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
      </form>
    </Dialog>
  );
}

export function Experiences() {
  const {t} = useStaffT();
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const {query, reload} = useQuery<Catalog>('/api/equipo/catalog');
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title={t('exp.title')}
        primary={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            {t('exp.new')}
          </Button>
        }
      />
      <NoticeLine notice={notice} />
      <QueryView query={query} onRetry={() => void reload()}>
        {data => (
          <Panel flush>
            {data.experiences.length ? (
              <ul className={rows}>
                {(data.experiences as Row[]).map(row => (
                  <li key={str(row.id)} className={cn(rowItem, 'flex items-center justify-between gap-3')}>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="break-words text-base font-medium leading-6 text-ink">{str(row.title_es)}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Demo synthetic={row.synthetic} />
                        <ExperienceStatus status={str(row.status)} />
                        <span className={helper}>
                          {PHOTO_KEYS[str(row.photo_slot)]
                            ? t('exp.photoNamed', {name: t(PHOTO_KEYS[str(row.photo_slot)])})
                            : t('exp.noPhoto')}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" className="shrink-0" onClick={() => setEditing(row)}>
                      <Pencil aria-hidden="true" />
                      <Named label={t('staff.edit')} name={str(row.title_es)} />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty flush>{t('exp.empty')}</Empty>
            )}
          </Panel>
        )}
      </QueryView>
      <ExperienceSheet
        open={editing !== null}
        onOpenChange={open => {
          if (!open) setEditing(null);
        }}
        row={editing === 'new' ? null : editing}
        onSaved={next => {
          setNotice(next);
          void reload(true);
        }}
      />
    </Page>
  );
}

// ------------------------------------------------------------------ settings: rules

/** One setting on one row: its select and its own "Guardar", the help text under both. */
function SettingRow({
  id,
  label,
  help,
  value,
  onChange,
  options,
  disabled,
  saveDisabled,
  onSave,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  options: {value: string; label: string}[];
  disabled: boolean;
  saveDisabled: boolean;
  onSave: () => void;
}) {
  const {t} = useStaffT();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium leading-5 text-ink">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={help ? `${id}-help` : undefined}
          onChange={event => onChange(event.target.value)}
          // Wide enough for its longest option; on a narrow phone "Guardar" moves under it.
          className={cn(fieldClass, 'w-auto min-w-0 flex-1 basis-56 disabled:bg-stone-100')}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" disabled={saveDisabled} onClick={onSave}>
          <Named label={t('staff.save')} name={label} />
        </Button>
      </div>
      {help ? (
        <p id={`${id}-help`} className={helper}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

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
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${ids}-fixed`} className="flex flex-col gap-2 rounded-2xl bg-stone-100 p-4">
        <h2 id={`${ids}-fixed`} className={sectionTitle}>
          {t('set.fixed')}
        </h2>
        <ul className="flex flex-col gap-1 text-sm leading-5 text-ink">
          <li>{t('set.tz')}</li>
          <li>{t('set.currency')}</li>
          <li>{t('set.sender')}</li>
        </ul>
      </section>
      <Panel title={t('set.rules')}>
        <SettingRow
          id={`${ids}-conf`}
          label={t('set.confirmations')}
          help={t('set.confirmationsHelp')}
          value={confirmations}
          onChange={setConfirmations}
          disabled={!owner}
          saveDisabled={!owner || busy}
          onSave={() => void save('confirmed_bookings_enabled', confirmations)}
          options={[
            {value: '0', label: t('set.off')},
            {value: '1', label: t('set.on')},
          ]}
        />
        <SettingRow
          id={`${ids}-contact`}
          label={t('set.contact')}
          value={contact}
          onChange={setContact}
          disabled={!owner}
          saveDisabled={!owner || busy || !contact}
          onSave={() => void save('required_contact', contact)}
          options={[
            ...(contact ? [] : [{value: '', label: t('set.contact.unset')}]),
            {value: 'phone', label: t('set.contact.phone')},
            {value: 'email', label: t('set.contact.email')},
            {value: 'either', label: t('set.contact.either')},
          ]}
        />
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
          <h3 className={sectionTitle}>{t('set.exception')}</h3>
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
            className="self-start"
            disabled={!owner || busy}
            onClick={async () => {
              await save('exception_process_text', processText.trim());
              await save('exception_process_approved', processApproved ? '1' : '0');
            }}
          >
            <Named label={t('staff.save')} name={t('set.exception')} />
          </Button>
        </div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ settings: places

const blankVenue = (row: Row | null) => ({
  name: str(row?.name),
  address: str(row?.address),
  instructions: str(row?.instructions),
  approved: Boolean(row?.approved),
  allowOverlap: Boolean(row?.allow_overlap),
});

function VenueSheet({
  open,
  onOpenChange,
  row,
  setNotice,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Row | null;
  setNotice: (n: Notice) => void;
  onSaved: () => void;
}) {
  const {t} = useStaffT();
  const ids = useId();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setForm] = useState(() => blankVenue(row));
  const [problem, setProblem] = useState<Notice>(null);
  useOnOpen(open, () => {
    setForm(blankVenue(row));
    setProblem(null);
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
    if (result.kind !== 'ok') {
      setProblem(outcome(result, ''));
      return;
    }
    onOpenChange(false);
    setNotice(outcome(result, t('venue.saved')));
    onSaved();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="sheet"
      size="wide"
      title={row ? t('venue.edit') : t('venue.new')}
      closeLabel={t('staff.close')}
      footer={
        <div>
          <NoticeLine notice={problem} className="mb-3" />
          <FormFooter
            formId={formId}
            label={t('venue.save')}
            busy={busy}
            disabled={form.name.trim().length < 2}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      }
    >
      <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
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
          counter
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
      </form>
    </Dialog>
  );
}

function Places({
  catalog,
  setNotice,
  refresh,
}: {
  catalog: Catalog;
  setNotice: (n: Notice) => void;
  refresh: () => void;
}) {
  const {t} = useStaffT();
  const owner = useMe().role === 'owner';
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  return (
    <Panel
      flush
      title={t('venue.title')}
      actions={
        <Button variant="secondary" disabled={!owner} onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          {t('venue.new')}
        </Button>
      }
    >
      {catalog.venues.length ? (
        <ul className={flushList}>
          {(catalog.venues as Row[]).map(row => (
            <li key={str(row.id)} className={cn(rowItem, 'flex items-center justify-between gap-3')}>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="break-words text-base font-medium leading-6 text-ink">{str(row.name)}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Demo synthetic={row.synthetic} />
                  <Pill strong={Boolean(row.approved)}>{row.approved ? t('venue.ok') : t('venue.pending')}</Pill>
                </div>
              </div>
              <Button variant="ghost" className="shrink-0" disabled={!owner} onClick={() => setEditing(row)}>
                <Pencil aria-hidden="true" />
                <Named label={t('staff.edit')} name={str(row.name)} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty flush>{t('venue.none')}</Empty>
      )}
      <VenueSheet
        open={editing !== null}
        onOpenChange={open => {
          if (!open) setEditing(null);
        }}
        row={editing === 'new' ? null : editing}
        setNotice={setNotice}
        onSaved={refresh}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------ settings: terms

const dateField = (ms: unknown) => (typeof ms === 'number' ? toPrLocalFields(ms).date : '');

const blankPolicy = (row: Row | null) => ({
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

/** "Editar condiciones" or "Nuevas condiciones": drafts only. */
function PolicySheet({
  open,
  onOpenChange,
  row,
  setNotice,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Row | null;
  setNotice: (n: Notice) => void;
  onSaved: () => void;
}) {
  const {t} = useStaffT();
  const ids = useId();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [form, setForm] = useState(() => blankPolicy(row));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<Notice>(null);
  useOnOpen(open, () => {
    setForm(blankPolicy(row));
    setErrors({});
    setProblem(null);
  });
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
    if (result.kind !== 'ok') {
      setProblem(outcome(result, ''));
      return;
    }
    onOpenChange(false);
    setNotice(outcome(result, t('pol.saved')));
    onSaved();
  };
  const id = (name: string) => `${ids}-${name}`;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="sheet"
      size="wide"
      title={row ? t('pol.edit') : t('pol.new')}
      closeLabel={t('staff.close')}
      footer={
        <div>
          <NoticeLine notice={problem} className="mb-3" />
          <FormFooter formId={formId} label={t('pol.save')} busy={busy} onCancel={() => onOpenChange(false)} />
        </div>
      }
    >
      <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
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
        <div className="grid grid-cols-1 gap-4 min-[22rem]:grid-cols-2">
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
      </form>
    </Dialog>
  );
}

/** Approved or retired terms (and drafts, for the Equipo role): the exact text, read only. */
function PolicyView({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Row | null;
}) {
  const {t, lang} = useStaffT();
  const date = (ms: unknown) => (typeof ms === 'number' ? formatLongDate(ms, lang) : t('pol.unknown'));
  const applies =
    row?.applies_to === 'booking_time'
      ? t('pol.applies.booking_time')
      : row?.applies_to === 'session_time'
        ? t('pol.applies.session_time')
        : t('pol.applies.unset');
  const full = row?.full_payment === 1 ? t('pol.yes') : row?.full_payment === 0 ? t('pol.no') : t('pol.unknown');
  const items: [string, ReactNode][] = row
    ? [
        [t('pol.stateLabel'), t(`pol.state.${str(row.state)}`)],
        [t('pol.textEs'), <span className="whitespace-pre-line">{str(row.text_es)}</span>],
        [
          t('pol.textEn'),
          row.text_en ? <span className="whitespace-pre-line">{str(row.text_en)}</span> : t('ses.notSet'),
        ],
        [
          t('pol.source'),
          row.source_url ? (
            <a
              href={str(row.source_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent underline underline-offset-4 hover:text-accent-hover"
            >
              {str(row.source_url)}
            </a>
          ) : (
            t('ses.notSet')
          ),
        ],
        [t('pol.sourceNote'), row.source_note ? str(row.source_note) : t('ses.notSet')],
        [t('pol.appliesTo'), applies],
        [t('pol.from'), date(row.effective_from)],
        [t('pol.until'), date(row.effective_until)],
        [t('pol.fullPayment'), full],
        [
          t('pol.refund'),
          typeof row.refund_fraction_bp === 'number' ? String(row.refund_fraction_bp / 100) : t('pol.unknown'),
        ],
        [t('pol.cutoff'), row.cutoff_rule ? str(row.cutoff_rule) : t('pol.unknown')],
      ]
    : [];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="sheet"
      size="wide"
      title={row ? str(row.title) : t('pol.title')}
      description={t('pol.readOnly')}
      closeLabel={t('staff.close')}
    >
      <div className="flex flex-col gap-4">
        <Facts columns={1} items={items} />
        {row && typeof row.approved_at === 'number' ? (
          <p className={helper}>
            {t('pol.approvedBy', {who: str(row.approved_by), date: formatLongDate(row.approved_at, lang)})}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function PolicyState({row, onChanged, setNotice}: {row: Row; onChanged: () => void; setNotice: (n: Notice) => void}) {
  const {t} = useStaffT();
  const owner = useMe().role === 'owner';
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const name = str(row.title);
  const change = async (to: 'approved' | 'retired') => {
    const result = await run(`/api/equipo/policies/${row.id}/state`, {expectedVersion: row.version, to});
    setNotice(outcome(result, t('ses.stateDone')));
    onChanged();
  };
  if (row.state === 'draft') {
    return (
      <Confirm
        variant="primary"
        trigger={<Named label={t('pol.approve')} name={name} />}
        title={t('pol.approve')}
        body={t('pol.approveBody')}
        confirmLabel={t('pol.approve')}
        disabled={!owner || busy}
        onConfirm={() => change('approved')}
      />
    );
  }
  if (row.state === 'approved') {
    return (
      <Confirm
        trigger={<Named label={t('pol.retire')} name={name} />}
        title={t('pol.retire')}
        body={t('pol.retireBody')}
        confirmLabel={t('pol.retire')}
        disabled={!owner || busy}
        onConfirm={() => change('retired')}
      />
    );
  }
  return null;
}

function Terms({catalog, setNotice, refresh}: {catalog: Catalog; setNotice: (n: Notice) => void; refresh: () => void}) {
  const {t, lang} = useStaffT();
  const owner = useMe().role === 'owner';
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  return (
    <Panel
      flush
      title={t('pol.title')}
      actions={
        <Button variant="secondary" disabled={!owner} onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          {t('pol.new')}
        </Button>
      }
    >
      {catalog.policies.length ? (
        <ul className={flushList}>
          {(catalog.policies as Row[]).map(row => {
            const editable = owner && row.state === 'draft';
            return (
              <li
                key={str(row.id)}
                className={cn(rowItem, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="break-words text-base font-medium leading-6 text-ink">{str(row.title)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Demo synthetic={row.synthetic} />
                    <Pill strong={row.state === 'approved'}>{t(`pol.state.${str(row.state)}`)}</Pill>
                  </div>
                  {typeof row.approved_at === 'number' ? (
                    <p className={helper}>
                      {t('pol.approvedBy', {who: str(row.approved_by), date: formatLongDate(row.approved_at, lang)})}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <PolicyState row={row} onChanged={refresh} setNotice={setNotice} />
                  {editable ? (
                    <Button variant="ghost" onClick={() => setEditing(row)}>
                      <Pencil aria-hidden="true" />
                      <Named label={t('staff.edit')} name={str(row.title)} />
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setViewing(row)}>
                      <Eye aria-hidden="true" />
                      <Named label={t('pol.view')} name={str(row.title)} />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty flush>{t('pol.none')}</Empty>
      )}
      <PolicySheet
        open={editing !== null}
        onOpenChange={open => {
          if (!open) setEditing(null);
        }}
        row={editing === 'new' ? null : editing}
        setNotice={setNotice}
        onSaved={refresh}
      />
      <PolicyView
        open={viewing !== null}
        onOpenChange={open => {
          if (!open) setViewing(null);
        }}
        row={viewing}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------ settings: team

function TeamDialog({
  open,
  onOpenChange,
  row,
  setNotice,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Row | null;
  setNotice: (n: Notice) => void;
  onSaved: () => void;
}) {
  const {t} = useStaffT();
  const ids = useId();
  const formId = useId();
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [email, setEmail] = useState(str(row?.email));
  const [role, setRole] = useState<'owner' | 'staff'>((str(row?.role) || 'staff') as 'owner' | 'staff');
  const [active, setActive] = useState(row ? Boolean(row.active) : true);
  const [problem, setProblem] = useState<Notice>(null);
  useOnOpen(open, () => {
    setEmail(str(row?.email));
    setRole((str(row?.role) || 'staff') as 'owner' | 'staff');
    setActive(row ? Boolean(row.active) : true);
    setProblem(null);
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run('/api/equipo/staff', {email: email.trim().toLowerCase(), role, active});
    if (result.kind !== 'ok') {
      setProblem(outcome(result, ''));
      return;
    }
    onOpenChange(false);
    setNotice(outcome(result, t('team.saved')));
    onSaved();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? t('team.edit') : t('team.add')}
      closeLabel={t('staff.close')}
      footer={
        <div>
          <NoticeLine notice={problem} className="mb-3" />
          <FormFooter
            formId={formId}
            label={t('team.save')}
            busy={busy}
            disabled={!email.includes('@')}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      }
    >
      <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
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
      </form>
    </Dialog>
  );
}

function Team({catalog, setNotice, refresh}: {catalog: Catalog; setNotice: (n: Notice) => void; refresh: () => void}) {
  const {t} = useStaffT();
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  return (
    <Panel
      flush
      title={t('team.title')}
      actions={
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          {t('team.add')}
        </Button>
      }
    >
      <ul className={flushList}>
        {(catalog.staff as unknown as Row[]).map(row => (
          <li key={str(row.email)} className={cn(rowItem, 'flex items-center justify-between gap-3')}>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="break-all text-base leading-6 text-ink">{str(row.email)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{t(`role.${str(row.role)}`)}</Pill>
                <Pill strong={!row.active}>{row.active ? t('team.active') : t('team.inactive')}</Pill>
              </div>
            </div>
            <Button variant="ghost" className="shrink-0" onClick={() => setEditing(row)}>
              <Pencil aria-hidden="true" />
              <Named label={t('staff.edit')} name={str(row.email)} />
            </Button>
          </li>
        ))}
      </ul>
      <TeamDialog
        open={editing !== null}
        onOpenChange={open => {
          if (!open) setEditing(null);
        }}
        row={editing === 'new' ? null : editing}
        setNotice={setNotice}
        onSaved={refresh}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------ Configuración

const TABS: [string, string][] = [
  ['reglas', 'set.tab.rules'],
  ['lugares', 'set.tab.places'],
  ['condiciones', 'set.tab.terms'],
  ['equipo', 'set.tab.team'],
  ['demostracion', 'set.tab.demo'],
];

export function Settings() {
  const {t} = useStaffT();
  const me = useMe();
  const {search} = useLocation();
  const wide = useMediaQuery('(min-width: 1024px)');
  const outcome = useOutcome();
  const {run, busy} = useWrite();
  const [notice, setNotice] = useState<Notice>(null);
  const {query, reload} = useQuery<Catalog>('/api/equipo/catalog');
  const owner = me.role === 'owner';
  const refresh = () => void reload(true);
  const tabs = TABS.filter(([value]) =>
    value === 'equipo' ? owner : value === 'demostracion' ? owner && me.demo : true,
  );
  const asked = search.get('tab');
  // Reglas is the default tab: Radix Tabs mount only the active panel.
  const tab = asked && tabs.some(([value]) => value === asked) ? asked : 'reglas';
  const choose = (value: string) => {
    setNotice(null);
    navigate(`/equipo/configuracion/?tab=${value}`, {replace: true, scroll: false});
  };
  const panelClass =
    'min-w-0 max-w-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';

  return (
    <Page>
      <PageHeader title={t('set.title')} />
      {owner ? null : (
        <Callout icon={Lock} className="mb-6">
          <p className="font-medium">{t('set.ownerOnly')}</p>
        </Callout>
      )}
      <NoticeLine notice={notice} />
      <QueryView query={query} onRetry={() => void reload()}>
        {data => (
          // Tabs switch at once: panels mounted by a tab change don't replay the page entry.
          <motion.div initial={false} animate="show">
            <Tabs.Root
              value={tab}
              onValueChange={choose}
              orientation={wide ? 'vertical' : 'horizontal'}
              className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8"
            >
              <Tabs.List aria-label={t('set.tabs')} className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                {tabs.map(([value, key]) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    className={cn(
                      tabTrigger,
                      'lg:justify-start lg:data-[state=inactive]:border-transparent lg:data-[state=inactive]:bg-transparent',
                    )}
                  >
                    {t(key)}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value="reglas" className={panelClass}>
                <RuleSettings
                  key={data.settings.map(s => `${s.key}:${s.updated_at}`).join('|')}
                  catalog={data}
                  onSaved={refresh}
                  setNotice={setNotice}
                />
              </Tabs.Content>
              <Tabs.Content value="lugares" className={panelClass}>
                <Places catalog={data} setNotice={setNotice} refresh={refresh} />
              </Tabs.Content>
              <Tabs.Content value="condiciones" className={panelClass}>
                <Terms catalog={data} setNotice={setNotice} refresh={refresh} />
              </Tabs.Content>
              {owner ? (
                <Tabs.Content value="equipo" className={panelClass}>
                  <Team catalog={data} setNotice={setNotice} refresh={refresh} />
                </Tabs.Content>
              ) : null}
              {owner && me.demo ? (
                <Tabs.Content value="demostracion" className={panelClass}>
                  <Panel title={t('reset.title')}>
                    <p className="text-base leading-6 text-ink">{t('reset.body')}</p>
                    <p className="text-base leading-6 text-ink">{t('reset.keeps')}</p>
                    <Confirm
                      className="self-start"
                      trigger={
                        <>
                          <RotateCcw aria-hidden="true" />
                          {t('reset.title')}
                        </>
                      }
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
                  </Panel>
                </Tabs.Content>
              ) : null}
            </Tabs.Root>
          </motion.div>
        )}
      </QueryView>
    </Page>
  );
}
