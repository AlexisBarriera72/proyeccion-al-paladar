// "Más acciones": rare and destructive actions behind one button (Radix DropdownMenu, staff
// only; the guest bundle never imports it). Destructive items come last, after a separator.
// An item runs once the menu has handed focus back to its trigger, so a dialog it opens
// records the trigger as its opener and Escape returns focus there.
import {DropdownMenu as M} from 'radix-ui';
import {Ellipsis, type LucideIcon} from 'lucide-react';
import {useRef, type ReactNode} from 'react';
import {Button} from './button.tsx';
import {cn} from '../../lib/cn.ts';

/**
 * Where open menus render: inside the page's <main>, so the menu belongs to a landmark (axe
 * "region"). It is positioned fixed, so where it sits in the DOM doesn't move it on screen.
 */
export const menuContainer = () => document.getElementById('main') ?? undefined;

export interface MenuAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

const item =
  'flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-sm leading-5 text-ink outline-none ' +
  'data-[highlighted]:bg-stone-100 data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-accent ' +
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0';

export function Menu({
  label,
  actions,
  icon,
  className,
}: {
  label: string;
  actions: MenuAction[];
  icon?: ReactNode;
  className?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<(() => void) | null>(null);
  const regular = actions.filter(action => !action.destructive);
  const destructive = actions.filter(action => action.destructive);
  const render = (action: MenuAction) => {
    const Icon = action.icon;
    return (
      <M.Item
        key={action.key}
        disabled={action.disabled}
        className={item}
        onSelect={() => {
          pending.current = action.onSelect;
        }}
      >
        {Icon ? <Icon aria-hidden="true" /> : null}
        {action.label}
      </M.Item>
    );
  };
  if (!actions.length) return null;
  return (
    <M.Root modal={false}>
      <M.Trigger asChild>
        <Button ref={trigger} variant="secondary" className={className}>
          {icon ?? <Ellipsis aria-hidden="true" />}
          {label}
        </Button>
      </M.Trigger>
      <M.Portal container={menuContainer()}>
        <M.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          onCloseAutoFocus={event => {
            event.preventDefault();
            trigger.current?.focus();
            const run = pending.current;
            pending.current = null;
            run?.();
          }}
          className={cn(
            'z-50 min-w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/50 bg-surface p-1',
            'shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]',
          )}
        >
          {regular.map(render)}
          {regular.length && destructive.length ? <M.Separator className="my-1 h-px bg-border/70" /> : null}
          {destructive.map(render)}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
