import { useMemo, useState, type ComponentProps } from 'react'
import {
  addDays,
  addMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { weekStart, parse, today } from '@/lib/date'
import { findStage, type Project } from '@/lib/types'
import { Calendar, CalendarDayButton } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/Button'
import { cn } from '@/lib/cn'

/** Column order is Monday-first, matching the app's week start. */
const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

type EventItem =
  | { kind: 'deadline'; project: Project; label: string }
  | { kind: 'rebuttal'; project: Project; label: string }
  | { kind: 'todo'; project: Project; title: string; stageColor: string; done: boolean }

const ORDER: Record<EventItem['kind'], number> = { deadline: 0, rebuttal: 1, todo: 2 }

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
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const todayIso = today()

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

  // Month grid: whole weeks (Mon-start) covering the anchored month.
  const monthStart = startOfMonth(anchor)
  const gridStart = weekStart(monthStart)
  const weekCount =
    differenceInCalendarWeeks(weekStart(endOfMonth(anchor)), gridStart, { weekStartsOn: 1 }) + 1
  const days = useMemo(
    () => Array.from({ length: weekCount * 7 }, (_, i) => addDays(gridStart, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridStart.getTime(), weekCount],
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft size={16} />
          </button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="点击跳到任意日期"
                className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-base font-semibold tabular-nums text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                weekStartsOn={1}
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        {/* Weekday header — right-aligned over the date numbers, Apple style. */}
        <div className="grid shrink-0 grid-cols-7 border-b">
          {WEEKDAY_CN.map((w, i) => (
            <div
              key={w}
              className={cn(
                'px-2 py-1.5 text-right text-xs font-medium text-muted-foreground',
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
                className={cn(
                  'flex min-h-0 flex-col gap-1 p-1.5',
                  !lastCol && 'border-r',
                  !lastRow && 'border-b',
                  isToday && 'bg-primary/5',
                )}
              >
                <div className="flex shrink-0 items-center justify-end">
                  {isToday ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-sm font-semibold tabular-nums text-primary-foreground">
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
                      <EventChip key={j} e={e} onClick={() => onEdit(e.project)} />
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
            hasDeadline ? 'bg-destructive' : 'bg-muted-foreground',
          )}
        />
      ) : null}
    </span>
  )
}

function EventChip({ e, onClick }: { e: EventItem; onClick: () => void }) {
  if (e.kind === 'deadline') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${e.label} · 投稿截止`}
        className="flex w-full items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-left text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        title={`${e.label} · Rebuttal`}
        className="flex w-full items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-left text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
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
      title={`${e.title} · ${e.project.title || '未命名项目'}`}
      className={cn(
        'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
