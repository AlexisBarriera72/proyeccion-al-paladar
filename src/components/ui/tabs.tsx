// A two-way switch (Calendario / Lista) on Radix Tabs: arrow keys, roving focus, ARIA tabs.
import {Tabs as T} from 'radix-ui';
import type {ReactNode} from 'react';

export function Switch<V extends string>({
  value,
  onChange,
  label,
  options,
}: {
  value: V;
  onChange: (value: V) => void;
  label: string;
  options: {value: V; label: ReactNode}[];
}) {
  return (
    <T.Root value={value} onValueChange={next => onChange(next as V)} activationMode="automatic">
      <T.List aria-label={label} className="inline-flex rounded-2xl border border-stone-400 bg-surface p-1">
        {options.map(option => (
          <T.Trigger
            key={option.value}
            value={option.value}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=active]:bg-ink data-[state=active]:text-white [&_svg]:size-4"
          >
            {option.label}
          </T.Trigger>
        ))}
      </T.List>
    </T.Root>
  );
}
