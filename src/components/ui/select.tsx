// A select on Radix (keyboard, typeahead, screen readers), styled like the other fields.
import {Select as S} from 'radix-ui';
import {Check, ChevronDown} from 'lucide-react';

export function Select<V extends string>({
  id,
  value,
  onChange,
  options,
  label,
}: {
  id?: string;
  value: V;
  onChange: (value: V) => void;
  options: {value: V; label: string}[];
  label: string;
}) {
  return (
    <S.Root value={value} onValueChange={next => onChange(next as V)}>
      <S.Trigger
        id={id}
        aria-label={label}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-stone-500 bg-surface px-4 py-2 text-left text-sm font-medium leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <S.Value />
        <S.Icon>
          <ChevronDown className="size-4" aria-hidden="true" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]"
        >
          <S.Viewport className="p-1">
            {options.map(option => (
              <S.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-11 cursor-pointer select-none items-center rounded-xl py-2 pl-9 pr-3 text-sm leading-5 text-ink outline-none data-[highlighted]:bg-stone-100"
              >
                <S.ItemIndicator className="absolute left-3 inline-flex">
                  <Check className="size-4" aria-hidden="true" />
                </S.ItemIndicator>
                <S.ItemText>{option.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
