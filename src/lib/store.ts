import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Project,
  Todo,
  Collaborator,
  AppState,
  StageDef,
  FocusSession,
  ActiveTimer,
} from './types'
import { defaultStages, todoPriority, PRIORITY_META, PROJECT_COLOR_PRESETS } from './types'
import { uid } from './id'
import { today } from './date'
import {
  SCHEMA_VERSION,
  normalizeState,
  normalizeActiveTimer,
  normalizeProject,
  respreadAutoColors,
  exportJSON,
  importJSON,
} from './normalize'
import {
  PERSIST_NAME,
  createDebouncedLocalStorage,
  unlockPersistWrites,
} from './persist'

export {
  PERSIST_NAME,
  SCHEMA_VERSION,
  exportJSON,
  importJSON,
  normalizeProject,
  normalizeState,
}

type UndoKind =
  | { kind: 'project-removed'; project: Project; index: number }
  | { kind: 'project-archived'; id: string; prevArchived: boolean }
  | { kind: 'todo-removed'; projectId: string; todo: Todo; index: number }
  | { kind: 'collaborator-removed'; projectId: string; collaborator: Collaborator; index: number }
  | { kind: 'session-removed'; session: FocusSession; index: number }
  | { kind: 'replace-state'; prev: AppState }
  | { kind: 'clear-all'; prev: AppState; prevTimer: ActiveTimer | null }

/**
 * A stack entry carries a stable `token` so a specific toast can undo *its own*
 * action, not merely whatever happens to be newest on the stack. (Two deletes
 * within the toast window used to make an older toast's 撤销 revert the newer
 * action.)
 */
type UndoEntry = UndoKind & { token: string; label: string }

interface Store extends AppState {
  /** Last 20 reversible actions, newest first. Not persisted. */
  undoStack: UndoEntry[]

  /** The running countdown, or null. Persisted so a reload keeps it ticking. */
  activeTimer: ActiveTimer | null

  /**
   * Start a countdown. A timer already running is first recorded exactly like
   * `completeTimer({ early: true })` — elapsed focus is never silently dropped.
   */
  startTimer: (opts: { plannedMin: number; projectId?: string; todoId?: string }) => void
  /**
   * Record the running countdown as a session and clear it. `early` marks a
   * manual stop before 0; elapsed under 1 minute is discarded (returns null).
   */
  completeTimer: (opts?: { early?: boolean }) => FocusSession | null
  /** Discard the running countdown without recording anything. */
  cancelTimer: () => void
  /** Returns the undo token, or '' if the session id wasn't found. */
  removeSession: (id: string) => string

  addProject: (
    p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>,
  ) => string
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  /** Returns the undo token, or '' if nothing was removed. */
  removeProject: (id: string) => string
  /** Returns the undo token, or '' if the archived flag was unchanged. */
  archiveProject: (id: string, archived: boolean) => string

  addTodo: (projectId: string, t?: Partial<Todo>) => string
  updateTodo: (projectId: string, todoId: string, patch: Partial<Todo>) => void
  /** Returns the undo token, or '' if nothing was removed. */
  removeTodo: (projectId: string, todoId: string) => string
  reorderTodos: (projectId: string, ids: string[]) => void
  toggleTodoDone: (projectId: string, todoId: string) => void
  applyProjectStageToTodos: (projectId: string) => void

  addCollaborator: (projectId: string, c?: Partial<Collaborator>) => string
  updateCollaborator: (
    projectId: string,
    collaboratorId: string,
    patch: Partial<Collaborator>,
  ) => void
  /** Returns the undo token, or '' if nothing was removed. */
  removeCollaborator: (projectId: string, collaboratorId: string) => string

  addProjectStage: (projectId: string, s?: Partial<StageDef>) => string
  updateProjectStage: (projectId: string, stageId: string, patch: Partial<StageDef>) => void
  removeProjectStage: (projectId: string, stageId: string, reassignTo: string) => void
  reorderProjectStages: (projectId: string, ids: string[]) => void
  resetProjectStages: (projectId: string) => void

