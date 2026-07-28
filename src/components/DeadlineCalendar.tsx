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
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { fmtMD, parse, today } from '@/lib/date'
import { findStage, type Project } from '@/lib/types'
import { Calendar, CalendarDayButton } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/Button'
import { cn } from '@/lib/cn'

/** 美式排法：周日是一周的第一列（与 Apple Calendar 默认一致）。 */
const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

/** Sunday-start week — local to this calendar view; 回顾页的周统计仍按周一起算。 */
const weekStartSun = (d: Date) => startOfWeek(d, { weekStartsOn: 0 })

type EventItem =
  | { kind: 'deadline'; project: Project; label: string }
  | { kind: 'rebuttal'; project: Project; label: string }
  | { kind: 'todo'; project: Project; todoId: string; title: string; stageColor: string; done: boolean }

const ORDER: Record<EventItem['kind'], number> = { deadline: 0, rebuttal: 1, todo: 2 }

/** What's mid-drag: enough to write the new date back on drop. */
type DragPayload =
  | { kind: 'deadline' | 'rebuttal'; projectId: string; fromKey: string }
  | { kind: 'todo'; projectId: string; todoId: string; title: string; fromKey: string }

interface Props {
  onEdit: (p: Project) => void
}

/**
 * Apple-Calendar-style month view that fills the viewport: a weekday header row,
 * then week rows stretching evenly to the bottom. Every day cell lists what's due
 * that day (▲ 投稿截止 / ◆ Rebuttal on top, then todos by stage colour). Past
 * days are dimmed; today's number gets the filled circle. The month label opens
 * a react-day-picker popover to jump anywhere.
 */
