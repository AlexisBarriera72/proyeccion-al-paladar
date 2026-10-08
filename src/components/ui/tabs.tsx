// A two-way switch (Calendario / Lista) on Radix ToggleGroup: a radio group with arrow keys
// and roving focus. It switches a view in place, so it isn't a tab list (no tab panels).
import {ToggleGroup as G} from 'radix-ui';
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
    <G.Root
      type="single"
      value={value}
      // Pressing the selected option again sends ''; one view always stays chosen.
      onValueChange={next => {
        if (next) onChange(next as V);
      }}
      aria-label={label}
      className="inline-flex rounded-2xl border border-stone-400 bg-surface p-1"
    >
      {options.map(option => (
        <G.Item
          key={option.value}
          value={option.value}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=on]:bg-ink data-[state=on]:text-white [&_svg]:size-4"
        >
          {option.label}
        </G.Item>
      ))}
    </G.Root>
  );
}
