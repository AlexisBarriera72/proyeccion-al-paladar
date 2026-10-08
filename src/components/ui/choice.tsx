// Radio choices (Radix RadioGroup) and a checkbox (Radix Checkbox), with visible focus and
// a check icon, so the state never depends on color alone.
import {Checkbox as C, RadioGroup as R} from 'radix-ui';
import {Check} from 'lucide-react';
import type {ReactNode} from 'react';

export function Choices<V extends string>({
  value,
  onChange,
  label,
  options,
  name,
}: {
  value: V;
  onChange: (value: V) => void;
  label: string;
  name: string;
  options: {value: V; label: ReactNode}[];
}) {
  return (
    <R.Root
      value={value}
      onValueChange={next => onChange(next as V)}
      aria-label={label}
      name={name}
      className="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2"
    >
      {options.map(option => (
        <label
          key={option.value}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-stone-500 bg-surface px-4 py-2 text-sm font-medium leading-5 text-ink has-[[data-state=checked]]:border-2 has-[[data-state=checked]]:border-ink"
        >
          <R.Item
            value={option.value}
            className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <R.Indicator className="block size-2.5 rounded-full bg-ink" />
          </R.Item>
          {option.label}
        </label>
      ))}
    </R.Root>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  describedBy,
  invalid,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <C.Root
        id={id}
        checked={checked}
        onCheckedChange={next => onChange(next === true)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=checked]:bg-ink"
      >
        <C.Indicator>
          <Check className="size-4 text-white" aria-hidden="true" />
        </C.Indicator>
      </C.Root>
      <label htmlFor={id} className="text-base leading-6 text-ink">
        {children}
      </label>
    </div>
  );
}
