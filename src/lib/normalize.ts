import type {
  Project,
  Todo,
  Collaborator,
  AppState,
  StageDef,
  Venue,
  FocusSession,
  ActiveTimer,
  NoteEntry,
  NoteSent,
  AnalysisRecord,
} from './types'
import {
  defaultStages,
  PROJECT_COLOR_PRESETS,
  LEGACY_PROJECT_COLOR_PRESETS,
  PROJECT_TAG_ORDER,
  NOTE_MAX_LEVEL,
  ANALYSIS_KEEP,
} from './types'
import { uid } from './id'
import { today } from './date'

export const SCHEMA_VERSION = 9

const COLOR_FN = /^(oklch|oklab|lab|lch|rgb|rgba|hsl|hsla|hwb|color)\(/i
const COLOR_BAD = /url\s*\(|image\s*\(|image-set\s*\(|-moz-binding/i

/** Keep a single concrete color. Drop CSS url() and extra layers. */
export function sanitizeColor(v: unknown, fallback = ''): string {
  if (typeof v !== 'string') return fallback
  const s = v
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\\[0-9a-fA-F]{1,6}\s?|\\./g, '')
    .trim()
  if (!s) return fallback
  if (COLOR_BAD.test(s)) return fallback
  if (/^[a-z]+$/i.test(s)) return s
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s
  if (COLOR_FN.test(s) && s.endsWith(')') && s.indexOf(')') === s.lastIndexOf(')')) return s
  return fallback
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function stamp(): string {
  return new Date().toISOString()
}

function normalizeStage(raw: unknown): StageDef {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = asStr(s.name, '未命名阶段')
  return {
    id: asStr(s.id, '') || uid(),
    name,
    shortLabel: asStr(s.shortLabel, name),
    color: sanitizeColor(s.color, 'oklch(0.70 0.02 250)'),
  }
}

function normalizeTodo(raw: unknown, validIds: Set<string>, projectStage: string): Todo {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const todo: Todo = {
    id: asStr(t.id, '') || uid(),
    title: asStr(t.title, ''),
    endDate: asStr(t.endDate, ''),
    done: !!t.done,
    stage: typeof t.stage === 'string' && validIds.has(t.stage) ? t.stage : projectStage,
  }
  if (t.priority === 'high' || t.priority === 'normal' || t.priority === 'low') todo.priority = t.priority
  if (t.inWeek) todo.inWeek = true
  if (t.pending) todo.pending = true
  if (typeof t.notes === 'string') todo.notes = t.notes
  if (todo.done && typeof t.doneAt === 'string' && t.doneAt) todo.doneAt = t.doneAt
  return todo
}

function normalizeCollaborator(raw: unknown): Collaborator {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const role = c.role
  return {
    id: asStr(c.id, '') || uid(),
    name: asStr(c.name, ''),
    role:
      role === 'advisor' || role === 'coauthor' || role === 'student' || role === 'other'
        ? role
        : 'coauthor',
    waitingFor: asStr(c.waitingFor, ''),
  }
}

function normalizeVenue(raw: unknown): Venue | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as Record<string, unknown>
  const venue: Venue = { name: asStr(v.name, ''), deadline: asStr(v.deadline, '') }
  if (typeof v.rebuttalAt === 'string') venue.rebuttalAt = v.rebuttalAt
  return venue
}

export function normalizeProject(raw: unknown): Project {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const stages: StageDef[] =
    Array.isArray(p.stages) && p.stages.length > 0 ? p.stages.map(normalizeStage) : defaultStages()
  const validIds = new Set(stages.map((s) => s.id))
  const fallbackStage = stages[0].id
  const projectStage =
    typeof p.stage === 'string' && validIds.has(p.stage) ? p.stage : fallbackStage

  const rawTodos: unknown[] =
    Array.isArray(p.todos) && p.todos.length > 0
      ? p.todos
      : Array.isArray(p.milestones)
        ? p.milestones
        : []
  const todos = rawTodos.map((t) => normalizeTodo(t, validIds, projectStage))

  const now = stamp()
  const tags = Array.isArray(p.tags)
    ? PROJECT_TAG_ORDER.filter((tag) => (p.tags as unknown[]).includes(tag))
    : []
  return {
    id: asStr(p.id, '') || uid(),
    title: asStr(p.title, ''),
    description: asStr(p.description, ''),
    ...(tags.length ? { tags } : {}),
    color: sanitizeColor(p.color, ''),
    stage: projectStage,
    stages,
    startDate: asStr(p.startDate, today()),
    venue: normalizeVenue(p.venue),
    collaborators: Array.isArray(p.collaborators) ? p.collaborators.map(normalizeCollaborator) : [],
    todos,
    notes: asStr(p.notes, ''),
    archived: !!p.archived,
    ...(typeof p.folder === 'string' && p.folder.trim() ? { folder: p.folder.trim() } : {}),
    createdAt: asStr(p.createdAt, now),
    updatedAt: asStr(p.updatedAt, now),
  }
}

export function withDefaultColors(projects: Project[]): Project[] {
  return projects.map((p, i) =>
    p.color ? p : { ...p, color: PROJECT_COLOR_PRESETS[i % PROJECT_COLOR_PRESETS.length] },
  )
}

/** Rewrite a project only when its color is the old auto slot at that index. */
export function respreadAutoColors(projects: Project[]): Project[] {
  const n = LEGACY_PROJECT_COLOR_PRESETS.length
  return projects.map((p, i) =>
    p.color === LEGACY_PROJECT_COLOR_PRESETS[i % n]
      ? { ...p, color: PROJECT_COLOR_PRESETS[i % PROJECT_COLOR_PRESETS.length] }
      : p,
  )
}

/** Largest instant `Date` can represent. One millisecond past this makes `format` throw. */
const MAX_DATE_MS = 8_640_000_000_000_000

function clockMs(value: unknown): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_DATE_MS
    ? value
    : NaN
}

export function normalizeSession(raw: unknown): FocusSession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const startedAt = clockMs(s.startedAt)
  const endedAt = clockMs(s.endedAt)
  const plannedMin =
    typeof s.plannedMin === 'number' && Number.isFinite(s.plannedMin) ? s.plannedMin : NaN
  if (!(startedAt > 0) || !(endedAt > startedAt) || !(plannedMin > 0)) return null
  const session: FocusSession = {
    id: asStr(s.id, '') || uid(),
    plannedMin,
    startedAt,
    endedAt,
    completed: !!s.completed,
  }
  if (s.manual === true) session.manual = true
  if (typeof s.label === 'string' && s.label.trim()) session.label = s.label.trim()
  if (typeof s.note === 'string' && s.note.trim()) session.note = s.note.trim()
  if (typeof s.projectId === 'string') session.projectId = s.projectId
  if (typeof s.todoId === 'string') session.todoId = s.todoId
  if (typeof s.projectTitle === 'string') session.projectTitle = s.projectTitle
  if (typeof s.todoTitle === 'string') session.todoTitle = s.todoTitle
  const color = sanitizeColor(s.color, '')
  if (color) session.color = color
  return session
}

export function normalizeActiveTimer(raw: unknown): ActiveTimer | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const startedAt = clockMs(t.startedAt)
  const plannedMin =
    typeof t.plannedMin === 'number' && Number.isFinite(t.plannedMin) ? t.plannedMin : NaN
  if (!(startedAt > 0) || !(plannedMin > 0)) return null
  const timer: ActiveTimer = { startedAt, plannedMin }
  if (typeof t.projectId === 'string') timer.projectId = t.projectId
  if (typeof t.todoId === 'string') timer.todoId = t.todoId
  if (typeof t.projectTitle === 'string') timer.projectTitle = t.projectTitle
  if (typeof t.todoTitle === 'string') timer.todoTitle = t.todoTitle
  const color = sanitizeColor(t.color, '')
  if (color) timer.color = color
  return timer
}

