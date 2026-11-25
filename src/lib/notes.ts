import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { NOTE_MAX_LEVEL, type NoteEntry } from './types'
import { parse } from './date'

/** 日期标题，如「11月25日 星期三」。 */
export function noteDayLabel(date: string): string {
  const d = parse(date)
  return d ? format(d, 'M月d日 EEEE', { locale: zhCN }) : date
}

/** 某一天的条目，保持数组里的先后。 */
export function notesOfDay(notes: NoteEntry[], date: string): NoteEntry[] {
  return notes.filter((n) => n.date === date)
}

/** 一天里是否有可读的内容：有文字，或发出过提示词。只有空行的日期不进入日流。 */
export function dayHasContent(entries: NoteEntry[]): boolean {
  return entries.some((n) => n.text.trim() !== '' || (n.sent?.length ?? 0) > 0)
}

/**
 * 日流里显示的日期：今天总在最前（即使为空），其后是其他有内容的日期，从新到旧。
 * `limit` 只限制今天以外的日期个数，返回值的 `more` 表示是否还有更早的。
 */
export function streamDays(
  notes: NoteEntry[],
  today: string,
  limit: number,
): { days: string[]; more: boolean } {
  const byDay = new Map<string, NoteEntry[]>()
  for (const n of notes) {
    if (n.date === today) continue
    const list = byDay.get(n.date)
    if (list) list.push(n)
    else byDay.set(n.date, [n])
  }
  const others = [...byDay.entries()]
    .filter(([, entries]) => dayHasContent(entries))
    .map(([date]) => date)
    .sort((a, b) => b.localeCompare(a))
  return { days: [today, ...others.slice(0, limit)], more: others.length > limit }
}

/**
 * 新条目在全局数组里的插入位置：`afterId` 那一条之后；没有 `afterId` 时放在这一天最后一条之后，
 * 这一天还没有条目时放在数组末尾。
 */
export function insertionIndex(notes: NoteEntry[], date: string, afterId?: string): number {
  if (afterId) {
    const at = notes.findIndex((n) => n.id === afterId)
    if (at !== -1) return at + 1
  }
  let last = -1
  notes.forEach((n, i) => {
    if (n.date === date) last = i
  })
  return last === -1 ? notes.length : last + 1
}

/**
 * 一条笔记连同它的子条目：同一天里紧随其后、缩进更深的条目，遇到同级或更浅的为止。
 * 转为提示词时一起带走。
 */
export function subtree(notes: NoteEntry[], id: string): NoteEntry[] {
  const root = notes.find((n) => n.id === id)
  if (!root) return []
  const day = notesOfDay(notes, root.date)
  const start = day.findIndex((n) => n.id === id)
  const out = [root]
  for (let i = start + 1; i < day.length && day[i].level > root.level; i++) out.push(day[i])
  return out
}

/** Tab 之后的缩进：不超过上一条加一级，也不超过上限。 */
export function indentLevel(current: number, previousLevel: number | null): number {
  const cap = previousLevel === null ? 0 : Math.min(NOTE_MAX_LEVEL, previousLevel + 1)
  return Math.max(current, Math.min(current + 1, cap))
}

/**
 * 侧栏便签迁移到笔记（Schema 8 之前，便签存在单独的 localStorage 键里）。
 * 返回要建的笔记文字；没有内容或已经迁移过时返回 null。
 */
export function legacyMemoText(memo: string | null, migrated: boolean): string | null {
  if (migrated) return null
  const text = memo?.trim() ?? ''
  return text ? text : null
}
