import { ContextMenu as Radix } from 'radix-ui'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 右键菜单，外观与 DropdownMenu 一致。 */
export function ContextMenu(props: ComponentPropsWithoutRef<typeof Radix.Root>) {
  return <Radix.Root {...props} />
}

export function ContextMenuTrigger(props: ComponentPropsWithoutRef<typeof Radix.Trigger>) {
  return <Radix.Trigger {...props} />
}

export function ContextMenuContent({
  children,
  className,
  onCloseAutoFocus,
}: {
  children: ReactNode
  className?: string
  onCloseAutoFocus?: (e: Event) => void
}) {
  return (
    <Radix.Portal>
      <Radix.Content
        onCloseAutoFocus={onCloseAutoFocus}
        data-slot="context-menu-content"
        className={cn(
          'z-50 min-w-[11rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-lg border border-white/[.06] bg-popover p-1 text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,.55)]',
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
}: {
  children: ReactNode
  onSelect?: () => void
  destructive?: boolean
}) {
  return (
    <Radix.Item
      onSelect={onSelect}
      data-slot="context-menu-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-[5px] px-2 py-1.5 text-[13px] outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        destructive
          ? 'text-destructive data-[highlighted]:bg-destructive data-[highlighted]:text-white [&_svg:not([class*=text-])]:text-current'
          : 'data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground [&_svg:not([class*=text-])]:text-muted-foreground data-[highlighted]:[&_svg]:text-current',
      )}
    >
      {children}
    </Radix.Item>
  )
}

export function ContextMenuSeparator() {
  return <Radix.Separator className="-mx-1 my-1 h-px bg-border" />
}
