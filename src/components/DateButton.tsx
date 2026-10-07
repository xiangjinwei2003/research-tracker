import { useRef } from 'react'
import { dueLabel, fmtMD } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * 截止日期按钮：显示相对日期文字，点击弹出浏览器原生日期选择器。
 * allowClear 为 false 时忽略清空（项目列表里的待办始终保留日期）。
 */
export function DateButton({
  value,
  todayIso,
  onChange,
  allowClear = false,
  className,
}: {
  value: string
  todayIso: string
  onChange: (date: string) => void
  allowClear?: boolean
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const due = dueLabel(value, todayIso)

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = ref.current
    if (!el) return
    try {
      if (el.showPicker) el.showPicker()
      else el.focus()
    } catch {
      el.focus()
    }
  }

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <button
        type="button"
        onClick={openPicker}
        title={value ? `${fmtMD(value)}，点击修改` : '设置截止日期'}
        aria-label={`修改截止日期，当前 ${fmtMD(value) || '未设置'}`}
        className={cn(
          'inline-flex h-7 items-center rounded-md px-1.5 text-xs tabular-nums transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          due?.tone === 'overdue'
            ? 'text-destructive'
            : due?.tone === 'today'
              ? 'text-today'
              : due
                ? 'text-muted-foreground'
                : 'text-faint',
        )}
      >
        {due?.text ?? '设置日期'}
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => {
          if (e.target.value || allowClear) onChange(e.target.value)
        }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </span>
  )
}
