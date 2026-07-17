import { useMemo, useState } from 'react'
import { addDays, addWeeks, format } from 'date-fns'
import { CalendarClock, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { weekStart, fmtHM, fmtMinutes, today } from '@/lib/date'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import type { FocusSession, Project } from '@/lib/types'
import { Container } from './ui/Container'
import { Button } from './ui/Button'

/** Pixel height of one hour row in the week calendar. */
const HOUR_PX = 48
/** Default visible day span; expands when sessions fall outside it. */
const DEFAULT_FROM_H = 8
const DEFAULT_TO_H = 22

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

/** Monday-based column index (0–6) for a date. */
function dayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

interface Resolved {
  session: FocusSession
  /** Live project title/color when the project still exists, else snapshots. */
  projectTitle: string
  color?: string
  /** Block/list label: the task if bound, else the project, else 自由专注. */
  label: string
  minutes: number
}

/**
 * 时间回顾 — a week calendar of recorded focus sessions (类似日历), plus a
 * per-project share breakdown and a per-day record list for the viewed week.
 */
export function Review({ onGoBoard }: { onGoBoard: () => void }) {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const removeSession = useStore((s) => s.removeSession)
  const undo = useStore((s) => s.undo)

  // 0 = current week, -1 = previous, ... Weeks start Monday app-wide.
  const [weekOffset, setWeekOffset] = useState(0)
  const start = useMemo(() => addWeeks(weekStart(new Date()), weekOffset), [weekOffset])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const startMs = start.getTime()
  const endMs = addDays(start, 7).getTime()

  const projectById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  const week: Resolved[] = useMemo(() => {
    const list = sessions
      .filter((s) => s.startedAt >= startMs && s.startedAt < endMs)
      .sort((a, b) => a.startedAt - b.startedAt)
    return list.map((session) => {
      const live = session.projectId ? projectById.get(session.projectId) : undefined
      const projectTitle = live?.title || session.projectTitle || ''
      return {
        session,
        projectTitle: projectTitle || '自由专注',
        color: live?.color || session.color,
        label: session.todoTitle || projectTitle || '自由专注',
        minutes: Math.max(1, Math.round((session.endedAt - session.startedAt) / 60_000)),
      }
    })
  }, [sessions, startMs, endMs, projectById])

  const totalMin = useMemo(() => week.reduce((acc, r) => acc + r.minutes, 0), [week])

  // Share of the week per project (自由专注 grouped as its own row).
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; color?: string; min: number }>()
    for (const r of week) {
      const key = r.session.projectId ?? '__free'
      const e = map.get(key)
      if (e) e.min += r.minutes
      else map.set(key, { name: r.projectTitle, color: r.color, min: r.minutes })
    }
    return [...map.values()].sort((a, b) => b.min - a.min)
  }, [week])

  // Visible hour span: the default window, stretched to cover every session.
  const [fromH, toH] = useMemo(() => {
    let lo = DEFAULT_FROM_H
    let hi = DEFAULT_TO_H
    for (const r of week) {
      const s = new Date(r.session.startedAt)
      const e = new Date(r.session.endedAt)
      lo = Math.min(lo, s.getHours())
      // A session ending on a later day stretches its start day to midnight.
      const endH =
        dayIndex(e) !== dayIndex(s) || e.getDate() !== s.getDate()
          ? 24
          : e.getHours() + (e.getMinutes() > 0 || e.getSeconds() > 0 ? 1 : 0)
      hi = Math.max(hi, endH)
    }
    return [lo, Math.min(24, hi)]
  }, [week])
  const gridH = (toH - fromH) * HOUR_PX

  const todayIso = today()
  const isCurrentWeek = weekOffset === 0
  const now = new Date()
  const nowTop = (now.getHours() + now.getMinutes() / 60 - fromH) * HOUR_PX

  const onRemove = (r: Resolved) => {
    const token = removeSession(r.session.id)
    toast({
      message: `已删除专注记录「${r.label}」`,
      action: { label: '撤销', onClick: () => undo(token) },
    })
  }

  return (
    <Container className="py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            时间回顾
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {week.length > 0
              ? `${isCurrentWeek ? '本周' : '该周'}专注 ${fmtMinutes(totalMin)} · ${week.length} 次`
              : isCurrentWeek
                ? '本周还没有专注记录'
                : '这一周没有专注记录'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="上一周"
            title="上一周"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm tabular-nums text-neutral-700 dark:text-neutral-300">
            {format(start, 'M月d日')} – {format(addDays(start, 6), 'M月d日')}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="下一周"
            title="下一周"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <ChevronRight size={16} />
          </button>
          {!isCurrentWeek ? (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              本周
            </Button>
          ) : null}
        </div>
      </div>

      {week.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
          <CalendarClock size={28} className="mx-auto mb-3 text-neutral-400" />
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {isCurrentWeek ? '本周还没有专注记录' : '这一周没有专注记录'}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
            在「总览」的任务卡片上右键，即可开始 30 或 60 分钟倒计时；完成的专注会按时间落在这里，像日历一样回看每周时间去了哪里。
          </p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={onGoBoard}>
            去总览开始专注
          </Button>
        </div>
      ) : (
        <>
          {/* Per-project share of the week's focus time. */}
          <ul className="mb-6 max-w-xl space-y-2">
            {byProject.map((row) => {
              const pct = totalMin > 0 ? Math.round((row.min / totalMin) * 100) : 0
              const fill = row.color
                ? `color-mix(in oklab, ${row.color} 55%, transparent)`
                : 'var(--color-neutral-400)'
              return (
                <li key={row.name} className="flex items-center gap-3">
                  <span
                    title={row.name}
                    className="w-28 shrink-0 truncate text-xs text-neutral-600 dark:text-neutral-300"
                  >
                    {row.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/70">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: fill }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                    {fmtMinutes(row.min)}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Week calendar. */}
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div
                className="grid"
                style={{ gridTemplateColumns: '3.25rem repeat(7, minmax(0, 1fr))' }}
              >
                <div />
                {days.map((d, i) => {
                  const isToday = format(d, 'yyyy-MM-dd') === todayIso
                  return (
                    <div
                      key={i}
                      className={cn(
                        'pb-2 text-center text-xs',
                        isToday
                          ? 'font-semibold text-brand-600 dark:text-brand-300'
                          : 'text-neutral-500 dark:text-neutral-400',
                      )}
                    >
                      周{WEEKDAY_CN[i]}{' '}
                      <span className="tabular-nums">{format(d, 'M/d')}</span>
                    </div>
                  )
                })}
              </div>
              <div
                className="grid border-y border-neutral-200/80 dark:border-neutral-800/80"
                style={{ gridTemplateColumns: '3.25rem repeat(7, minmax(0, 1fr))' }}
              >
                {/* Hour gutter. */}
                <div className="relative" style={{ height: gridH }}>
                  {Array.from({ length: toH - fromH + 1 }, (_, i) => fromH + i).map((h) => (
                    <span
                      key={h}
                      className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500"
                      style={{ top: (h - fromH) * HOUR_PX }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
                {days.map((d, i) => {
                  const isToday = format(d, 'yyyy-MM-dd') === todayIso
                  const rows = week.filter((r) => dayIndex(new Date(r.session.startedAt)) === i)
                  return (
                    <div
                      key={i}
                      className={cn(
                        'relative border-l border-neutral-200/70 dark:border-neutral-800/70',
                        isToday && 'bg-brand-50/40 dark:bg-brand-950/15',
                      )}
                      style={{ height: gridH }}
                    >
                      {Array.from({ length: toH - fromH - 1 }, (_, k) => fromH + k + 1).map(
                        (h) => (
                          <div
                            key={h}
                            aria-hidden
                            className="absolute inset-x-0 border-t border-neutral-200/50 dark:border-neutral-800/50"
                            style={{ top: (h - fromH) * HOUR_PX }}
                          />
                        ),
                      )}
                      {rows.map((r) => {
                        const s = new Date(r.session.startedAt)
                        const top = (s.getHours() + s.getMinutes() / 60 - fromH) * HOUR_PX
                        const height = Math.max(
                          18,
                          Math.min((r.minutes / 60) * HOUR_PX, gridH - top),
                        )
                        const accent = r.color || 'var(--color-neutral-400)'
                        const timeStr = `${fmtHM(r.session.startedAt)}–${fmtHM(r.session.endedAt)}`
                        return (
                          <div
                            key={r.session.id}
                            title={`${timeStr} · ${r.projectTitle}${r.session.todoTitle ? ` · ${r.session.todoTitle}` : ''} · ${fmtMinutes(r.minutes)}${r.session.completed ? '' : '（提前结束）'}`}
                            className="absolute inset-x-1 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-[11px] leading-tight text-neutral-700 dark:text-neutral-200"
                            style={{
                              top,
                              height,
                              borderLeftColor: accent,
                              background: `color-mix(in oklab, ${accent} 18%, transparent)`,
                            }}
                          >
                            <div className="truncate font-medium">{r.label}</div>
                            {height >= 34 ? (
                              <div className="truncate tabular-nums text-[10px] text-neutral-500 dark:text-neutral-400">
                                {timeStr}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      {isCurrentWeek && isToday && nowTop >= 0 && nowTop <= gridH ? (
                        <div
                          aria-hidden
                          className="absolute inset-x-0 z-10 border-t border-brand-500"
                          style={{ top: nowTop }}
                        >
                          <span className="absolute -left-[3px] -top-[3px] h-[5px] w-[5px] rounded-full bg-brand-500" />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Per-day record list (delete = the only way to fix a mis-record). */}
          <section aria-label="全部记录" className="mt-8">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              全部记录
            </h3>
            <div className="mt-2 space-y-4">
              {days.map((d, i) => {
                const rows = week.filter(
                  (r) => dayIndex(new Date(r.session.startedAt)) === i,
                )
                if (rows.length === 0) return null
                return (
                  <div key={i}>
                    <h4 className="text-xs font-medium tabular-nums text-neutral-400 dark:text-neutral-500">
                      {format(d, 'M月d日')} 周{WEEKDAY_CN[i]}
                    </h4>
                    <ul className="mt-1.5 space-y-1">
                      {rows.map((r) => (
                        <li
                          key={r.session.id}
                          className="group flex items-center gap-3 rounded-md px-1 py-1 text-sm hover:bg-neutral-100/70 dark:hover:bg-neutral-900/60"
                        >
                          <span className="w-24 shrink-0 tabular-nums text-xs text-neutral-500 dark:text-neutral-400">
                            {fmtHM(r.session.startedAt)}–{fmtHM(r.session.endedAt)}
                          </span>
                          <span className="w-20 shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                            {fmtMinutes(r.minutes)}
                            {r.session.completed ? '' : ' · 提前'}
                          </span>
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: r.color || 'var(--color-neutral-400)' }}
                          />
                          <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                            {r.label}
                            {r.session.todoTitle && r.projectTitle !== '自由专注' ? (
                              <span className="text-neutral-400 dark:text-neutral-500">
                                {' '}
                                · {r.projectTitle}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemove(r)}
                            aria-label="删除这条专注记录"
                            title="删除记录"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-200/70 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </Container>
  )
}