export function normalizeSessions(raw: unknown): FocusSession[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeSession).filter((s): s is FocusSession => s !== null)
}

const NOTE_DATE = /^\d{4}-\d{2}-\d{2}$/

function normalizeNoteSent(raw: unknown): NoteSent | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const at = clockMs(s.at)
  if (!(at > 0) || typeof s.folder !== 'string' || typeof s.prompt !== 'string') return null
  const sent: NoteSent = { at, folder: s.folder, prompt: s.prompt }
  if (typeof s.sessionId === 'string' && s.sessionId) sent.sessionId = s.sessionId
  return sent
}

/** 只拷贝已知字段；日期不合法时归到今天，缩进夹在 0 到 NOTE_MAX_LEVEL。 */
export function normalizeNote(raw: unknown): NoteEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  const now = stamp()
  const level = typeof n.level === 'number' && Number.isFinite(n.level) ? Math.trunc(n.level) : 0
  const note: NoteEntry = {
    id: asStr(n.id, '') || uid(),
    date: typeof n.date === 'string' && NOTE_DATE.test(n.date) ? n.date : today(),
    text: asStr(n.text, ''),
    level: Math.min(NOTE_MAX_LEVEL, Math.max(0, level)),
    createdAt: asStr(n.createdAt, now),
    updatedAt: asStr(n.updatedAt, now),
  }
  if (typeof n.projectId === 'string' && n.projectId) {
    note.projectId = n.projectId
    if (typeof n.todoId === 'string' && n.todoId) note.todoId = n.todoId
  }
  const sent = Array.isArray(n.sent)
    ? n.sent.map(normalizeNoteSent).filter((x): x is NoteSent => x !== null)
    : []
  if (sent.length) note.sent = sent
  return note
}

