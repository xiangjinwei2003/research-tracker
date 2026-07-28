import { Flame, Minus, ChevronDown } from 'lucide-react'
import type { ComponentType } from 'react'
import { PRIORITY_META, PRIORITY_ORDER, type Priority } from '@/lib/types'
import { cn } from '@/lib/cn'

const ICON: Record<Priority, ComponentType<{ size?: number }>> = {
  high: Flame,
  normal: Minus,
  low: ChevronDown,
}

interface Props {
  priority: Priority
  onChange: (p: Priority) => void
  className?: string
}

/** A compact chip that cycles 主攻 → 一般 → 次要 on click. */
export function PriorityButton({ priority, onChange, className }: Props) {
  // Fall back defensively so an unexpected value never crashes the chip.
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.normal
  const Icon = ICON[priority] ?? Minus
  const next = PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(priority) + 1) % PRIORITY_ORDER.length]

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange(next)
      }}
      title={`重要程度：${meta.label}（点击切换）`}
      aria-label={`重要程度：${meta.label}，点击切换`}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs font-medium transition',
        'hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        meta.chip,
        className,
      )}
    >
      <Icon size={12} />
      {meta.short}
    </button>
  )
}
