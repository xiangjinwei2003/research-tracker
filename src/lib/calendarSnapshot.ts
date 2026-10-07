import type { Project } from './types'

/**
 * What the browser uploads for the Apple Calendar subscription. Whitelisted
 * fields only: notes, priority and everything else never leave the device.
 *
 * Imported at runtime by the Vercel function (api/), so this file must not
 * import anything except types: Node ESM there cannot resolve extensionless
 * or `@/` specifiers.
 */
export interface CalendarTodo {
  id: string
  projectId: string
  /** Project title. */
  project: string
  title: string
  /** YYYY-MM-DD, or '' when the todo has no due date. */
  due: string
  done: boolean
}

export interface CalendarSnapshot {
  v: 1
  todos: CalendarTodo[]
}

/**
 * Only what the calendar shows: todos with a due date that are not done, from
 * projects that are not archived (matching the in-app calendar view). Less
 * data stored, and edits that cannot change the calendar leave the snapshot
 * identical, so the client can skip the upload.
 */
export function buildSnapshot(projects: Project[]): CalendarSnapshot {
  const todos: CalendarTodo[] = []
  for (const p of projects) {
    if (p.archived) continue
    for (const t of p.todos) {
      if (t.done || !t.endDate) continue
      todos.push({
        id: t.id,
        projectId: p.id,
        project: p.title,
        title: t.title,
        due: t.endDate,
        done: t.done,
      })
    }
  }
  return { v: 1, todos }
}

/**
 * Server side validation of an uploaded body. Copies whitelisted fields into
 * fresh objects; any unexpected shape is rejected with a reason.
 */
export function parseSnapshot(raw: unknown): { ok: true; snapshot: CalendarSnapshot } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'body is not an object' }
  const obj = raw as Record<string, unknown>
  if (obj.v !== 1) return { ok: false, reason: 'unsupported snapshot version' }
  if (!Array.isArray(obj.todos)) return { ok: false, reason: 'todos is not an array' }
  const todos: CalendarTodo[] = []
  for (const [i, item] of obj.todos.entries()) {
    if (!item || typeof item !== 'object') return { ok: false, reason: `todos[${i}] is not an object` }
    const t = item as Record<string, unknown>
    for (const k of ['id', 'projectId', 'project', 'title', 'due'] as const) {
      if (typeof t[k] !== 'string') return { ok: false, reason: `todos[${i}].${k} is not a string` }
    }
    if (typeof t.done !== 'boolean') return { ok: false, reason: `todos[${i}].done is not a boolean` }
    todos.push({
      id: t.id as string,
      projectId: t.projectId as string,
      project: t.project as string,
      title: t.title as string,
      due: t.due as string,
      done: t.done,
    })
  }
  return { ok: true, snapshot: { v: 1, todos } }
}
