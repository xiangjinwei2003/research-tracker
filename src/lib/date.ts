import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  parseISO,
  isValid,
  startOfWeek,
  addDays,
} from 'date-fns'

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** ISO date `days` after today — the upper bound of a rolling N-day window. */
export function dateFromToday(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

/** Compact Chinese month-day, e.g. 6月7日. */
export function fmtMD(iso: string): string {
  const d = parse(iso)
  return d ? `${d.getMonth() + 1}月${d.getDate()}日` : ''
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

/**
 * Week-relative weekday label for near-term dates, e.g. 本周四 / 下周四 / 下下周一.
 * Weeks start on Monday. Falls back to a dated weekday (6月25日周四) past 下下周.
 * Caller handles today/overdue; this is for forward-looking dates.
 */
export function weekdayLabel(iso: string, todayIso: string): string {
  const d = parse(iso)
  const base = parse(todayIso) ?? new Date()
  if (!d) return ''
  const wd = `周${WEEKDAY_CN[d.getDay()]}`
  const weeks = differenceInCalendarWeeks(d, base, { weekStartsOn: 1 })
  if (weeks < 0) return `${fmtMD(iso)}${wd}` // past: show the date, not 本周
  if (weeks === 0) return `本${wd}`
  if (weeks === 1) return `下${wd}`
  if (weeks === 2) return `下下${wd}`
  return `${fmtMD(iso)}${wd}`
}

/**
 * 任务行上的截止日期文字：逾期写天数，今天、明天直接写，两周内写相对星期，
 * 更远写月日。没有日期返回 null。
 */
export function dueLabel(
  iso: string,
  todayIso: string,
): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' } | null {
  const d = parse(iso)
  const base = parse(todayIso)
  if (!d || !base) return null
  const days = differenceInCalendarDays(d, base)
  if (days < 0) return { text: `逾期 ${-days} 天`, tone: 'overdue' }
  if (days === 0) return { text: '今天', tone: 'today' }
  if (days === 1) return { text: '明天', tone: 'soon' }
  if (days < 14) return { text: weekdayLabel(iso, todayIso), tone: 'soon' }
  return { text: fmtMD(iso), tone: 'later' }
}

export function parse(iso: string): Date | null {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? d : null
}






/** Days between two ISO dates (b - a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = parse(aIso)
  const b = parse(bIso)
  if (!a || !b) return 0
  return differenceInCalendarDays(b, a)
}

/** Monday 00:00 of the week containing `d` (weeks start Monday app-wide). */
export function weekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 })
}

/** Wall-clock HH:mm of an epoch-ms timestamp, e.g. 13:05. */
export function fmtHM(epochMs: number): string {
  return format(new Date(epochMs), 'HH:mm')
}

/** Compact minutes label: 45m → 45 分钟, 90m → 1.5 小时, 120m → 2 小时. */
export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`
  const h = min / 60
  const rounded = Math.round(h * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} 小时`
}
