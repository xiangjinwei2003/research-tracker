import { addDays, format } from 'date-fns'
import { parse, weekStart } from './date'
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
  const title = (live ? live.title : session.projectTitle || '').trim()
  const projectTitle = session.projectId
    ? title || '未命名项目'
    : session.label || '自由专注'
  const task = (session.todoTitle || '').trim()
  return {
    session,
    projectTitle,
    color: live?.color || session.color,
    label: task || projectTitle,
    minutes: sessionMinutes(session),
  }
}

/** 时间分配的分组：项目、自定义事项（如「英语」）、自由专注各为一组。 */
export function groupKey(s: FocusSession): string {
  return s.projectId ?? (s.label ? `label:${s.label}` : '__free')
}

/** 一天里某个分组的时长，用于堆叠柱。 */
export interface DaySegment {
  key: string
  color?: string
  minutes: number
}

export interface DayTotal {
  date: Date
  iso: string
  minutes: number
  count: number
  /** 按分组拆分的时长，顺序与本期时间分配一致（时长最多的分组在前）。 */
  segments: DaySegment[]
}

/**
 * One entry per calendar day in [start, end), totalled from `resolved`.
 * `order` lists every group key in `resolved`, most-first; segments follow it
 * so a project keeps the same position in every day's stacked bar.
 */
export function dayTotals(
  resolved: ResolvedSession[],
  start: Date,
  end: Date,
  order: string[],
): DayTotal[] {
  const days: DayTotal[] = []
  for (let d = start; d < end; d = addDays(d, 1)) {
    days.push({ date: d, iso: format(d, 'yyyy-MM-dd'), minutes: 0, count: 0, segments: [] })
  }
  const idx = new Map(days.map((d, i) => [d.iso, i]))
  for (const r of resolved) {
    const i = idx.get(dayKey(r.session.startedAt))
    if (i == null) continue
    const day = days[i]
    day.minutes += r.minutes
    day.count += 1
    const key = groupKey(r.session)
    const seg = day.segments.find((s) => s.key === key)
    if (seg) seg.minutes += r.minutes
    else day.segments.push({ key, color: r.color, minutes: r.minutes })
  }
  const rank = new Map(order.map((k, i) => [k, i]))
  for (const d of days) {
    d.segments.sort((a, b) => rank.get(a.key)! - rank.get(b.key)!)
  }
  return days
}

/** 某个任务在本期的累计时长。 */
export interface TaskShare {
  key: string
  /** 任务标题；分组内没有关联任务的记录合为「未关联任务」。 */
  title: string
  minutes: number
}

export interface ProjectShare {
  key: string
  name: string
  color?: string
  minutes: number
  /** 按任务汇总，时长多的在前。只有自定义事项或自由专注的分组为空。 */
  tasks: TaskShare[]
}

/** Minutes per project over `resolved`, biggest first (自由专注 as its own row). */
export function projectShare(resolved: ResolvedSession[]): ProjectShare[] {
  const map = new Map<string, ProjectShare>()
  const taskMaps = new Map<string, Map<string, TaskShare>>()
  for (const r of resolved) {
    const key = groupKey(r.session)
    const hit = map.get(key)
    if (hit) hit.minutes += r.minutes
    else map.set(key, { key, name: r.projectTitle, color: r.color, minutes: r.minutes, tasks: [] })

    if (!r.session.projectId) continue
    const title = (r.session.todoTitle || '').trim()
    const taskKey = r.session.todoId ?? (title ? `title:${title}` : '__none')
    let tasks = taskMaps.get(key)
    if (!tasks) taskMaps.set(key, (tasks = new Map()))
    const t = tasks.get(taskKey)
    if (t) t.minutes += r.minutes
    else tasks.set(taskKey, { key: taskKey, title: title || '未关联任务', minutes: r.minutes })
  }
  for (const [key, tasks] of taskMaps) {
    // 「未关联任务」固定排在最后。只有它一项时不列出任务，分组那一行已经说明了全部。
    const list = [...tasks.values()].sort(
      (a, b) => Number(a.key === '__none') - Number(b.key === '__none') || b.minutes - a.minutes,
    )
    map.get(key)!.tasks = list.length === 1 && list[0].key === '__none' ? [] : list
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes)
}

/**
 * 一天 24 小时里每个小时的专注分钟数。补记没有真实的开始时刻，不计入。
 * 跨越整点的记录按实际重叠拆到各个小时。
 */
export function hourProfile(resolved: ResolvedSession[]): number[] {
  const hours = new Array<number>(24).fill(0)
  for (const r of resolved) {
    if (r.session.manual) continue
    let t = r.session.startedAt
    const end = r.session.endedAt
    while (t < end) {
      const d = new Date(t)
      const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()
      const sliceEnd = Math.min(end, nextHour)
      hours[d.getHours()] += (sliceEnd - t) / 60_000
      t = sliceEnd
    }
  }
  return hours.map((m) => Math.round(m))
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
    const prev = prevIso ? parse(prevIso) : null
    run = prev && format(addDays(prev, 1), 'yyyy-MM-dd') === iso ? run + 1 : 1
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

export interface PeriodStats {
  /** Sessions inside the period, earliest first. */
  resolved: ResolvedSession[]
  /** Every calendar day of the period, including empty ones (drives the bars). */
  days: DayTotal[]
  minutes: number
  count: number
  /** Minutes in [prevStart, prevEnd) — the 环比 baseline (同期 while the period is in progress). */
  prevMinutes: number
  best: DayTotal | null
  share: ProjectShare[]
  /** 一天 24 小时的时段分布，见 hourProfile。 */
  hours: number[]
  /** 计算日均用的天数：本期已经过去的天数（含今天），过去的时段为全部天数。 */
  elapsedDays: number
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

  const share = projectShare(resolved)
  const days = dayTotals(
    resolved,
    start,
    end,
    share.map((s) => s.key),
  )
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
    best,
    share,
    hours: hourProfile(resolved),
    elapsedDays: days.filter((d) => d.date <= now).length,
  }
}

/**
 * 补记只填日期和时长。今天的补记以现在为结束时刻往前推；过去的日子从当天 0 点开始。
 * 时长超出可用范围、日期在未来或无效时返回给用户看的错误文字。
 */
export function manualSpan(args: {
  iso: string
  minutes: number
  now: number
}): { startedAt: number; endedAt: number } | { error: string } {
  const { iso, minutes, now } = args
  const day = parse(iso)
  if (!day) return { error: '请选择日期' }
  if (!(minutes >= 1)) return { error: '请选择时长' }
  const dayStart = day.getTime()
  const nextDay = addDays(day, 1).getTime()
  const span = minutes * 60_000
  if (dayStart > now) return { error: '不能补记未来的日子' }
  if (now < nextDay) {
    if (now - span < dayStart) return { error: '超过今天已经过去的时长' }
    return { startedAt: now - span, endedAt: now }
  }
  if (dayStart + span > nextDay) return { error: '超过一天的时长' }
  return { startedAt: dayStart, endedAt: dayStart + span }
}

/** 用过的自定义事项名，最近用过的在前，去重。 */
export function recentLabels(sessions: FocusSession[]): string[] {
  const seen = new Set<string>()
  for (const s of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
    if (!s.projectId && s.label) seen.add(s.label)
  }
  return [...seen]
}
