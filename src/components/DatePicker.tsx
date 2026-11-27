import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/Button'
import { dueLabel, fmtMD, parse, today } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * 日期弹层：触发器由调用方给出，弹出与日历页同一套月历。
 * 全应用的日期选择都走这里，不再使用浏览器原生日期框。
 */
function DatePopover({
  value,
  onChange,
  max,
  clearable,
  align = 'start',
  children,
}: {
  value: string
  onChange: (iso: string) => void
  /** 可选的最晚日期（含），ISO YYYY-MM-DD。 */
  max?: string
  clearable: boolean
  align?: 'start' | 'end'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const selected = parse(value) ?? undefined
  const maxDate = max ? (parse(max) ?? undefined) : undefined
  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          onSelect={(d) => d && pick(format(d, 'yyyy-MM-dd'))}
          disabled={maxDate ? { after: maxDate } : undefined}
          weekStartsOn={0}
          locale={zhCN}
          className="[--cell-size:2.25rem]"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <Button size="sm" variant="ghost" onClick={() => pick(today())}>
            今天
          </Button>
          {clearable && value ? (
            <Button size="sm" variant="ghost" onClick={() => pick('')}>
              清除
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** 表单里的日期字段：与输入框、选择框同一外观。 */
export function DateField({
  id,
  value,
  onChange,
  max,
  clearable = true,
  placeholder = '未设置',
  className,
}: {
  id?: string
  value: string
  onChange: (iso: string) => void
  max?: string
  clearable?: boolean
  placeholder?: string
  className?: string
}) {
  const d = parse(value)
  return (
    <DatePopover value={value} onChange={onChange} max={max} clearable={clearable}>
      <button
        id={id}
        type="button"
        className={cn(
          'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-secondary px-2.5 text-sm tabular-nums outline-none transition-[background-color,box-shadow] hover:bg-input focus-visible:ring-2 focus-visible:ring-ring',
          !d && 'text-muted-foreground',
          className,
        )}
      >
        <span className="truncate">
          {d ? `${d.getFullYear()}年${fmtMD(value)}` : placeholder}
        </span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </DatePopover>
  )
}

/** 任务行上的截止日期按钮：显示相对日期文字，点击弹出月历，可清除。 */
export function DateButton({
  value,
  todayIso,
  onChange,
  className,
}: {
  value: string
  todayIso: string
  onChange: (date: string) => void
  className?: string
}) {
  const due = dueLabel(value, todayIso)
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <DatePopover value={value} onChange={onChange} clearable align="end">
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`修改截止日期，当前 ${fmtMD(value) || '未设置'}`}
          className={cn(
            'inline-flex h-7 items-center rounded-md px-1.5 text-xs tabular-nums transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            due?.tone === 'overdue'
              ? 'text-destructive'
              : due?.tone === 'today'
                ? 'text-today'
                : 'text-muted-foreground',
            // 没有日期时只在所在行悬停或按钮聚焦时出现，避免每行重复一个占位文字
            !due &&
              'opacity-0 focus-visible:opacity-100 group-hover/date-row:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        >
          {due?.text ?? '设置日期'}
        </button>
      </DatePopover>
    </span>
  )
}