  /** Returns the undo token. */
  replaceState: (state: AppState) => string
  /** Empty projects, sessions, and the running timer. Returns the undo token. */
  clearAll: () => string

  /** Undo a specific entry by token, or the newest action when no token is given. */
  undo: (token?: string) => UndoEntry | null
}

const stamp = (): string => new Date().toISOString()

function makeUndo(kind: UndoKind, label: string): UndoEntry {
  return { ...kind, token: uid(), label }
}

/** Exhaustiveness guard: a future variant without a switch case fails to compile. */
function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`)
}

function pushUndo(state: Store, entry: UndoEntry): UndoEntry[] {
  return [entry, ...state.undoStack].slice(0, 20)
}

/**
 * Reorder `list` to follow `ids`: items are placed in `ids` order (duplicates
 * and unknown ids ignored), then any item whose id is missing from `ids` is
 * appended in its original relative order. Pure; shared by todo + stage reorder.
 */
function reorderBy<T extends { id: string }>(list: T[], ids: string[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x]))
  const seen = new Set<string>()
  const next: T[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item && !seen.has(id)) {
      next.push(item)
      seen.add(id)
    }
  }
  for (const x of list) if (!seen.has(x.id)) next.push(x)
  return next
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      projects: [],
      sessions: [],
      activeTimer: null,
      version: SCHEMA_VERSION,
      undoStack: [],

      startTimer: ({ plannedMin, projectId, todoId }) => {
        // Record (or discard, if <1min) whatever countdown is already running.
        get().completeTimer({ early: true })
        const project = projectId
          ? get().projects.find((p) => p.id === projectId)
          : undefined
        const todo = todoId ? project?.todos.find((t) => t.id === todoId) : undefined
        set({
          activeTimer: {
            startedAt: Date.now(),
            plannedMin,
            projectId,
            todoId,
            // Snapshots keep 回顾 meaningful even after the project/todo is gone.
            projectTitle: project?.title,
            todoTitle: todo?.title,
            color: project?.color,
          },
        })
      },

      completeTimer: (opts) => {
        const at = get().activeTimer
        if (!at) return null
        if (get().sessions.some((s) => s.startedAt === at.startedAt)) {
          set({ activeTimer: null })
          return null
        }
        const plannedEnd = at.startedAt + at.plannedMin * 60_000
        // An `early` stop at/after the planned end still counts as completed.
        const early = !!opts?.early && Date.now() < plannedEnd
        const endedAt = early ? Date.now() : plannedEnd
        if (endedAt - at.startedAt < 60_000) {
          set({ activeTimer: null })
          return null
        }
        const session: FocusSession = {
          id: uid(),
          plannedMin: at.plannedMin,
          startedAt: at.startedAt,
          endedAt,
          completed: !early,
          projectId: at.projectId,
          todoId: at.todoId,
          projectTitle: at.projectTitle,
          todoTitle: at.todoTitle,
          color: at.color,
        }
        set((s) => ({ sessions: [session, ...s.sessions], activeTimer: null }))
        return session
      },

      cancelTimer: () => {
        set({ activeTimer: null })
      },

      removeSession: (id) => {
        const idx = get().sessions.findIndex((x) => x.id === id)
        if (idx === -1) return ''
        const session = get().sessions[idx]
        const entry = makeUndo({ kind: 'session-removed', session, index: idx }, '已删除专注记录')
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== id),
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      addProject: (p) => {
        const id = uid()
        const now = stamp()
        set((s) => {
          // Fall back to the next palette hue so a project without an explicit
          // pick still gets a distinct accent instead of an empty color.
          const color =
            p.color || PROJECT_COLOR_PRESETS[s.projects.length % PROJECT_COLOR_PRESETS.length]
          return {
            projects: [
              { ...p, id, color, archived: false, createdAt: now, updatedAt: now },
              ...s.projects,
            ],
          }
        })
        return id
      },

      updateProject: (id, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: stamp() } : p,
          ),
        }))
      },

      removeProject: (id) => {
        const state = get()
        const idx = state.projects.findIndex((p) => p.id === id)
        if (idx === -1) return ''
        const project = state.projects[idx]
        const entry = makeUndo(
          { kind: 'project-removed', project, index: idx },
          `已删除项目「${project.title}」`,
        )
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      archiveProject: (id, archived) => {
        const state = get()
        const cur = state.projects.find((p) => p.id === id)
        if (!cur) return ''
        const prev = cur.archived
        if (prev === archived) return ''
        const entry = makeUndo(
          { kind: 'project-archived', id, prevArchived: prev },
          archived ? `已归档「${cur.title}」` : `已取消归档「${cur.title}」`,
        )
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, archived, updatedAt: stamp() } : p,
          ),
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      addTodo: (projectId, t) => {
        const id = uid()
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  todos: [
                    ...p.todos,
                    {
                      id,
                      title: '',
                      endDate: today(),
                      done: false,
                      stage: p.stage,
                      priority: 'normal',
                      ...t,
                    },
                  ],
                  updatedAt: stamp(),
                },
          ),
        }))
        return id
      },

      updateTodo: (projectId, todoId, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  todos: p.todos.map((t) => (t.id === todoId ? { ...t, ...patch } : t)),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      removeTodo: (projectId, todoId) => {
        const state = get()
        const project = state.projects.find((p) => p.id === projectId)
        if (!project) return ''
        const idx = project.todos.findIndex((t) => t.id === todoId)
        if (idx === -1) return ''
        const todo = project.todos[idx]
        const entry = makeUndo(
          { kind: 'todo-removed', projectId, todo, index: idx },
          `已删除待办「${todo.title || '未命名'}」`,
        )
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  todos: p.todos.filter((t) => t.id !== todoId),
                  updatedAt: stamp(),
                },
          ),
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      reorderTodos: (projectId, ids) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId ? p : { ...p, todos: reorderBy(p.todos, ids), updatedAt: stamp() },
          ),
        }))
      },

      toggleTodoDone: (projectId, todoId) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  todos: p.todos.map((t) =>
                    t.id === todoId ? { ...t, done: !t.done } : t,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      applyProjectStageToTodos: (projectId) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  todos: p.todos.map((t) => ({ ...t, stage: p.stage })),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      addCollaborator: (projectId, c) => {
        const id = uid()
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  collaborators: [
                    ...p.collaborators,
                    {
                      id,
                      name: '',
                      role: 'coauthor',
                      waitingFor: '',
                      ...c,
                    },
                  ],
                  updatedAt: stamp(),
                },
          ),
        }))
        return id
      },

      updateCollaborator: (projectId, collaboratorId, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  collaborators: p.collaborators.map((c) =>
                    c.id === collaboratorId ? { ...c, ...patch } : c,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      addProjectStage: (projectId, s) => {
        const id = uid()
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  stages: [
                    ...p.stages,
                    {
                      id,
                      name: '新阶段',
                      shortLabel: '新',
                      color: 'oklch(0.75 0.10 280)',
                      ...s,
                    },
                  ],
                  updatedAt: stamp(),
                },
          ),
        }))
        return id
      },

      updateProjectStage: (projectId, stageId, patch) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  stages: p.stages.map((s) =>
                    s.id === stageId ? { ...s, ...patch } : s,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      removeProjectStage: (projectId, stageId, reassignTo) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            if (p.stages.length <= 1) return p
            if (!p.stages.find((s) => s.id === reassignTo)) return p
            return {
              ...p,
              stages: p.stages.filter((s) => s.id !== stageId),
              stage: p.stage === stageId ? reassignTo : p.stage,
              todos: p.todos.map((t) =>
                t.stage === stageId ? { ...t, stage: reassignTo } : t,
              ),
              updatedAt: stamp(),
            }
          }),
        }))
      },

      reorderProjectStages: (projectId, ids) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id !== projectId ? p : { ...p, stages: reorderBy(p.stages, ids), updatedAt: stamp() },
          ),
        }))
      },

      resetProjectStages: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const fresh = defaultStages()
            const valid = new Set(fresh.map((s) => s.id))
            const fallback = fresh[0].id
            return {
              ...p,
              stages: fresh,
              stage: valid.has(p.stage) ? p.stage : fallback,
              todos: p.todos.map((t) => ({
                ...t,
                stage: valid.has(t.stage) ? t.stage : fallback,
              })),
              updatedAt: stamp(),
            }
          }),
        }))
      },

      removeCollaborator: (projectId, collaboratorId) => {
        const state = get()
        const project = state.projects.find((p) => p.id === projectId)
        if (!project) return ''
        const idx = project.collaborators.findIndex((c) => c.id === collaboratorId)
        if (idx === -1) return ''
        const collaborator = project.collaborators[idx]
        const entry = makeUndo(
          { kind: 'collaborator-removed', projectId, collaborator, index: idx },
          `已移除合作者「${collaborator.name || '未命名'}」`,
        )
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  collaborators: p.collaborators.filter((c) => c.id !== collaboratorId),
                  updatedAt: stamp(),
                },
          ),
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      replaceState: (next) => {
        const prev = {
          projects: get().projects,
          sessions: get().sessions,
          version: get().version,
        }
        const entry = makeUndo({ kind: 'replace-state', prev }, '已替换全部数据')
        unlockPersistWrites()
        // A running countdown survives an import. It is not part of AppState.
        set((s) => ({
          projects: next.projects,
          sessions: next.sessions,
          version: next.version,
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      clearAll: () => {
        const prev = {
          projects: get().projects,
          sessions: get().sessions,
          version: get().version,
        }
        const entry = makeUndo(
          { kind: 'clear-all', prev, prevTimer: get().activeTimer },
          '已清空全部数据',
        )
        unlockPersistWrites()
        set((s) => ({
          projects: [],
          sessions: [],
          activeTimer: null,
          version: SCHEMA_VERSION,
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      undo: (token) => {
        const stack = get().undoStack
        // Distinguish "no token" (Cmd+Z → newest) from an empty-string token
        // (a no-op returned when nothing was removed) so undo('') never reverts
        // the newest action by accident.
        const entry = token !== undefined ? stack.find((e) => e.token === token) : stack[0]
        if (!entry) return null
        set((s) => {
          const rest = s.undoStack.filter((e) => e.token !== entry.token)
          switch (entry.kind) {
            case 'project-removed': {
              const next = [...s.projects]
              next.splice(Math.min(entry.index, next.length), 0, entry.project)
              return { projects: next, undoStack: rest }
            }
            case 'project-archived': {
              return {
                projects: s.projects.map((p) =>
                  p.id === entry.id ? { ...p, archived: entry.prevArchived } : p,
                ),
                undoStack: rest,
              }
            }
            case 'todo-removed': {
              return {
                projects: s.projects.map((p) => {
                  if (p.id !== entry.projectId) return p
                  const next = [...p.todos]
                  next.splice(Math.min(entry.index, next.length), 0, entry.todo)
                  return { ...p, todos: next }
                }),
                undoStack: rest,
              }
            }
            case 'collaborator-removed': {
              return {
                projects: s.projects.map((p) => {
                  if (p.id !== entry.projectId) return p
                  const next = [...p.collaborators]
                  next.splice(Math.min(entry.index, next.length), 0, entry.collaborator)
                  return { ...p, collaborators: next }
                }),
                undoStack: rest,
              }
            }
            case 'session-removed': {
              const next = [...s.sessions]
              next.splice(Math.min(entry.index, next.length), 0, entry.session)
              return { sessions: next, undoStack: rest }
            }
            case 'replace-state': {
              return {
                projects: entry.prev.projects,
                sessions: entry.prev.sessions,
                version: entry.prev.version,
                undoStack: rest,
              }
            }
            case 'clear-all': {
              return {
                projects: entry.prev.projects,
                sessions: entry.prev.sessions,
                version: entry.prev.version,
                activeTimer: entry.prevTimer,
                undoStack: rest,
              }
            }
            default:
              return assertNever(entry)
          }
        })
        return entry
      },
    }),
    {
      name: PERSIST_NAME,
      storage: createDebouncedLocalStorage(),
      partialize: (s) => ({
        projects: s.projects,
        sessions: s.sessions,
        activeTimer: s.activeTimer,
        version: s.version,
      }),
      version: SCHEMA_VERSION,
      migrate: (persisted: unknown, fromVersion: number) => hydratePersisted(persisted, fromVersion),
      merge: (persisted, current) => ({
        ...current,
        ...hydratePersisted(persisted, SCHEMA_VERSION),
        undoStack: [],
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PERSIST_NAME) void useStore.persist.rehydrate()
  })
}

function hydratePersisted(persisted: unknown, fromVersion: number) {
  const state = normalizeState(persisted)
  const raw =
    persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : null
  return {
    projects: fromVersion < 6 ? respreadAutoColors(state.projects) : state.projects,
    sessions: state.sessions,
    activeTimer: normalizeActiveTimer(raw?.activeTimer),
    version: SCHEMA_VERSION,
  }
}

/** Pure helpers used outside the store */

export function nextDeadline(p: Project): { date: string; label: string } | null {
  const candidates: { date: string; label: string }[] = []
  if (p.venue?.deadline) {
    candidates.push({ date: p.venue.deadline, label: `${p.venue.name} 投稿` })
  }
  if (p.venue?.rebuttalAt) {
    candidates.push({ date: p.venue.rebuttalAt, label: `${p.venue.name} rebuttal` })
  }
  for (const t of p.todos) {
    // Skip undated todos: an empty endDate isn't a real deadline candidate.
    if (!t.done && t.endDate) candidates.push({ date: t.endDate, label: t.title })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.date.localeCompare(b.date))
  const future = candidates.find((c) => c.date >= today())
  return future ?? candidates[candidates.length - 1]
}

export interface WeekItem {
  project: Project
  todo: Todo
  /** True when it shows only because it was manually pinned (its due date is out of window). */
  pinnedExtra: boolean
}

/**
 * Incomplete todos shown in 本周重点 across non-archived projects: those due on
 * or before `end` (the rolling window plus any overdue carry-over) plus any
 * manually pinned (`inWeek`) regardless of due date. Sorted by importance, then
 * earliest due (overdue floats up; undated pins sink to the bottom).
 */
export function weekItems(projects: Project[], end: string): WeekItem[] {
  const items: WeekItem[] = []
  for (const p of projects) {
    if (p.archived) continue
    for (const t of p.todos) {
      if (t.done) continue
      const inWindow = !!t.endDate && t.endDate <= end
      if (inWindow || t.inWeek) {
        items.push({ project: p, todo: t, pinnedExtra: !!t.inWeek && !inWindow })
      }
    }
  }
  return items.sort((a, b) => {
    const ra = PRIORITY_META[todoPriority(a.todo)].rank
    const rb = PRIORITY_META[todoPriority(b.todo)].rank
    if (ra !== rb) return ra - rb
    const da = a.todo.endDate || '9999-12-31'
    const db = b.todo.endDate || '9999-12-31'
    return da.localeCompare(db)
  })
}

/** Up to N incomplete todos, overdue first then by endDate (undated sink last). */
export function upcomingTodos(p: Project, n = 3): Todo[] {
  const t = today()
  const incomplete = p.todos.filter((x) => !x.done)
  return [...incomplete]
    .sort((a, b) => {
      const aOver = !!a.endDate && a.endDate < t
      const bOver = !!b.endDate && b.endDate < t
      if (aOver !== bOver) return aOver ? -1 : 1
      const da = a.endDate || '9999-12-31'
      const db = b.endDate || '9999-12-31'
      return da.localeCompare(db)
    })
    .slice(0, n)
}

/** Stage-based progress: index of the current stage in the project's stages (1-based). */
export function stageProgress(p: Project): { current: number; total: number; percent: number } {
  const total = p.stages.length
  if (total === 0) return { current: 0, total: 0, percent: 0 }
  const idx = p.stages.findIndex((s) => s.id === p.stage)
  const current = idx < 0 ? 0 : idx + 1
  return { current, total, percent: Math.round((current / total) * 100) }
}
