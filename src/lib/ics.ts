import type { CalendarSnapshot } from './calendarSnapshot'

/**
 * RFC 5545 calendar for the Apple Calendar subscription. Pure: the Vercel
 * function and the tests call the same code. Type imports only (see
 * calendarSnapshot.ts for why).
 *
 * Every todo with a due date that is not done becomes an all day event.
 * Done todos and todos without a due date are left out.
 */

export const CALENDAR_NAME = 'Research Tracker'

/** Escape a TEXT value (RFC 5545 §3.3.11). Backslash first. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function utf8Len(cp: number): number {
  if (cp < 0x80) return 1
  if (cp < 0x800) return 2
  if (cp < 0x10000) return 3
  return 4
}

/**
 * Fold a content line at 75 octets (RFC 5545 §3.1). Continuation lines start
 * with one space, which counts toward their 75. A multi byte UTF-8 character
 * is never split.
 */
export function foldLine(line: string): string {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0)!)
    if (bytes + n > 75) {
      out.push(cur)
      cur = ' '
      bytes = 1
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n')
}

/** 'YYYY-MM-DD' → 'YYYYMMDD', or null when not a real calendar date. */
export function icsDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${m[1]}${m[2]}${m[3]}`
}

/** The day after a 'YYYYMMDD' date, same format. All day DTEND is exclusive. */
function nextDay(ymd: string): string {
  const dt = new Date(
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)) + 1),
  )
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Stable per todo, so moving a due date updates the same event. */
export function eventUid(projectId: string, todoId: string): string {
  return `${projectId}.${todoId}@research-tracker`
}

export function eventSummary(project: string, title: string): string {
  return `[${project || '未命名项目'}] ${title || '未命名'}`
}

export function buildIcs(snapshot: CalendarSnapshot, updatedAt: Date): string {
  const stamp = icsStamp(updatedAt)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Research Tracker//Calendar Subscription//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT5M',
    'X-PUBLISHED-TTL:PT5M',
  ]
  for (const t of snapshot.todos) {
    if (t.done) continue
    const start = icsDate(t.due)
    if (!start) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(eventUid(t.projectId, t.id))}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${nextDay(start)}`,
      `SUMMARY:${escapeText(eventSummary(t.project, t.title))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
