import * as Radix from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Max width. Defaults to 2xl. */
  size?: 'md' | 'lg' | '2xl' | 'xl'
}

const sizeCls = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  '2xl': 'sm:max-w-3xl',
  xl: 'sm:max-w-[880px]',
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = '2xl',
}: Props) {
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-40 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Radix.Content
          data-slot="dialog-content"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 grid max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/[.06] bg-popover text-popover-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,.6)] outline-none',
            'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            sizeCls[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div className="grid gap-1">
              <Radix.Title className="text-[17px] font-semibold text-foreground">
                {title}
              </Radix.Title>
              {description ? (
                <Radix.Description className="text-sm text-muted-foreground">
                  {description}
                </Radix.Description>
              ) : null}
            </div>
            <Radix.Close
              className="-mr-1 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="关闭"
            >
              <X className="size-[18px]" />
            </Radix.Close>
          </div>
          <div className="overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
