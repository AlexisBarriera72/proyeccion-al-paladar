// Small pieces the staff views share: copy, states, notices, confirmations and labels.
import {useState, type ReactNode} from 'react';
import {CircleAlert, CircleCheck, RotateCw} from 'lucide-react';
import type {ApiResult} from '../lib/api.ts';
import {useT} from '../lib/i18n.tsx';
import {formatShortDate, formatTime} from '../../shared/time.ts';
import {detailTitle, helper, numbers, panel} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {STAFF} from './copy.ts';
import type {Query} from './api.ts';

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

export function NoticeLine({notice}: {notice: Notice}) {
  return (
    <div role="status" aria-live="polite">
      {notice ? (
        <p
          className={cn(
            'flex items-start gap-2 rounded-2xl border p-3 text-sm leading-5 text-ink',
            notice.tone === 'ok' ? 'border-stone-400 bg-stone-50' : 'border-ink bg-surface font-medium',
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

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(panel, 'min-w-0 space-y-4', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className={detailTitle}>{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
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
      <div role="alert" className="space-y-3 rounded-2xl border border-stone-400 bg-surface p-4">
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

/** A confirmation that says what will actually happen. */
export function Confirm({
  trigger,
  title,
  body,
  confirmLabel,
  onConfirm,
  disabled,
  variant = 'quiet',
}: {
  trigger: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => unknown;
  disabled?: boolean;
  variant?: 'quiet' | 'primary' | 'secondary';
}) {
  const {t} = useStaffT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={title} closeLabel={t('staff.close')}>
        <div className="space-y-4">
          <div className="text-base leading-6 text-ink">{body}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('staff.cancelAction')}
            </Button>
            <Button
              variant={variant === 'primary' ? 'primary' : 'quiet'}
              onClick={() => {
                setOpen(false);
                void onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function When({ms}: {ms: number | null}) {
  const {t, lang} = useStaffT();
  if (ms === null) return <>{t('staff.dateTbd')}</>;
  return (
    <span className={numbers}>
      {formatShortDate(ms, lang)}, {formatTime(ms, lang)}
    </span>
  );
}

export function Pill({children, strong}: {children: ReactNode; strong?: boolean}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm leading-5',
        strong ? 'border-ink font-semibold text-ink' : 'border-stone-400 text-ink',
      )}
    >
      {children}
    </span>
  );
}

export function BookingStatus({status}: {status: string}) {
  const {t} = useStaffT();
  return <Pill strong={status === 'exception' || status === 'pending_payment'}>{t(`bstatus.${status}`)}</Pill>;
}

export function Demo({synthetic}: {synthetic: unknown}) {
  const {t} = useStaffT();
  return synthetic ? <Pill>{t('staff.synthetic')}</Pill> : null;
}

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
}: {
  id: string;
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: {value: V; label: string}[];
  help?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
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
}) {
  const described = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
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
    <div className="space-y-2">
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