export function DeadlineCalendar({ onEdit }: Props) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived)
  const updateTodo = useStore((s) => s.updateTodo)
  const updateProject = useStore((s) => s.updateProject)
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const todayIso = today()

  // Drag-to-reschedule: chip being dragged + the day cell currently hovered.
  const dragRef = useRef<DragPayload | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const handleDrop = (key: string) => {
    const d = dragRef.current
    dragRef.current = null
    setDragOverKey(null)
    if (!d || d.fromKey === key) return
    if (d.kind === 'todo') {
      updateTodo(d.projectId, d.todoId, { endDate: key })
      toast({ message: `「${d.title}」已改到 ${fmtMD(key)}` })
      return
    }
    // Venue dates live on the project; rebuild the venue with the dropped day.
    const p = useStore.getState().projects.find((x) => x.id === d.projectId)
    if (!p?.venue) return
    updateProject(d.projectId, {
      venue:
        d.kind === 'deadline'
          ? { ...p.venue, deadline: key }
          : { ...p.venue, rebuttalAt: key },
    })
    toast({
      message: `${p.venue.name || '投稿'} ${d.kind === 'deadline' ? '投稿截止' : 'Rebuttal'} 已改到 ${fmtMD(key)}`,
    })
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
      if (p.venue?.deadline) {
        push(p.venue.deadline, { kind: 'deadline', project: p, label: p.venue.name || '投稿截止' })
      }
      if (p.venue?.rebuttalAt) {
        push(p.venue.rebuttalAt, { kind: 'rebuttal', project: p, label: p.venue.name || 'Rebuttal' })
      }
      for (const t of p.todos) {
        push(t.endDate, {
          kind: 'todo',
          project: p,
          todoId: t.id,
          title: t.title || '未命名',
          stageColor: findStage(p.stages, t.stage).color,
          done: t.done,
        })
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
    return map
  }, [projects])

  // Days that carry a marker dot in the jump-to mini calendar.
  const { deadlineDates, todoDates } = useMemo(() => {
    const deadline: Date[] = []
    const todo: Date[] = []
    for (const [key, evs] of byDay) {
      const d = parse(key)
      if (!d) continue
      if (evs.some((e) => e.kind !== 'todo')) deadline.push(d)
      else todo.push(d)
    }
    return { deadlineDates: deadline, todoDates: todo }
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
  const { ddlCount, todoCount } = useMemo(() => {
    let ddl = 0
    let todo = 0
    for (const d of days) {
      if (!isSameMonth(d, anchor)) continue
      const evs = byDay.get(format(d, 'yyyy-MM-dd')) ?? []
      for (const e of evs) {
        if (e.kind === 'todo') todo += 1
        else ddl += 1
      }
    }
    return { ddlCount: ddl, todoCount: todo }
  }, [days, anchor, byDay])

  const isCurMonth = isSameMonth(anchor, new Date())
  const subtitle =
    ddlCount === 0 && todoCount === 0
      ? '本月无到期事项'
      : [
          ddlCount > 0 ? `${ddlCount} 个投稿 / Rebuttal 截止` : null,
          todoCount > 0 ? `${todoCount} 个待办到期` : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    // 11rem = measured chrome above the grid (app header 57px + page paddings +
    // title block) + the bottom page padding — the grid takes every remaining
    // viewport pixel so big screens get a big calendar, not blank space.
    <section aria-label="截止月历" className="flex h-[calc(100dvh-11rem)] min-h-[30rem] flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{subtitle}</p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, -1))}
            aria-label="上个月"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <ChevronLeft size={16} />
          </button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="点击跳到任意日期"
                className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[15px] font-semibold tabular-nums text-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                modifiers={{ hasDeadline: deadlineDates, hasTodo: todoDates }}
                components={{ DayButton: DayWithDot }}
                className="[--cell-size:2.25rem]"
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
            aria-label="下个月"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-panel">
        {/* Weekday header — right-aligned over the date numbers, Apple style. */}
        <div className="grid shrink-0 grid-cols-7 border-b">
          {WEEKDAY_CN.map((w, i) => (
            <div
              key={w}
              className={cn(
                'px-2 py-1.5 text-right text-[11px] font-medium text-faint',
                i < 6 && 'border-r',
              )}
            >
              周{w}
            </div>
          ))}
        </div>

        {/* Week rows stretch evenly to fill the remaining height. */}
        <div
          className="grid min-h-0 flex-1 grid-cols-7"
          style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
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
                  'flex min-h-0 flex-col gap-1 p-1.5 transition-colors',
                  !lastCol && 'border-r',
                  !lastRow && 'border-b',
                  isToday && 'bg-brand-500/[0.06]',
                  dragOverKey === key && 'bg-brand-500/[0.09] ring-1 ring-inset ring-brand-400/60',
                )}
              >
                <div className="flex shrink-0 items-center justify-end">
                  {isToday ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-sm font-semibold tabular-nums text-white">
                      {d.getDate()}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'px-0.5 text-sm tabular-nums',
                        !inMonth
                          ? 'text-muted-foreground/40'
                          : isPast
                            ? 'text-muted-foreground/55'
                            : 'text-foreground',
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
                          dragRef.current =
                            e.kind === 'todo'
                              ? {
                                  kind: 'todo',
                                  projectId: e.project.id,
                                  todoId: e.todoId,
                                  title: e.title,
                                  fromKey: key,
                                }
                              : { kind: e.kind, projectId: e.project.id, fromKey: key }
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

/** Mini month-picker day cell + a dot when the day carries deadlines / todos. */
function DayWithDot(props: ComponentProps<typeof CalendarDayButton>) {
  const m = props.modifiers as Record<string, boolean | undefined>
  const hasDeadline = !!m.hasDeadline
  const hasTodo = !!m.hasTodo
  return (
    <span className="relative flex h-full w-full items-center justify-center">
      <CalendarDayButton {...props} />
      {hasDeadline || hasTodo ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
            hasDeadline ? 'bg-destructive' : 'bg-faint',
          )}
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

  if (e.kind === 'deadline') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${e.label} · 投稿截止 · 拖到别的日期可改期`}
        {...dragProps}
        className="flex w-full cursor-grab items-center gap-1 rounded-[4px] border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-left text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <span aria-hidden className="shrink-0 leading-none">▲</span>
        <span className="min-w-0 truncate">{e.label}</span>
      </button>
    )
  }
  if (e.kind === 'rebuttal') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${e.label} · Rebuttal · 拖到别的日期可改期`}
        {...dragProps}
        className="flex w-full cursor-grab items-center gap-1 rounded-[4px] border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-left text-[11px] font-medium text-warn transition-colors hover:bg-warn/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <span aria-hidden className="shrink-0 leading-none">◆</span>
        <span className="min-w-0 truncate">{e.label}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${e.title} · ${e.project.title || '未命名项目'} · 拖到别的日期可改期`}
      {...dragProps}
      className={cn(
        'flex w-full cursor-grab items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        e.done && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: e.stageColor }}
      />
      <span className={cn('min-w-0 flex-1 truncate text-foreground/90', e.done && 'line-through')}>
        {e.title}
      </span>
    </button>
  )
}
