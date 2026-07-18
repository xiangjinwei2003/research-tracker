import { useMemo, useState, type ReactNode } from 'react'
import { addDays, addMonths, format, startOfMonth } from 'date-fns'
import { weekStart, fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { FocusSession, Project } from '@/lib/types'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const
/** Rolling window of the contribution heatmap, in weeks (~4 months). */
const HEATMAP_WEEKS = 16
/** Muted indigo used by all single-hue charts (same as 本周分布). */
const CHART_BAR = 'bg-[oklch(0.55_0.12_277)]/75 dark:bg-[oklch(0.6_0.11_277)]/80'

interface Props {
  sessions: FocusSession[]
  projectById: Map<string, Project>
  /** Monday 00:00 of the week the Review page is currently showing. */
  anchor: Date
}

interface DayTotal {
  date: Date
  minutes: number
}

function sessionMinutes(s: FocusSession): number {
  return Math.max(1, Math.round((s.endedAt - s.startedAt) / 60_000))
}

/** Big-number split for KPI tiles: 45 → (45, 分钟); 96 → (1.6, 小时). */
function bigDuration(min: number): { value: string; unit: string } {
  if (min < 60) return { value: `${min}`, unit: '分钟' }
  const h = Math.round((min / 60) * 10) / 10
  return { value: Number.isInteger(h) ? h.toFixed(0) : `${h}`, unit: '小时' }
}

function Tile({
  label,
  minutes,
  sub,
}: {
  label: string
  minutes: number
  sub: ReactNode
}) {
  const { value, unit } = bigDuration(minutes)
  return (
    <div className="rounded-xl bg-neutral-100/70 p-4 dark:bg-neutral-900/50">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold leading-none tabular-nums text-neutral-900 dark:text-neutral-100">
          {value}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{unit}</span>
      </div>
      <div className="mt-1.5 truncate text-xs text-neutral-400 dark:text-neutral-500">{sub}</div>
    </div>
  )
}

/** vs-previous-period delta, styled like the reference dashboards' % chips. */
function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  if (prev === 0 && cur === 0) return <>—</>
  if (prev === 0) return <>{label} · 上期无记录</>
  const pct = Math.round(((cur - prev) / prev) * 100)
  return (
    <span
      className={cn(
        pct > 0 && 'text-emerald-600 dark:text-emerald-400',
        pct < 0 && 'text-orange-600 dark:text-orange-400',
      )}
    >
      {label} {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

/**
 * 专注统计 — KPI tiles, per-day bars, per-project donut and a contribution
 * heatmap, aggregated from focus sessions. 周 scope follows the week the page
 * is viewing; 月 scope is the month containing that week's Monday.
 */
export function FocusStats({ sessions, projectById, anchor }: Props) {
  const [scope, setScope] = useState<'week' | 'month'>('week')
  const now = new Date()
  const todayIso = format(now, 'yyyy-MM-dd')

  const range = useMemo(() => {
    if (scope === 'week') {
      return {
        start: anchor,
        end: addDays(anchor, 7),
        prevStart: addDays(anchor, -7),
        prevEnd: anchor,
        deltaLabel: '较上周',
        totalLabel: '本周专注',
        centerLabel: '本周',
      }
    }
    const start = startOfMonth(anchor)
    return {
      start,
      end: addMonths(start, 1),
      prevStart: addMonths(start, -1),
      prevEnd: start,
      deltaLabel: '较上月',
      totalLabel: `${format(start, 'M月')}专注`,
      centerLabel: format(start, 'M月'),
    }
  }, [scope, anchor])

  const inRange = (t: number, s: Date, e: Date) => t >= s.getTime() && t < e.getTime()

  const scoped = useMemo(
    () => sessions.filter((s) => inRange(s.startedAt, range.start, range.end)),
    [sessions, range],
  )
  const prevTotal = useMemo(
    () =>
      sessions
        .filter((s) => inRange(s.startedAt, range.prevStart, range.prevEnd))
        .reduce((acc, s) => acc + sessionMinutes(s), 0),
    [sessions, range],
  )
  const total = useMemo(() => scoped.reduce((a, s) => a + sessionMinutes(s), 0), [scoped])

  // Per-day totals across the scope (drives the bar chart + 单日最高).
  const perDay: DayTotal[] = useMemo(() => {
    const days: DayTotal[] = []
    for (let d = range.start; d < range.end; d = addDays(d, 1)) {
      days.push({ date: d, minutes: 0 })
    }
    const idx = new Map(days.map((d, i) => [format(d.date, 'yyyy-MM-dd'), i]))
    for (const s of scoped) {
      const i = idx.get(format(new Date(s.startedAt), 'yyyy-MM-dd'))
      if (i != null) days[i].minutes += sessionMinutes(s)
    }
    return days
  }, [scoped, range])

  const best = useMemo(
    () => perDay.reduce((a, b) => (b.minutes > a.minutes ? b : a), perDay[0]),
    [perDay],
  )

  // 日均: current period averages over days elapsed so far, past over full span.
  const avg = useMemo(() => {
    const spanDays = perDay.length
    const isCurrent = now >= range.start && now < range.end
    const elapsed = isCurrent
      ? Math.min(spanDays, Math.floor((+now - +range.start) / 86_400_000) + 1)
      : spanDays
    return { minutes: elapsed > 0 ? Math.round(total / elapsed) : 0, days: elapsed }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, perDay.length, range])

  // Streak over ALL sessions: consecutive days with ≥1 record, alive if it
  // reaches today or yesterday. Plus the all-time longest run.
  const streak = useMemo(() => {
    const days = new Set(sessions.map((s) => format(new Date(s.startedAt), 'yyyy-MM-dd')))
    let cur = 0
    let cursor = days.has(todayIso) ? now : addDays(now, -1)
    while (days.has(format(cursor, 'yyyy-MM-dd'))) {
      cur += 1
      cursor = addDays(cursor, -1)
    }
    const sorted = [...days].sort()
    let longest = 0
    let run = 0
    let prevIso = ''
    for (const iso of sorted) {
      run = prevIso && format(addDays(new Date(prevIso), 1), 'yyyy-MM-dd') === iso ? run + 1 : 1
      longest = Math.max(longest, run)
      prevIso = iso
    }
    return { cur, longest }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, todayIso])

  // Per-project share of the scope (自由专注 grouped as its own slice).
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; color?: string; min: number }>()
    for (const s of scoped) {
      const live = s.projectId ? projectById.get(s.projectId) : undefined
      const key = s.projectId ?? '__free'
      const e = map.get(key)
      const min = sessionMinutes(s)
      if (e) e.min += min
      else {
        map.set(key, {
          name: live?.title || s.projectTitle || '自由专注',
          color: live?.color || s.color,
          min,
        })
      }
    }
    return [...map.values()].sort((a, b) => b.min - a.min)
  }, [scoped, projectById])

  // Contribution heatmap: minutes per day over the trailing window, all time.
  const heatmap = useMemo(() => {
    const start = addDays(weekStart(now), -7 * (HEATMAP_WEEKS - 1))
    const byIso = new Map<string, number>()
    for (const s of sessions) {
      const iso = format(new Date(s.startedAt), 'yyyy-MM-dd')
      byIso.set(iso, (byIso.get(iso) ?? 0) + sessionMinutes(s))
    }
    const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => {
      const monday = addDays(start, w * 7)
      return {
        monday,
        newMonth:
          w === 0 || format(monday, 'M') !== format(addDays(monday, -7), 'M')
            ? format(monday, 'M月')
            : '',
        days: Array.from({ length: 7 }, (_, i) => {
          const d = addDays(monday, i)
          return { date: d, minutes: byIso.get(format(d, 'yyyy-MM-dd')) ?? 0, future: d > now }
        }),
      }
    })
    return weeks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, todayIso])

  const allTime = useMemo(() => {
    const min = sessions.reduce((a, s) => a + sessionMinutes(s), 0)
    const days = new Set(sessions.map((s) => format(new Date(s.startedAt), 'yyyy-MM-dd'))).size
    return { min, count: sessions.length, days }
  }, [sessions])

  const barMax = Math.max(30, ...perDay.map((d) => d.minutes))
  const isWeek = scope === 'week'

  /* Donut geometry: each slice carries its fraction + accumulated offset. */
  const R = 52
  const C = 2 * Math.PI * R
  const gap = byProject.length > 1 ? C * 0.02 : 0
  const segments = useMemo(() => {
    const out: ((typeof byProject)[number] & { frac: number; offset: number })[] = []
    let acc = 0
    for (const p of byProject) {
      const frac = total > 0 ? p.min / total : 0
      out.push({ ...p, frac, offset: acc })
      acc += frac
    }
    return out
  }, [byProject, total])

  return (
    <section aria-label="专注统计" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">专注统计</h3>
        <div
          className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900"
          role="tablist"
          aria-label="统计范围"
        >
          {(['week', 'month'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                scope === s
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-neutral-800 dark:text-brand-300'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              )}
            >
              {s === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles. */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={range.totalLabel}
          minutes={total}
          sub={<Delta cur={total} prev={prevTotal} label={range.deltaLabel} />}
        />
        <Tile label="日均专注" minutes={avg.minutes} sub={`按 ${avg.days} 天计`} />
        <Tile
          label="单日最高"
          minutes={best?.minutes ?? 0}
          sub={
            best && best.minutes > 0
              ? `${format(best.date, 'M月d日')} 周${WEEKDAY_CN[(best.date.getDay() + 6) % 7]}`
              : '—'
          }
        />
        <div className="rounded-xl bg-neutral-100/70 p-4 dark:bg-neutral-900/50">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">连续专注</div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-semibold leading-none tabular-nums text-neutral-900 dark:text-neutral-100">
              {streak.cur}
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">天</span>
          </div>
          <div className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            最长 {streak.longest} 天
          </div>
        </div>
      </div>

      {/* Daily bars + per-project donut. */}
      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_310px]">
        <div>
          <h4 className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
            每日专注时长
          </h4>
          <div className="mt-3 flex h-[150px] items-end gap-1.5 sm:gap-2">
            {perDay.map((d, i) => {
              const iso = format(d.date, 'yyyy-MM-dd')
              const isToday = iso === todayIso
              const h = d.minutes > 0 ? Math.max(6, (d.minutes / barMax) * 100) : 0
              const dayLabel = isWeek
                ? `周${WEEKDAY_CN[i]}`
                : [1, 5, 10, 15, 20, 25, 30].includes(d.date.getDate())
                  ? `${d.date.getDate()}`
                  : ''
              return (
                <div
                  key={iso}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 self-stretch"
                  title={`${format(d.date, 'M月d日')} · ${d.minutes > 0 ? fmtMinutes(d.minutes) : '无记录'}`}
                >
                  {isWeek && d.minutes > 0 ? (
                    <span className="text-[10px] tabular-nums leading-none text-neutral-400 dark:text-neutral-500">
                      {fmtMinutes(d.minutes)}
                    </span>
                  ) : null}
                  <div className="flex w-full flex-1 items-end justify-center">
                    {d.minutes > 0 ? (
                      <div
                        className={cn(
                          'w-full rounded-full',
                          isWeek ? 'max-w-8' : 'max-w-[7px]',
                          isToday ? 'bg-brand-500 dark:bg-brand-400' : CHART_BAR,
                        )}
                        style={{ height: `${h}%` }}
                      />
                    ) : (
                      <div
                        className={cn(
                          'h-1 w-full rounded-full bg-neutral-200/80 dark:bg-neutral-800/80',
                          isWeek ? 'max-w-8' : 'max-w-[7px]',
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      'h-3.5 text-[10px] leading-none',
                      isToday
                        ? 'font-semibold text-brand-600 dark:text-brand-300'
                        : 'text-neutral-400 dark:text-neutral-500',
                    )}
                  >
                    {dayLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium text-neutral-400 dark:text-neutral-500">项目占比</h4>
          {total > 0 ? (
            <div className="mt-3 flex items-center gap-5">
              <div className="relative shrink-0">
                <svg width={128} height={128} viewBox="0 0 128 128" className="-rotate-90">
                  {segments.map((s, i) => (
                    <circle
                      key={i}
                      cx={64}
                      cy={64}
                      r={R}
                      fill="none"
                      stroke={s.color || 'var(--color-neutral-400)'}
                      strokeWidth={11}
                      strokeDasharray={`${Math.max(0, C * s.frac - gap)} ${C}`}
                      strokeDashoffset={-C * s.offset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-semibold leading-none tabular-nums text-neutral-900 dark:text-neutral-100">
                    {bigDuration(total).value}
                    <span className="ml-0.5 text-[10px] font-normal text-neutral-500">
                      {bigDuration(total).unit}
                    </span>
                  </span>
                  <span className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                    {range.centerLabel}
                  </span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {segments.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: s.color || 'var(--color-neutral-400)' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-neutral-600 dark:text-neutral-300">
                      {s.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                      {fmtMinutes(s.min)}
                    </span>
                    <span className="w-9 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                      {Math.round(s.frac * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
              该时段没有专注记录
            </p>
          )}
        </div>
      </div>

      {/* Contribution heatmap over the trailing ~4 months. */}
      <div className="mt-7">
        <h4 className="text-xs font-medium text-neutral-400 dark:text-neutral-500">专注热力图</h4>
        <div className="mt-3 overflow-x-auto">
          <div className="inline-flex gap-1">
            {/* Weekday gutter (sparse, GitHub-style). */}
            <div className="mr-1 flex flex-col gap-1 pt-[18px]">
              {WEEKDAY_CN.map((w, i) => (
                <span
                  key={w}
                  className="flex h-3 w-4 items-center text-[9px] leading-none text-neutral-400 dark:text-neutral-500"
                >
                  {i % 2 === 0 ? w : ''}
                </span>
              ))}
            </div>
            {heatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                <span className="h-3.5 overflow-visible whitespace-nowrap text-[9px] leading-none text-neutral-400 dark:text-neutral-500">
                  {week.newMonth}
                </span>
                {week.days.map((d, di) => (
                  <span
                    key={di}
                    title={
                      d.future
                        ? undefined
                        : `${format(d.date, 'M月d日')} · ${d.minutes > 0 ? fmtMinutes(d.minutes) : '无记录'}`
                    }
                    className={cn(
                      'h-3 w-3 rounded-[4px]',
                      d.future
                        ? 'opacity-0'
                        : d.minutes === 0
                          ? 'bg-neutral-200/70 dark:bg-neutral-800/70'
                          : d.minutes < 30
                            ? 'bg-brand-200 dark:bg-brand-900'
                            : d.minutes < 60
                              ? 'bg-brand-300 dark:bg-brand-700'
                              : d.minutes < 120
                                ? 'bg-brand-500 dark:bg-brand-500'
                                : 'bg-brand-600 dark:bg-brand-400',
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          累计专注 {fmtMinutes(allTime.min)} · {allTime.count} 次 · 覆盖 {allTime.days} 天
        </p>
      </div>
    </section>
  )
}
