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
  const meta = PRIORITY_META[priority]
  const Icon = ICON[priority]
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
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs font-medium transition hover:brightness-105',
        className,
      )}
      style={{
        borderColor: meta.color,
        backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
        color: meta.color,
      }}
    >
      <Icon size={12} />
      {meta.short}
    </button>
  )
}
