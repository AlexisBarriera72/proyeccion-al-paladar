// Small pieces the staff views share: copy, states, notices, confirmations, status pills,
// panels, the page header and form fields. Status shows by icon, word and shape, never by color.
import {useEffect, useId, useState, type ReactNode} from 'react';
import {motion} from 'motion/react';
import {
  Archive,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  Globe,
  Hourglass,
  Inbox,
  PencilLine,
  RotateCw,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import type {ApiResult} from '../lib/api.ts';
import {useT} from '../lib/i18n.tsx';
import {useEntry} from '../lib/motion.ts';
import {formatShortDate, formatTime} from '../../shared/time.ts';
import {helper, numbers, pageTitle, panel, rows, sectionTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {STAFF} from './copy.ts';
import type {Query} from './api.ts';
import type {StaffSession} from './types.ts';

export const useStaffT = () => useT(STAFF);

export type Notice = {tone: 'ok' | 'problem'; text: string} | null;

/** The message for a write's answer: the success text, or what failed and why. */
export function useOutcome() {
  const {t} = useStaffT();
  return (result: ApiResult<unknown>, okText: string): Notice => {
    if (result.kind === 'ok') return {tone: 'ok', text: okText};
    if (result.kind === 'lost') return {tone: 'problem', text: t('reason.lost')};
    const key = `reason.${result.code}`;
    const text = t(key);
    return {tone: 'problem', text: text === key ? t('reason.generic', {code: result.code}) : text};
  };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return current;
}

/** Runs `reset` when a sheet or dialog opens, so each opening starts from fresh form state. */
export function useOnOpen(open: boolean, reset: () => void) {
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }
}

/**
 * The page's one live notice. The region is always there (so changes are announced) but has no
 * size of its own: the spacing sits on the message, so an empty notice adds no gap.
 */
export function NoticeLine({notice, className = 'mb-6'}: {notice: Notice; className?: string}) {
  return (
    <div role="status" aria-live="polite">
      {notice ? (
        <p
          className={cn(
            'flex items-start gap-2 rounded-2xl p-3 text-sm leading-5 text-ink',
            notice.tone === 'ok' ? 'border border-stone-400 bg-stone-50' : 'border-2 border-ink bg-surface font-medium',
            className,
          )}
        >
          {notice.tone === 'ok' ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}

/** A page's entry container: the header and the top-level panels enter in turn. */
export function Page({children, className}: {children: ReactNode; className?: string}) {
  const entry = useEntry();
  return (
    <motion.div variants={entry.page} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

/**
 * The page header: back link, the page's one h1, a meta row and an action bar. `primary` sits
 * next to the title (full width on phones), for a page-level create action.
 */
export function PageHeader({
  title,
  back,
  help,
  primary,
  meta,
  actions,
}: {
  title: string;
  back?: ReactNode;
  help?: ReactNode;
  primary?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const entry = useEntry();
  return (
    <motion.div variants={entry.item} className="mb-6 flex flex-col gap-3">
      {back ? <div className="-ml-3">{back}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 tabIndex={-1} className={cn(pageTitle, 'break-words focus:outline-none')}>
            {title}
          </h1>
          {help ? <p className={helper}>{help}</p> : null}
        </div>
        {primary ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{primary}</div>
        ) : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{meta}</div> : null}
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.div>
  );
}

/**
 * A top-level panel (the brief's main panel). Its heading is body size; a count can sit in it and
 * actions align right. `flush` drops the padding so a list's hairlines run edge to edge.
 */
export function Panel({
  title,
  actions,
  children,
  flush,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  const entry = useEntry();
  const id = useId();
  return (
    <motion.section
      variants={entry.item}
      aria-labelledby={title ? id : undefined}
      className={cn(panel, 'flex min-w-0 flex-col gap-4', flush && 'overflow-hidden p-0 sm:p-0', className)}
    >
      {title || actions ? (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-x-3 gap-y-2',
            flush && 'px-4 pt-4 sm:px-6 sm:pt-5',
          )}
        >
          {title ? (
            <h2 id={id} className={sectionTitle}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </div>
      ) : null}
      {children}
    </motion.section>
  );
}

/** A flush list inside a panel: rows divided by hairlines that run edge to edge. */
export const flushList = cn(rows, 'border-t border-border/70');
/** A row that is one link: color and an inset focus outline only, nothing moves. */
export const rowLink =
  'block px-4 py-3 text-ink hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-6';
/** A row with its own buttons (not a link). */
export const rowItem = 'px-4 py-3 sm:px-6';

/** An empty state. Inside a flush panel it carries the panel's padding. */
export function Empty({
  icon: Icon,
  children,
  action,
  flush,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3', flush && 'px-4 pb-4 sm:px-6 sm:pb-6')}>
      <p className="flex items-start gap-2 text-base leading-6 text-ink">
        {Icon ? <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" /> : null}
        {children}
      </p>
      {action}
    </div>
  );
}

/** An inline callout that needs attention: a 2px ink border and an icon, no fill. */
export function Callout({
  icon: Icon = TriangleAlert,
  children,
  className,
  role,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  role?: 'status' | 'note' | 'alert';
}) {
  return (
    <div role={role} className={cn('flex items-start gap-3 rounded-2xl border-2 border-ink bg-surface p-3', className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-5 text-ink">{children}</div>
    </div>
  );
}

export function QueryView<T>({
  query,
  onRetry,
  children,
}: {
  query: Query<T>;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  const {t} = useStaffT();
  if (query.state === 'loading') {
    return (
      <div aria-busy="true" className="h-40 rounded-2xl bg-stone-100">
        <p className="sr-only">{t('app.loading')}</p>
      </div>
    );
  }
  if (query.state === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-stone-400 bg-surface p-4">
        <p className="text-base leading-6 text-ink">
          {query.status === 404
            ? t('reason.not_found')
            : query.status === 403
              ? t('reason.owner_only')
              : t('staff.loadError')}
        </p>
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          {t('app.retry')}
        </Button>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

// ------------------------------------------------------------------ dialogs

/** The buttons under a form in a dialog or sheet: the save action and "No, volver". */
export function FormFooter({
  formId,
  label,
  busy,
  disabled,
  onCancel,
}: {
  formId: string;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onCancel: () => void;
}) {
  const {t} = useStaffT();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="secondary" onClick={onCancel}>
        {t('staff.cancelAction')}
      </Button>
      <Button type="submit" form={formId} variant="primary" disabled={busy || disabled}>
        {busy ? t('flow.sending') : label}
      </Button>
    </div>
  );
}

/** A confirmation that says what will actually happen. Controlled: no button of its own. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  primary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => unknown;
  primary?: boolean;
}) {
  const {t} = useStaffT();
  // The body says what will happen, so the dialog is described by it.
  const bodyId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      closeLabel={t('staff.close')}
      describedBy={bodyId}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('staff.cancelAction')}
          </Button>
          <Button
            variant={primary ? 'primary' : 'quiet'}
            onClick={() => {
              onOpenChange(false);
              void onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div id={bodyId} className="text-base leading-6 text-ink">
        {body}
      </div>
    </Dialog>
  );
}

/** A button that opens a confirmation. */
export function Confirm({
  trigger,
  title,
  body,
  confirmLabel,
  onConfirm,
  disabled,
  variant = 'quiet',
  className,
}: {
  trigger: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => unknown;
  disabled?: boolean;
  variant?: 'quiet' | 'primary' | 'secondary';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled} className={className}>
        {trigger}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        onConfirm={onConfirm}
        primary={variant === 'primary'}
      />
    </>
  );
}

/** An action that needs one more input (a size, a session) before it is sent. Controlled. */
export function InputDialog({
  open,
  onOpenChange,
  label,
  description,
  children,
  canSend,
  busy,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  description?: string;
  children: ReactNode;
  canSend: boolean;
  busy?: boolean;
  /** true closes the dialog; a notice is a refusal, shown here next to the buttons. */
  onSend: () => Promise<boolean | Notice>;
}) {
  const {t} = useStaffT();
  const formId = useId();
  const [problem, setProblem] = useState<Notice>(null);
  useOnOpen(open, () => setProblem(null));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={label}
      description={description}
      closeLabel={t('staff.close')}
      footer={
        <div>
          {/* A refusal sits beside the button, in the footer that doesn't scroll, so it is seen after a send. */}
          <NoticeLine notice={problem} className="mb-3" />
          <FormFooter
            formId={formId}
            label={label}
            busy={busy}
            disabled={!canSend}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={async event => {
          event.preventDefault();
          setProblem(null);
          const answer = await onSend();
          if (answer === true) onOpenChange(false);
          else if (answer) setProblem(answer);
        }}
      >
        {children}
      </form>
    </Dialog>
  );
}

/** A button that opens an InputDialog. */
export function InputAction({
  label,
  disabled,
  variant = 'secondary',
  className,
  ...dialog
}: {
  label: string;
  disabled?: boolean;
  variant?: 'secondary' | 'primary';
  className?: string;
  description?: string;
  children: ReactNode;
  canSend: boolean;
  busy?: boolean;
  onSend: () => Promise<boolean | Notice>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled} className={className}>
        {label}
      </Button>
      <InputDialog open={open} onOpenChange={setOpen} label={label} {...dialog} />
    </>
  );
}

// ------------------------------------------------------------------ labels

export function When({ms}: {ms: number | null}) {
  const {t, lang} = useStaffT();
  if (ms === null) return <>{t('staff.dateTbd')}</>;
  return (
    <span className={numbers}>
      {formatShortDate(ms, lang)}, {formatTime(ms, lang)}
    </span>
  );
}

type Tone = 'action' | 'normal' | 'ended';

/** A status: icon plus word. Shape shows urgency: solid ink needs action; muted outline ended. */
export function StatusPill({icon: Icon, tone, children}: {icon: LucideIcon; tone: Tone; children: ReactNode}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 max-w-full rounded-full border px-2.5 py-0.5 text-sm leading-5',
        tone === 'action' && 'border-ink bg-ink font-medium text-white',
        tone === 'normal' && 'border-stone-500 text-ink',
        tone === 'ended' && 'border-stone-400 text-muted',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

const BOOKING: Record<string, [LucideIcon, Tone]> = {
  inquiry: [Inbox, 'normal'],
  pending_payment: [Hourglass, 'action'],
  confirmed: [CircleCheck, 'normal'],
  exception: [TriangleAlert, 'action'],
  cancelled: [CircleX, 'ended'],
  fulfilled: [CheckCheck, 'normal'],
  no_show: [UserX, 'ended'],
};

export const SESSION_STATE: Record<StaffSession['state'], [LucideIcon, Tone]> = {
  draft: [PencilLine, 'normal'],
  published: [Globe, 'normal'],
  cancelled: [CircleX, 'ended'],
  archived: [Archive, 'ended'],
};

export function BookingStatus({status}: {status: string}) {
  const {t} = useStaffT();
  const [icon, tone] = BOOKING[status] ?? [CircleAlert, 'normal'];
  return (
    <StatusPill icon={icon} tone={tone}>
      {t(`bstatus.${status}`)}
    </StatusPill>
  );
}

export function SessionState({state}: {state: StaffSession['state']}) {
  const {t} = useStaffT();
  const [icon, tone] = SESSION_STATE[state];
  return (
    <StatusPill icon={icon} tone={tone}>
      {t(`ses.state.${state}`)}
    </StatusPill>
  );
}

/** DEMO rows: a dashed tag with no icon, always first, so it never reads as a status. */
export function Demo({synthetic}: {synthetic: unknown}) {
  const {t} = useStaffT();
  return synthetic ? (
    <span className="inline-flex items-center max-w-full rounded-full border border-dashed border-stone-500 px-2.5 py-0.5 text-sm font-medium leading-5 text-ink">
      {t('staff.synthetic')}
    </span>
  ) : null;
}

/** A 4px seats track (ink on stone). The text next to it carries the numbers. */
export function Meter({value, max, className}: {value: number; max: number; className?: string}) {
  const share = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <span
      aria-hidden="true"
      className={cn('relative block h-1 w-16 shrink-0 overflow-hidden rounded-full bg-stone-200', className)}
    >
      <span className="absolute inset-y-0 left-0 bg-ink" style={{width: `${share}%`}} />
    </span>
  );
}

/** A small outline count. Only rendered for counts above zero. */
export function Chip({children}: {children: ReactNode}) {
  return (
    <span
      className={cn(
        'inline-flex items-center max-w-full rounded-full border border-stone-400 px-2.5 py-0.5 text-sm leading-5 text-ink',
        numbers,
      )}
    >
      {children}
    </span>
  );
}

/** "1 solicitud", "2 pagos pendientes", "1 excepción": only the counts above zero. */
export function CountChips({
  inquiries = 0,
  pending = 0,
  exceptions = 0,
}: {
  inquiries?: number;
  pending?: number;
  exceptions?: number;
}) {
  const {t} = useStaffT();
  return (
    <>
      {inquiries > 0 ? (
        <Chip>{inquiries === 1 ? t('ses.chip.inquiry') : t('ses.chip.inquiries', {count: inquiries})}</Chip>
      ) : null}
      {pending > 0 ? (
        <Chip>{pending === 1 ? t('ses.chip.pendingOne') : t('ses.chip.pending', {count: pending})}</Chip>
      ) : null}
      {exceptions > 0 ? (
        <Chip>{exceptions === 1 ? t('ses.chip.exception') : t('ses.chip.exceptions', {count: exceptions})}</Chip>
      ) : null}
    </>
  );
}

/** "8 de 24" (or "8 de 24 plazas") with the seats track; "Capacidad por confirmar" when unknown. */
export function Seats({session, long, meter = true}: {session: StaffSession; long?: boolean; meter?: boolean}) {
  const {t} = useStaffT();
  if (session.capacity === null) return <span className={helper}>{t('ses.capacityTbd')}</span>;
  const capacity = session.capacity - session.blocked_seats;
  return (
    <span className="inline-flex items-center gap-2 text-sm leading-5 text-ink">
      <span className={numbers}>
        {t(long ? 'ses.seatsLong' : 'ses.seatsShort', {taken: session.seats_taken, capacity})}
      </span>
      {meter ? <Meter value={session.seats_taken} max={capacity} /> : null}
    </span>
  );
}

/** Read-only facts as a definition list. */
export function Facts({items, columns = 2}: {items: [string, ReactNode][]; columns?: 1 | 2}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2')}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className={helper}>{label}</dt>
          <dd className="break-words text-base leading-6 text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ fields

export const fieldClass =
  'block w-full min-h-11 rounded-2xl border border-stone-500 bg-surface px-4 py-2 text-base leading-6 text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[invalid=true]:border-2 aria-[invalid=true]:border-ink';

/** A labeled native select, for forms with many fields (keyboard and phone friendly). */
export function SelectField<V extends string>({
  id,
  label,
  value,
  onChange,
  options,
  help,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: {value: V; label: string}[];
  help?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className="block text-sm font-medium leading-5 text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={event => onChange(event.target.value as V)}
        className={cn(fieldClass, 'disabled:bg-stone-100')}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help ? (
        <p id={`${id}-help`} className={helper}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  type = 'text',
  disabled,
  inputMode,
  multiline,
  maxLength,
  counter,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  help?: string;
  type?: string;
  disabled?: boolean;
  inputMode?: 'numeric' | 'decimal' | 'email' | 'tel' | 'search';
  multiline?: boolean;
  maxLength?: number;
  /** Shows "12 de 280" under the field (needs maxLength). */
  counter?: boolean;
  className?: string;
}) {
  const {t} = useStaffT();
  const showCount = counter && maxLength;
  const described =
    [help ? `${id}-help` : null, showCount ? `${id}-count` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  const common = {
    id,
    value,
    disabled,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described,
    className: cn(fieldClass, 'disabled:bg-stone-100', multiline && 'min-h-24'),
  };
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className="block text-sm font-medium leading-5 text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} onChange={event => onChange(event.target.value)} />
      ) : (
        <input {...common} type={type} inputMode={inputMode} onChange={event => onChange(event.target.value)} />
      )}
      {help ? (
        <p id={`${id}-help`} className={helper}>
          {help}
        </p>
      ) : null}
      {showCount ? (
        <p id={`${id}-count`} className={cn(helper, numbers)}>
          {t('staff.count', {count: value.length, max: maxLength})}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium leading-5 text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm font-medium leading-5 text-ink">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-accent"
      />
      {label}
    </label>
  );
}

/** A fieldset with a small legend, for long forms in a sheet. A hairline separates groups. */
export function FieldGroup({legend, children}: {legend: string; children: ReactNode}) {
  return (
    <div className="border-t border-border/70 pt-4">
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-semibold leading-5 text-ink">{legend}</legend>
        <div className="flex flex-col gap-4">{children}</div>
      </fieldset>
    </div>
  );
}
