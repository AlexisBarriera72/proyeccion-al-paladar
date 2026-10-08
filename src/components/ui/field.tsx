// Form fields. Inputs have a stone-500 border (at least 3:1 against white), so a field never
// depends on a faint decorative border. Errors name the field and the fix, and stay linked.
import {forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes} from 'react';
import {cn} from '../../lib/cn.ts';

const control =
  'block w-full rounded-2xl border border-stone-500 bg-surface px-4 py-3 text-base leading-6 text-ink ' +
  'placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'aria-[invalid=true]:border-ink aria-[invalid=true]:border-2';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  {className, ...props},
  ref,
) {
  return <input ref={ref} className={cn(control, 'min-h-11', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  {className, ...props},
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-24', className)} {...props} />;
});

export function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium leading-5 text-ink">
        {label}
      </label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-sm leading-5 text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-2 text-sm font-medium leading-5 text-ink" role="alert">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-block size-4 shrink-0 rounded-full border-2 border-ink text-center text-[10px] leading-3"
          >
            !
          </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** aria-describedby for a field with optional help and error. */
export const describedBy = (id: string, help: boolean, error: boolean) =>
  [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
