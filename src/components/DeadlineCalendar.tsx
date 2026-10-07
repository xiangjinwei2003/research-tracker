import { useMemo, useRef, useState, type ComponentProps } from 'react'
import {
  addDays,
  addMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { fmtMD, parse, today } from '@/lib/date'
import type { Project } from '@/lib/types'
import { Calendar, CalendarDayButton } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/Button'
import { cn } from '@/lib/cn'
import { CalendarSubscribeDialog } from './CalendarSubscribeDialog'

/** 美式排法：周日是一周的第一列（与 Apple Calendar 默认一致）。 */
const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

/** Sunday-start week — local to this calendar view; 回顾页的周统计仍按周一起算。 */
const weekStartSun = (d: Date) => startOfWeek(d, { weekStartsOn: 0 })

type EventItem = { project: Project; todoId: string; title: string; done: boolean }

/** What's mid-drag: enough to write the new date back on drop. */
type DragPayload = { projectId: string; todoId: string; title: string; fromKey: string }

interface Props {
  onEdit: (p: Project) => void
}

/**
 * Apple-Calendar-style month view that fills the viewport: a weekday header row,
 * then week rows stretching evenly to the bottom. Every day cell lists what's due
 * that day (todos, dotted by project colour). Past
 * days are dimmed; today's number gets the filled circle. The month label opens
 * a react-day-picker popover to jump anywhere.
 */
export function DeadlineCalendar({ onEdit }: Props) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived)
  const updateTodo = useStore((s) => s.updateTodo)
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const todayIso = today()

  // Drag-to-reschedule: chip being dragged + the day cell currently hovered.
  const dragRef = useRef<DragPayload | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const handleDrop = (key: string) => {
    const d = dragRef.current
    dragRef.current = null
    setDragOverKey(null)
    if (!d || d.fromKey === key) return
    updateTodo(d.projectId, d.todoId, { endDate: key })
    toast({ message: `「${d.title}」已改到 ${fmtMD(key)}` })
  }

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    const push = (iso: string, e: EventItem) => {
      const d = parse(iso)
      if (!d) return
      const key = format(d, 'yyyy-MM-dd')
      const arr = map.get(key)
      if (arr) arr.push(e)
      else map.set(key, [e])
    }
    for (const p of projects) {
      for (const t of p.todos) {
        push(t.endDate, {
          project: p,
          todoId: t.id,
          title: t.title || '未命名',
          done: t.done,
        })
      }
    }
    return map
  }, [projects])

  // Days that carry a marker dot in the jump-to mini calendar.
  const todoDates = useMemo(() => {
    const dates: Date[] = []
    for (const key of byDay.keys()) {
      const d = parse(key)
      if (d) dates.push(d)
    }
    return dates
  }, [byDay])

  // Month grid: whole weeks (Sunday-start) covering the anchored month.
  const monthStart = startOfMonth(anchor)
  const gridStart = weekStartSun(monthStart)
  const weekCount =
    differenceInCalendarWeeks(weekStartSun(endOfMonth(anchor)), gridStart, { weekStartsOn: 0 }) + 1
  // Depend on the timestamp, not the Date object: `weekStartSun` returns a fresh
  // instance every render, so an identity dep would rebuild the grid each time.
  const gridStartMs = gridStart.getTime()
  const days = useMemo(
    () => Array.from({ length: weekCount * 7 }, (_, i) => addDays(gridStartMs, i)),
    [gridStartMs, weekCount],
  )

  // This month's totals for the header line.
  const todoCount = useMemo(() => {
    let n = 0
    for (const d of days) {
      if (!isSameMonth(d, anchor)) continue
      for (const e of byDay.get(format(d, 'yyyy-MM-dd')) ?? []) if (!e.done) n += 1
    }
    return n
  }, [days, anchor, byDay])

  const isCurMonth = isSameMonth(anchor, new Date())
  const subtitle = todoCount === 0 ? '本月没有到期的待办' : `本月 ${todoCount} 个待办到期`

  return (
    <section aria-label="截止月历" className="flex min-w-0 flex-1 flex-col">
      <CalendarSubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.01em]">
            <CalendarDays size={26} strokeWidth={2.2} className="text-destructive" aria-hidden />
            日历
          </h1>
          <p className="mt-1.5 pl-[36px] text-[13px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="mr-2" onClick={() => setSubscribeOpen(true)}>
            <CalendarPlus />
            订阅到苹果日历
          </Button>

          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, -1))}
            aria-label="上个月"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft size={16} />
          </button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="点击跳到任意日期"
                className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[15px] font-semibold tabular-nums text-foreground transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {format(anchor, 'yyyy年M月')}
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={anchor}
                onSelect={(d) => {
                  if (d) {
                    setAnchor(d)
                    setPickerOpen(false)
                  }
                }}
                defaultMonth={anchor}
                weekStartsOn={0}
                locale={zhCN}
                modifiers={{ hasTodo: todoDates }}
                components={{ DayButton: DayWithDot }}
                className="[--cell-size:2.25rem]"
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
            aria-label="下个月"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight size={16} />
          </button>

          {!isCurMonth ? (
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
              今天
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {/* Weekday header — right-aligned over the date numbers, Apple style. */}
        <div className="cal-grid shrink-0">
          {WEEKDAY_CN.map((w, i) => (
            <div
              key={w}
              className={cn(
                'px-2 pb-2 text-right text-xs text-faint',
                (i === 0 || i === 6) && 'text-faint/70',
              )}
            >
              周{w}
            </div>
          ))}
        </div>

        {/* Week rows stretch evenly to fill the remaining height. */}
        <div
          className="cal-grid flex-1"
          style={{ gridTemplateRows: `repeat(${weekCount}, minmax(4.5rem, 1fr))` }}
        >
          {days.map((d, i) => {
            const key = format(d, 'yyyy-MM-dd')
            const inMonth = isSameMonth(d, anchor)
            const isToday = key === todayIso
            const isPast = key < todayIso
            const evs = byDay.get(key) ?? []
            const lastRow = i >= (weekCount - 1) * 7
            const lastCol = i % 7 === 6
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverKey !== key) setDragOverKey(key)
                }}
                onDragLeave={(e) => {
                  // Ignore leaves that are just moving onto a child chip.
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverKey((k) => (k === key ? null : k))
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(key)
                }}
                className={cn(
                  'flex min-h-0 flex-col gap-0.5 border-t px-1 pb-1 pt-1 transition-colors',
                  !lastCol && 'border-r border-r-border/50',
                  lastRow && 'border-b',
                  !inMonth && 'bg-sidebar/50',
                  dragOverKey === key && 'bg-accent/50 ring-1 ring-inset ring-ring',
                )}
              >
                <div className="flex shrink-0 items-center justify-end">
                  {isToday ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[13px] font-semibold tabular-nums text-primary-foreground">
                      {d.getDate()}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex h-6 items-center px-1.5 text-[13px] tabular-nums',
                        !inMonth
                          ? 'text-faint/60'
                          : isPast
                            ? 'text-faint'
                            : 'text-secondary-foreground',
                      )}
                    >
                      {d.getDate() === 1 ? format(d, 'M月d日') : d.getDate()}
                    </span>
                  )}
                </div>
                {evs.length > 0 ? (
                  <div
                    className={cn(
                      'min-h-0 flex-1 space-y-1 overflow-y-auto [scrollbar-width:thin]',
                      // 过去的日子整体置灰（今天及未来保持原色）。
                      isPast && !isToday && 'opacity-50',
                    )}
                  >
                    {evs.map((e, j) => (
                      <EventChip
                        key={j}
                        e={e}
                        onClick={() => onEdit(e.project)}
                        onDragStart={() => {
                          dragRef.current = {
                            projectId: e.project.id,
                            todoId: e.todoId,
                            title: e.title,
                            fromKey: key,
                          }
                        }}
                        onDragEnd={() => {
                          dragRef.current = null
                          setDragOverKey(null)
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Mini month-picker day cell + a dot when the day carries todos. */
function DayWithDot(props: ComponentProps<typeof CalendarDayButton>) {
  const m = props.modifiers as Record<string, boolean | undefined>
  return (
    <span className="relative flex h-full w-full items-center justify-center">
      <CalendarDayButton {...props} />
      {m.hasTodo ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-faint"
        />
      ) : null}
    </span>
  )
}

function EventChip({
  e,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  e: EventItem
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  // Shared by all three variants: drag a chip onto another day to reschedule.
  const dragProps = {
    draggable: true,
    onDragStart: (ev: React.DragEvent) => {
      ev.dataTransfer.effectAllowed = 'move'
      // Safari won't start a drag without data attached.
      ev.dataTransfer.setData('text/plain', '')
      onDragStart()
    },
    onDragEnd,
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${e.title} · ${e.project.title || '未命名项目'} · 拖到别的日期可改期`}
      {...dragProps}
      className={cn(
        'flex w-full cursor-grab items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        e.done && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: e.project.color }}
      />
      <span className={cn('min-w-0 flex-1 truncate text-secondary-foreground', e.done && 'line-through')}>
        {e.title}
      </span>
    </button>
  )
}
