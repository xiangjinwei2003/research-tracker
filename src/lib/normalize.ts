import type {
  Project,
  Todo,
  Collaborator,
  AppState,
  StageDef,
  Venue,
  FocusSession,
  ActiveTimer,
} from './types'
import {
  defaultStages,
  PROJECT_COLOR_PRESETS,
  LEGACY_PROJECT_COLOR_PRESETS,
} from './types'
import { uid } from './id'
import { today } from './date'

export const SCHEMA_VERSION = 7

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
  if (typeof t.notes === 'string') todo.notes = t.notes
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
  return {
    id: asStr(p.id, '') || uid(),
    title: asStr(p.title, ''),
    description: asStr(p.description, ''),
    color: sanitizeColor(p.color, ''),
    stage: projectStage,
    stages,
    startDate: asStr(p.startDate, today()),
    venue: normalizeVenue(p.venue),
    collaborators: Array.isArray(p.collaborators) ? p.collaborators.map(normalizeCollaborator) : [],
    todos,
    notes: asStr(p.notes, ''),
    archived: !!p.archived,
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

export function normalizeSession(raw: unknown): FocusSession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const startedAt = typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) ? s.startedAt : NaN
  const endedAt = typeof s.endedAt === 'number' && Number.isFinite(s.endedAt) ? s.endedAt : NaN
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
  const startedAt = typeof t.startedAt === 'number' && Number.isFinite(t.startedAt) ? t.startedAt : NaN
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

export function normalizeState(raw: unknown): AppState {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : undefined
  if (!s || !Array.isArray(s.projects)) {
    return { projects: [], sessions: [], version: SCHEMA_VERSION }
  }
  return {
    projects: withDefaultColors(s.projects.map(normalizeProject)),
    sessions: normalizeSessions(s.sessions),
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
    version: typeof inner.version === 'number' ? inner.version : SCHEMA_VERSION,
  }
}
