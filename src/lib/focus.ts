import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { weekStart } from './date'
import type { FocusSession, Project } from './types'

/**
 * Aggregation layer for 专注 data. Everything here is a pure function over the
 * persisted session list — the views only lay the numbers out. Keeping the
 * arithmetic here is what makes the KPI definitions (esp. 日均) auditable in one
 * place instead of drifting between components.
 */

/** Wall-clock day key (yyyy-MM-dd) of an epoch-ms timestamp. */
export function dayKey(ms: number): string {
  return format(new Date(ms), 'yyyy-MM-dd')
}

/** Recorded length of one session, floored at 1 minute so it never renders as 0. */
export function sessionMinutes(s: FocusSession): number {
  return Math.max(1, Math.round((s.endedAt - s.startedAt) / 60_000))
}

export interface ResolvedSession {
  session: FocusSession
  /** Live project title when it still exists, else the snapshot; 自由专注 when unbound. */
  projectTitle: string
  color?: string
  /** Display label: the task, else the project, else 自由专注. */
  label: string
  minutes: number
}

export function resolveSession(
  session: FocusSession,
  projectById: Map<string, Project>,
): ResolvedSession {
  const live = session.projectId ? projectById.get(session.projectId) : undefined
  const title = live?.title || session.projectTitle || ''
  return {
    session,
    projectTitle: title || '自由专注',
    color: live?.color || session.color,
    label: session.todoTitle || title || '自由专注',
    minutes: sessionMinutes(session),
  }
}

export interface DayTotal {
  date: Date
  iso: string
  minutes: number
  count: number
}

/** One entry per calendar day in [start, end), totalled from `resolved`. */
export function dayTotals(resolved: ResolvedSession[], start: Date, end: Date): DayTotal[] {
  const days: DayTotal[] = []
  for (let d = start; d < end; d = addDays(d, 1)) {
    days.push({ date: d, iso: format(d, 'yyyy-MM-dd'), minutes: 0, count: 0 })
  }
  const idx = new Map(days.map((d, i) => [d.iso, i]))
  for (const r of resolved) {
    const i = idx.get(dayKey(r.session.startedAt))
    if (i != null) {
      days[i].minutes += r.minutes
      days[i].count += 1
    }
  }
  return days
}

export interface ProjectShare {
  key: string
  name: string
  color?: string
  minutes: number
}

/** Minutes per project over `resolved`, biggest first (自由专注 as its own row). */
export function projectShare(resolved: ResolvedSession[]): ProjectShare[] {
  const map = new Map<string, ProjectShare>()
  for (const r of resolved) {
    const key = r.session.projectId ?? '__free'
    const hit = map.get(key)
    if (hit) hit.minutes += r.minutes
    else map.set(key, { key, name: r.projectTitle, color: r.color, minutes: r.minutes })
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes)
}

/**
 * Days the 日均 figure divides by: for a period still running (the current week
 * or month) only the elapsed days count — 周一 through today — so Monday morning
 * doesn't report a seventh of the week's work. A finished period divides by its
 * full span.
 */
export function elapsedDays(start: Date, end: Date, now: Date): number {
  const span = differenceInCalendarDays(end, start)
  if (now < start) return 0
  if (now >= end) return span
  return Math.min(span, differenceInCalendarDays(now, start) + 1)
}

/**
 * Consecutive days (over ALL history) with at least one session. `current` runs
 * back from today — or yesterday, so a streak isn't declared broken before the
 * day is over — and `longest` is the best run ever recorded.
 */
export function streakDays(
  sessions: FocusSession[],
  now: Date,
): { current: number; longest: number } {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)))
  const todayIso = format(now, 'yyyy-MM-dd')

  let current = 0
  let cursor = days.has(todayIso) ? now : addDays(now, -1)
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  let longest = 0
  let run = 0
  let prevIso = ''
  for (const iso of [...days].sort()) {
    run = prevIso && format(addDays(new Date(prevIso), 1), 'yyyy-MM-dd') === iso ? run + 1 : 1
    if (run > longest) longest = run
    prevIso = iso
  }
  return { current, longest }
}

export interface HeatDay {
  date: Date
  iso: string
  minutes: number
  /** Later than now — rendered as a hole so the grid doesn't promise empty days. */
  future: boolean
}

export interface HeatWeek {
  monday: Date
  /** Non-empty on the first column of each month, e.g. 7月. */
  monthLabel: string
  days: HeatDay[]
}

/** Trailing `weeks` Monday-aligned columns of per-day minutes, oldest first. */
export function heatmapWeeks(sessions: FocusSession[], weeks: number, now: Date): HeatWeek[] {
  const start = addDays(weekStart(now), -7 * (weeks - 1))
  const byIso = new Map<string, number>()
  for (const s of sessions) {
    const iso = dayKey(s.startedAt)
    byIso.set(iso, (byIso.get(iso) ?? 0) + sessionMinutes(s))
  }
  return Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(start, w * 7)
    return {
      monday,
      monthLabel:
        w === 0 || format(monday, 'M') !== format(addDays(monday, -7), 'M')
          ? format(monday, 'M月')
          : '',
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i)
        const iso = format(date, 'yyyy-MM-dd')
        return { date, iso, minutes: byIso.get(iso) ?? 0, future: date > now }
      }),
    }
  })
}

export function allTimeSummary(sessions: FocusSession[]): {
  minutes: number
  count: number
  days: number
} {
  let minutes = 0
  for (const s of sessions) minutes += sessionMinutes(s)
  return {
    minutes,
    count: sessions.length,
    days: new Set(sessions.map((s) => dayKey(s.startedAt))).size,
  }
}

export interface PeriodStats {
  /** Sessions inside the period, earliest first. */
  resolved: ResolvedSession[]
  /** Every calendar day of the period, including empty ones (drives the bars). */
  days: DayTotal[]
  minutes: number
  count: number
  /** Same metric over the preceding period of equal shape — powers the 环比. */
  prevMinutes: number
  avgMinutes: number
  /** How many days `avgMinutes` divided by (see `elapsedDays`). */
  avgDays: number
  best: DayTotal | null
  share: ProjectShare[]
}

/**
 * Everything the stats views need for one period, in one pass. `prevStart` /
 * `prevEnd` describe the comparison period (previous week or month).
 */
export function buildPeriodStats(args: {
  sessions: FocusSession[]
  projectById: Map<string, Project>
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
  now: Date
}): PeriodStats {
  const { sessions, projectById, start, end, prevStart, prevEnd, now } = args
  const startMs = start.getTime()
  const endMs = end.getTime()

  const resolved = sessions
    .filter((s) => s.startedAt >= startMs && s.startedAt < endMs)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => resolveSession(s, projectById))

  let minutes = 0
  for (const r of resolved) minutes += r.minutes

  const prevStartMs = prevStart.getTime()
  const prevEndMs = prevEnd.getTime()
  let prevMinutes = 0
  for (const s of sessions) {
    if (s.startedAt >= prevStartMs && s.startedAt < prevEndMs) prevMinutes += sessionMinutes(s)
  }

  const days = dayTotals(resolved, start, end)
  const avgDays = elapsedDays(start, end, now)
  const best = days.reduce<DayTotal | null>(
    (a, b) => (b.minutes > 0 && (!a || b.minutes > a.minutes) ? b : a),
    null,
  )

  return {
    resolved,
    days,
    minutes,
    count: resolved.length,
    prevMinutes,
    avgMinutes: avgDays > 0 ? Math.round(minutes / avgDays) : 0,
    avgDays,
    best,
    share: projectShare(resolved),
  }
}
