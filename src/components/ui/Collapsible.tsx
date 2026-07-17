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
 * Used to keep rarely-edited config (投稿目标 / 研究阶段 / …) out of the way.
 */
export function Collapsible({ title, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-t border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 rounded-md py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ChevronRight
          size={15}
          className={cn(
            'shrink-0 text-neutral-400 transition-transform group-hover:text-neutral-600 dark:group-hover:text-neutral-300',
            open && 'rotate-90',
          )}
        />
        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {title}
        </span>
        {!open && summary ? (
          <span className="ml-auto min-w-0 truncate pl-3 text-xs text-neutral-500 dark:text-neutral-400">
            {summary}
          </span>
        ) : null}
      </button>
      {open ? <div className="pb-4 pl-[23px] pr-1">{children}</div> : null}
    </section>
  )
}
