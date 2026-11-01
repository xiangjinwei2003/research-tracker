import { PRIORITY_META, PRIORITY_ORDER, type Priority } from '@/lib/types'
import { cn } from '@/lib/cn'

interface Props {
  priority: Priority
  /** 待分配：显示「待分配」，点击后设为第一档优先级。 */
  pending?: boolean
  onChange: (p: Priority) => void
  className?: string
}

/** 优先级小标签，点击依次切换高、普通、低；圆点与首页分组一致。 */
export function PriorityButton({ priority, pending, onChange, className }: Props) {
  // Fall back defensively so an unexpected value never crashes the chip.
  const meta = pending
    ? {
        label: '待分配',
        short: '待分配',
        text: 'text-muted-foreground',
        dot: 'bg-transparent ring-[1.5px] ring-inset ring-muted-foreground',
      }
    : (PRIORITY_META[priority] ?? PRIORITY_META.normal)
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
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs transition-colors',
        'hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        meta.text,
        className,
      )}
    >
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', meta.dot)} />
      {meta.short}
    </button>
  )
}
