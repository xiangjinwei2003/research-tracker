import { useMemo, useState } from 'react'
import { addDays, addWeeks, format, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { weekStart, parse, today } from '@/lib/date'
import { findStage, type Project } from '@/lib/types'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { cn } from '@/lib/cn'

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
 * A Monday-start week calendar for the timeline page: each day column lists the
 * deadlines that land on it — submission deadlines (▲) and rebuttals (◆) up top,
 * then todo due-dates. Clicking any entry opens that project.
 */
export function WeekCalendar({ onEdit }: Props) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived)
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const todayIso = today()
  const start = weekStart(anchor)
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start],
  )

  // ISO day -> events falling on it.
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

  const weekKeys = days.map((d) => format(d, 'yyyy-MM-dd'))
  const ddlCount = weekKeys.reduce(
    (n, k) => n + (byDay.get(k)?.filter((e) => e.kind !== 'todo').length ?? 0),
    0,
  )
  const todoCount = weekKeys.reduce(
    (n, k) => n + (byDay.get(k)?.filter((e) => e.kind === 'todo').length ?? 0),
    0,
  )

  const rangeLabel = `${format(start, 'M月d日')} – ${format(addDays(start, 6), 'M月d日')}`
  const isThisWeek = isSameDay(weekStart(new Date()), start)

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
    <section aria-label="本周截止日历" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">本周截止</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((a) => addWeeks(a, -1))}
            aria-label="上一周"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-38 text-center text-sm tabular-nums text-foreground">
            {rangeLabel}
          </span>
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 divide-x divide-border">
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd')
              const isToday = key === todayIso
              const evs = byDay.get(key) ?? []
              return (
                <div key={key} className={cn('min-h-28 p-2', isToday && 'bg-primary/5')}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-1">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isToday ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      周{WEEKDAY_CN[(d.getDay() + 6) % 7]}
                    </span>
                    <span
                      className={cn(
                        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs tabular-nums',
                        isToday
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {evs.map((e, i) => (
                      <EventRow key={i} e={e} onClick={() => onEdit(e.project)} />
                    ))}
                    {evs.length === 0 ? (
                      <li className="px-1 text-xs text-muted-foreground/40">—</li>
                    ) : null}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </section>
  )
}

function EventRow({ e, onClick }: { e: EventItem; onClick: () => void }) {
  if (e.kind === 'deadline') {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          title={`${e.label} · 投稿截止`}
          className="flex w-full items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-1 text-left text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className="shrink-0 leading-none">▲</span>
          <span className="min-w-0 truncate">{e.label}</span>
        </button>
      </li>
    )
  }
  if (e.kind === 'rebuttal') {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          title={`${e.label} · Rebuttal`}
          className="flex w-full items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-left text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
        >
          <span aria-hidden className="shrink-0 leading-none">◆</span>
          <span className="min-w-0 truncate">{e.label}</span>
        </button>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={e.title}
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          e.done && 'opacity-50',
        )}
      >
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: e.stageColor }}
        />
        <span className={cn('min-w-0 truncate text-foreground/80', e.done && 'line-through')}>
          {e.title}
        </span>
      </button>
    </li>
  )
}
