import {
  differenceInCalendarDays,
  format,
  parseISO,
  isValid,
  startOfMonth,
  addMonths,
  addDays,
  differenceInCalendarMonths,
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

export function parse(iso: string): Date | null {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? d : null
}

export function fmtShort(iso: string): string {
  const d = parse(iso)
  return d ? format(d, 'MMM d, yyyy') : ''
}

export function fmtMonth(iso: string): string {
  const d = parse(iso)
  return d ? format(d, 'MMM yyyy') : ''
}

export function daysUntil(iso: string): number | null {
  const d = parse(iso)
  if (!d) return null
  return differenceInCalendarDays(d, new Date())
}

export function countdownLabel(days: number): {
  text: string
  tone: 'past' | 'urgent' | 'soon' | 'far'
} {
  if (days < 0) return { text: `逾期 ${-days} 天`, tone: 'past' }
  if (days === 0) return { text: '今天到期', tone: 'urgent' }
  if (days <= 7) return { text: `还剩 ${days} 天`, tone: 'urgent' }
  if (days <= 30) return { text: `还剩 ${days} 天`, tone: 'soon' }
  return { text: `还剩 ${days} 天`, tone: 'far' }
}

/** Build a month grid from earliest to latest, inclusive, padded by 1 month on each side. */
export function monthGrid(allDates: string[]): { start: Date; months: Date[] } {
  const parsed = allDates.map(parse).filter((d): d is Date => d != null)
  const now = new Date()
  if (parsed.length === 0) {
    const start = startOfMonth(addMonths(now, -1))
    return { start, months: Array.from({ length: 6 }, (_, i) => addMonths(start, i)) }
  }
  const min = parsed.reduce((a, b) => (a < b ? a : b))
  const max = parsed.reduce((a, b) => (a > b ? a : b))
  const start = startOfMonth(addMonths(min < now ? min : now, -1))
  const end = startOfMonth(addMonths(max > now ? max : now, 1))
  const span = differenceInCalendarMonths(end, start) + 1
  const months = Array.from({ length: span }, (_, i) => addMonths(start, i))
  return { start, months }
}

/** Days between two ISO dates (b - a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = parse(aIso)
  const b = parse(bIso)
  if (!a || !b) return 0
  return differenceInCalendarDays(b, a)
}
