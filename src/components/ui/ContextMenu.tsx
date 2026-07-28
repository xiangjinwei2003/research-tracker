import * as Radix from '@radix-ui/react-context-menu'
import { type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Right-click menu primitives, styled identically to ui/DropdownMenu. */
export function ContextMenu(props: ComponentPropsWithoutRef<typeof Radix.Root>) {
  return <Radix.Root {...props} />
}

export function ContextMenuTrigger(props: ComponentPropsWithoutRef<typeof Radix.Trigger>) {
  return <Radix.Trigger {...props} />
}

export function ContextMenuContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Radix.Portal>
      <Radix.Content
        data-slot="context-menu-content"
        className={cn(
          'z-50 min-w-[12rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        {children}
      </Radix.Content>
    </Radix.Portal>
  )
}

export function ContextMenuItem({
  children,
  onSelect,
  destructive,
  disabled,
}: {
  children: ReactNode
  onSelect?: () => void
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <Radix.Item
      disabled={disabled}
      onSelect={onSelect}
      data-slot="context-menu-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive
          ? 'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive [&_svg:not([class*=text-])]:text-destructive'
          : 'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
      )}
    >
      {children}
    </Radix.Item>
  )
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return (
    <Radix.Label className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </Radix.Label>
  )
}

export function ContextMenuSeparator() {
  return <Radix.Separator className="-mx-1 my-1 h-px bg-border" />
}
