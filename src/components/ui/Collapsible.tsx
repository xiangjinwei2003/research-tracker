import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  title: string
  /**
   * Shown right-aligned while collapsed so the key fact (deadline, counts…)
   * stays visible without expanding. Hidden when open — the content takes over.
   */
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Frameless disclosure section: hairline top divider + clickable header row.
 * A summary-when-collapsed pattern the registry Collapsible doesn't cover, so
 * it's hand-built on tokens (kept off the shadcn primitive deliberately).
 */
export function Collapsible({ title, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 rounded-md py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronRight
          size={15}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform group-hover:text-foreground',
            open && 'rotate-90',
          )}
        />
        <span className="text-sm font-medium text-foreground">{title}</span>
        {!open && summary ? (
          <span className="ml-auto min-w-0 truncate pl-3 text-xs text-muted-foreground">
            {summary}
          </span>
        ) : null}
      </button>
      {open ? <div className="pb-4 pl-6 pr-1">{children}</div> : null}
    </section>
  )
}
