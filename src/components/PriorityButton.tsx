import { Circle, Flame, Minus, ChevronDown } from 'lucide-react'
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
  /** 待分配：显示「待分配」，点击后设为第一档优先级。 */
  pending?: boolean
  onChange: (p: Priority) => void
  className?: string
}

/** A compact chip that cycles 主攻 → 一般 → 次要 on click. */
export function PriorityButton({ priority, pending, onChange, className }: Props) {
  // Fall back defensively so an unexpected value never crashes the chip.
  const meta = pending
    ? { label: '待分配', short: '待分配', text: 'text-muted-foreground' }
    : (PRIORITY_META[priority] ?? PRIORITY_META.normal)
  const Icon = pending ? Circle : (ICON[priority] ?? Minus)
  const next = pending
    ? PRIORITY_ORDER[0]
    : PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(priority) + 1) % PRIORITY_ORDER.length]

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
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs transition-colors',
        'hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        meta.text,
        className,
      )}
    >
      <Icon size={12} />
      {meta.short}
    </button>
  )
}
