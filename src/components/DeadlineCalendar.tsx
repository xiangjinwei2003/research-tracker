import { useMemo, useState, type ComponentProps } from 'react'
import { addDays, addWeeks, format, isSameWeek } from 'date-fns'
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
 * A full-width week view: seven day columns, each listing the items due that day
 * (▲ 投稿截止 / ◆ Rebuttal on top, then todos by stage colour). Prev/next weeks,
 * plus a react-day-picker month in a popover on the date label to jump anywhere.
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

  // Days that carry a marker dot in the mini month-picker.
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

  const start = weekStart(anchor)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const weekKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  const ddlCount = weekKeys.reduce(
    (n, k) => n + (byDay.get(k)?.filter((e) => e.kind !== 'todo').length ?? 0),
    0,
  )
  const todoCount = weekKeys.reduce(
    (n, k) => n + (byDay.get(k)?.filter((e) => e.kind === 'todo').length ?? 0),
    0,
  )
  const isThisWeek = isSameWeek(anchor, new Date(), { weekStartsOn: 1 })
  const rangeLabel = `${format(start, 'M月d日')} – ${format(addDays(start, 6), 'M月d日')}`

  const subtitle =
    ddlCount === 0 && todoCount === 0
      ? '本周无到期事项'
      : [
          ddlCount > 0 ? `${ddlCount} 个投稿 / Rebuttal 截止` : null,
          todoCount > 0 ? `${todoCount} 个待办到期` : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <section aria-label="本周截止">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{subtitle}</p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((a) => addWeeks(a, -1))}
            aria-label="上一周"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft size={16} />
          </button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium tabular-nums text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {rangeLabel}
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
            onClick={() => setAnchor((a) => addWeeks(a, 1))}
            aria-label="下一周"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronRight size={16} />
          </button>

          {!isThisWeek ? (
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
              本周
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[52rem] grid-cols-7 divide-x divide-border overflow-hidden rounded-xl border bg-card lg:min-w-0">
          {days.map((d, i) => {
            const key = weekKeys[i]
            const isToday = key === todayIso
            const evs = byDay.get(key) ?? []
            return (
              <div key={key} className={cn('flex min-h-[17rem] flex-col', isToday && 'bg-primary/5')}>
                <div
                  className={cn(
                    'flex items-baseline justify-between gap-1 border-b px-2.5 py-2',
                    isToday ? 'border-primary/25' : 'border-border',
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isToday ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    周{WEEKDAY_CN[i]}
                  </span>
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm tabular-nums',
                      isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground',
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                  {evs.map((e, j) => (
                    <EventChip key={j} e={e} onClick={() => onEdit(e.project)} />
                  ))}
                  {evs.length === 0 ? (
                    <div className="px-1 py-1 text-xs text-muted-foreground/40">—</div>
                  ) : null}
                </div>
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
        className="flex w-full items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-1 text-left text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        className="flex w-full items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-left text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
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
        'flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        e.done && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ background: e.stageColor }}
      />
      <span className={cn('min-w-0 flex-1 line-clamp-2 text-foreground/90', e.done && 'line-through')}>
        {e.title}
      </span>
    </button>
  )
}
