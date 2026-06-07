import * as Radix from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function DropdownMenu(props: ComponentPropsWithoutRef<typeof Radix.Root>) {
  return <Radix.Root {...props} />
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Radix.Trigger>
>(function DropdownMenuTrigger(props, ref) {
  return <Radix.Trigger ref={ref} {...props} />
})

export function DropdownMenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  return (
    <Radix.Portal>
      <Radix.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[12rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg animate-menu-in',
          'dark:border-neutral-700 dark:bg-neutral-800',
          className,
        )}
      >
        {children}
      </Radix.Content>
    </Radix.Portal>
  )
}

export function DropdownMenuItem({
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
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive
          ? 'text-red-600 data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-950/50'
          : 'text-neutral-700 data-[highlighted]:bg-neutral-100 dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-700/60',
      )}
    >
      {children}
    </Radix.Item>
  )
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <Radix.Label className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
      {children}
    </Radix.Label>
  )
}

export function DropdownMenuSeparator() {
  return <Radix.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
}
