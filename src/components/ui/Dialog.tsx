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
  size?: 'md' | 'lg' | '2xl'
}

const sizeCls = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  '2xl': 'max-w-3xl',
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
        <Radix.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-overlay-in" />
        <Radix.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-neutral-200 bg-white shadow-xl outline-none animate-content-in',
            'dark:border-neutral-800 dark:bg-neutral-900',
            'max-h-[90vh] overflow-y-auto',
            sizeCls[size],
          )}
        >
          <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <div>
              <Radix.Title className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </Radix.Title>
              {description ? (
                <Radix.Description className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {description}
                </Radix.Description>
              ) : null}
            </div>
            <Radix.Close
              className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800"
              aria-label="关闭"
            >
              <X size={18} />
            </Radix.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
