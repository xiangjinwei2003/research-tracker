import { useMemo, useState, type ComponentProps } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useStore } from '@/lib/store'
import { parse, today, fmtMD } from '@/lib/date'
import { findStage, type Project } from '@/lib/types'
import { Calendar, CalendarDayButton } from './ui/calendar'
import { cn } from '@/lib/cn'

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

type EventItem =
  | { kind: 'deadline'; project: Project; label: string }
  | { kind: 'rebuttal'; project: Project; label: string }
  | { kind: 'todo'; project: Project; title: string; stageColor: string; done: boolean }

const ORDER: Record<EventItem['kind'], number> = { deadline: 0, rebuttal: 1, todo: 2 }

interface Props {
  onEdit: (p: Project) => void
}

/**
 * Month calendar of deadlines, built on the shadcn/react-day-picker Calendar:
 * days carry a dot (red = 投稿截止/Rebuttal, grey = 待办到期), and the selected
 * day's items are listed in the agenda beside it. Clicking an item opens it.
 */
export function DeadlineCalendar({ onEdit }: Props) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived)
  const [selected, setSelected] = useState<Date>(() => new Date())
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

  // Days split by marker colour: any 投稿/Rebuttal → red; todo-only → grey.
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

  const selKey = format(selected, 'yyyy-MM-dd')
  const selEvents = byDay.get(selKey) ?? []
  const isToday = selKey === todayIso

  return (
    <section
      aria-label="截止日历"
      className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]"
    >
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(d) => d && setSelected(d)}
        defaultMonth={selected}
        weekStartsOn={1}
        locale={zhCN}
        modifiers={{ hasDeadline: deadlineDates, hasTodo: todoDates }}
        components={{ DayButton: DayWithDot }}
        className="rounded-xl border bg-card [--cell-size:2.5rem]"
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {fmtMD(selKey)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              周{WEEKDAY_CN[selected.getDay()]}
            </span>
          </h3>
          {isToday ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              今天
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {selEvents.length > 0 ? `· ${selEvents.length} 项到期` : ''}
          </span>
        </div>

        {selEvents.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {selEvents.map((e, i) => (
              <EventRow key={i} e={e} onClick={() => onEdit(e.project)} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground/70">
            这天没有到期事项。点日历上带圆点的日期查看当天截止。
          </p>
        )}
      </div>
    </section>
  )
}

/** Day cell + a dot when the day carries deadlines (red) or todos (grey). */
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

function EventRow({ e, onClick }: { e: EventItem; onClick: () => void }) {
  if (e.kind === 'deadline') {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          title={`${e.label} · 投稿截止`}
          className="flex w-full items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className="shrink-0 leading-none">▲</span>
          <span className="min-w-0 flex-1 truncate">{e.label}</span>
          <span className="shrink-0 text-xs font-normal text-destructive/70">投稿截止</span>
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
          className="flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-left text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
        >
          <span aria-hidden className="shrink-0 leading-none">◆</span>
          <span className="min-w-0 flex-1 truncate">{e.label}</span>
          <span className="shrink-0 text-xs font-normal text-amber-600/70 dark:text-amber-400/70">Rebuttal</span>
        </button>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={`${e.title} · ${e.project.title || '未命名项目'}`}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
        <span className="min-w-0 max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
          {e.project.title}
        </span>
      </button>
    </li>
  )
}