/** 重复的 id 换成新 id（手工改过的文件可能出现），否则同 id 的两条会被一起改写、一起删除。 */
export function normalizeNotes(raw: unknown): NoteEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw
    .map(normalizeNote)
    .filter((n): n is NoteEntry => n !== null)
    .map((n) => {
      const note = seen.has(n.id) ? { ...n, id: uid() } : n
      seen.add(note.id)
      return note
    })
}

function strOf(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function hoursOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 保存的分析：结构不完整的整条丢弃，最多保留 ANALYSIS_KEEP 条。 */
export function normalizeAnalyses(raw: unknown): AnalysisRecord[] {
  if (!Array.isArray(raw)) return []
  const out: AnalysisRecord[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    const r = (a.result && typeof a.result === 'object' ? a.result : null) as Record<string, unknown> | null
    if (!r || typeof r.summary !== 'string' || !Array.isArray(r.plan)) continue
    const src = (a.sources && typeof a.sources === 'object' ? a.sources : {}) as Record<string, unknown>
    out.push({
      id: asStr(a.id, '') || uid(),
      createdAt: asStr(a.createdAt, stamp()),
      weekStart: asStr(a.weekStart, ''),
      tier: asStr(a.tier, ''),
      sources: {
        review: typeof src.review === 'string' ? src.review : null,
        scan: src.scan === 'ok' ? 'ok' : 'failed',
        ...(typeof src.scanNote === 'string' && src.scanNote ? { scanNote: src.scanNote } : {}),
      },
      result: {
        summary: r.summary,
        plan: r.plan
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({
            item: strOf(x.item),
            plannedHours: hoursOf(x.plannedHours),
            actualHours: hoursOf(x.actualHours),
            status: strOf(x.status),
            note: strOf(x.note),
          })),
        issues: (Array.isArray(r.issues) ? r.issues : [])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({ phenomenon: strOf(x.phenomenon), impact: strOf(x.impact), suggestion: strOf(x.suggestion) })),
        questions: (Array.isArray(r.questions) ? r.questions : []).filter((q): q is string => typeof q === 'string'),
      },
    })
    if (out.length === ANALYSIS_KEEP) break
  }
  return out
}

export function normalizeState(raw: unknown): AppState {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : undefined
  if (!s || !Array.isArray(s.projects)) {
    return { projects: [], sessions: [], notes: [], analyses: [], version: SCHEMA_VERSION }
  }
  return {
    projects: withDefaultColors(s.projects.map(normalizeProject)),
    sessions: normalizeSessions(s.sessions),
    notes: normalizeNotes(s.notes),
    analyses: normalizeAnalyses(s.analyses),
    version: typeof s.version === 'number' ? s.version : SCHEMA_VERSION,
  }
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function importJSON(text: string): AppState {
  const parsed = JSON.parse(text)
  const inner =
    parsed &&
    typeof parsed === 'object' &&
    'state' in parsed &&
    parsed.state &&
    typeof parsed.state === 'object' &&
    Array.isArray((parsed.state as { projects?: unknown }).projects)
      ? (parsed.state as Record<string, unknown>)
      : parsed
  if (!inner || typeof inner !== 'object' || !Array.isArray(inner.projects)) {
    throw new Error('Invalid file: missing `projects` array')
  }
  return {
    projects: withDefaultColors(inner.projects.map(normalizeProject)),
    sessions: normalizeSessions(inner.sessions),
    notes: normalizeNotes(inner.notes),
    analyses: normalizeAnalyses(inner.analyses),
    version: typeof inner.version === 'number' ? inner.version : SCHEMA_VERSION,
  }
}
