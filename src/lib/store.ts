import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Project, Todo, Collaborator, AppState, StageDef } from './types'
import { defaultStages, todoPriority, PRIORITY_META } from './types'
import { uid } from './id'
import { today } from './date'
import { seedProjects } from './seed'

const SCHEMA_VERSION = 4

type UndoEntry =
  | { kind: 'project-removed'; project: Project; index: number; label: string }
  | { kind: 'project-archived'; id: string; prevArchived: boolean; label: string }
  | { kind: 'todo-removed'; projectId: string; todo: Todo; index: number; label: string }
  | { kind: 'collaborator-removed'; projectId: string; collaborator: Collaborator; index: number; label: string }
  | { kind: 'replace-state'; prev: AppState; label: string }

interface Store extends AppState {
  /** Last 20 reversible actions, newest first. Not persisted. */
  undoStack: UndoEntry[]

  addProject: (
    p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>,
  ) => string
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  removeProject: (id: string) => void
  archiveProject: (id: string, archived: boolean) => void

  addTodo: (projectId: string, t?: Partial<Todo>) => string
  updateTodo: (projectId: string, todoId: string, patch: Partial<Todo>) => void
  removeTodo: (projectId: string, todoId: string) => void
  reorderTodos: (projectId: string, ids: string[]) => void
  toggleTodoDone: (projectId: string, todoId: string) => void
  applyProjectStageToTodos: (projectId: string) => void

  addCollaborator: (projectId: string, c?: Partial<Collaborator>) => string
  updateCollaborator: (
    projectId: string,
    collaboratorId: string,
    patch: Partial<Collaborator>,
  ) => void
  removeCollaborator: (projectId: string, collaboratorId: string) => void

  addProjectStage: (projectId: string, s?: Partial<StageDef>) => string
  updateProjectStage: (projectId: string, stageId: string, patch: Partial<StageDef>) => void
  removeProjectStage: (projectId: string, stageId: string, reassignTo: string) => void
  reorderProjectStages: (projectId: string, ids: string[]) => void
  resetProjectStages: (projectId: string) => void

  replaceState: (state: AppState) => void
  clearAll: () => void
  resetToSeed: () => void

  undo: () => UndoEntry | null
}

const stamp = (): string => new Date().toISOString()

function pushUndo(state: Store, entry: UndoEntry): UndoEntry[] {
  const next = [entry, ...state.undoStack]
  return next.slice(0, 20)
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      projects: [],
      version: SCHEMA_VERSION,
      undoStack: [],

      addProject: (p) => {
        const id = uid()
        const now = stamp()
        set((s) => ({
          projects: [{ ...p, id, archived: false, createdAt: now, updatedAt: now }, ...s.projects],
        }))
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
        if (idx === -1) return
        const project = state.projects[idx]
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          undoStack: pushUndo(s, {
            kind: 'project-removed',
            project,
            index: idx,
            label: `已删除项目「${project.title}」`,
          }),
        }))
      },

      archiveProject: (id, archived) => {
        const state = get()
        const cur = state.projects.find((p) => p.id === id)
        if (!cur) return
        const prev = cur.archived
        if (prev === archived) return
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, archived, updatedAt: stamp() } : p,
          ),
          undoStack: pushUndo(s, {
            kind: 'project-archived',
            id,
            prevArchived: prev,
            label: archived
              ? `已归档「${cur.title}」`
              : `已取消归档「${cur.title}」`,
          }),
        }))
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
        if (!project) return
        const idx = project.todos.findIndex((t) => t.id === todoId)
        if (idx === -1) return
        const todo = project.todos[idx]
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
          undoStack: pushUndo(s, {
            kind: 'todo-removed',
            projectId,
            todo,
            index: idx,
            label: `已删除待办「${todo.title || '未命名'}」`,
          }),
        }))
      },

      reorderTodos: (projectId, ids) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p
            const byId = new Map(p.todos.map((t) => [t.id, t]))
            const next = ids.map((id) => byId.get(id)).filter(Boolean) as Todo[]
            for (const t of p.todos) if (!ids.includes(t.id)) next.push(t)
            return { ...p, todos: next, updatedAt: stamp() }
          }),
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
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p
            const byId = new Map(p.stages.map((s) => [s.id, s]))
            const next = ids.map((id) => byId.get(id)).filter(Boolean) as StageDef[]
            for (const s of p.stages) if (!ids.includes(s.id)) next.push(s)
            return { ...p, stages: next, updatedAt: stamp() }
          }),
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
        if (!project) return
        const idx = project.collaborators.findIndex((c) => c.id === collaboratorId)
        if (idx === -1) return
        const collaborator = project.collaborators[idx]
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
          undoStack: pushUndo(s, {
            kind: 'collaborator-removed',
            projectId,
            collaborator,
            index: idx,
            label: `已移除合作者「${collaborator.name || '未命名'}」`,
          }),
        }))
      },

      replaceState: (state) => {
        const prev = { projects: get().projects, version: get().version }
        set((s) => ({
          projects: state.projects,
          version: state.version,
          undoStack: pushUndo(s, {
            kind: 'replace-state',
            prev,
            label: '已替换全部数据',
          }),
        }))
      },

      clearAll: () => {
        set({ projects: [], version: SCHEMA_VERSION })
      },

      resetToSeed: () => {
        const prev = { projects: get().projects, version: get().version }
        set((s) => ({
          projects: seedProjects(),
          version: SCHEMA_VERSION,
          undoStack: pushUndo(s, {
            kind: 'replace-state',
            prev,
            label: '已恢复演示数据',
          }),
        }))
      },

      undo: () => {
        const entry = get().undoStack[0]
        if (!entry) return null
        set((s) => {
          const rest = s.undoStack.slice(1)
          switch (entry.kind) {
            case 'project-removed': {
              const next = [...s.projects]
              next.splice(entry.index, 0, entry.project)
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
                  next.splice(entry.index, 0, entry.todo)
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
                  next.splice(entry.index, 0, entry.collaborator)
                  return { ...p, collaborators: next }
                }),
                undoStack: rest,
              }
            }
            case 'replace-state': {
              return {
                projects: entry.prev.projects,
                version: entry.prev.version,
                undoStack: rest,
              }
            }
          }
        })
        return entry
      },
    }),
    {
      name: 'research-tracker-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ projects: s.projects, version: s.version }),
      version: SCHEMA_VERSION,
      migrate: (persisted: unknown) => {
        const state = persisted as Partial<AppState> | undefined
        if (!state || !Array.isArray(state.projects)) {
          return { projects: [], version: SCHEMA_VERSION } as AppState
        }
        const projects = state.projects.map((p) => {
          const stages: StageDef[] =
            Array.isArray(p.stages) && p.stages.length > 0 ? p.stages : defaultStages()
          const validIds = new Set(stages.map((s) => s.id))
          const fallbackStage = stages[0].id
          const projectStage = validIds.has(p.stage) ? p.stage : fallbackStage
          // Rename milestones -> todos and drop startDate.
          type LegacyMilestone = Todo & { startDate?: string }
          const legacy: LegacyMilestone[] = Array.isArray((p as { milestones?: unknown }).milestones)
            ? ((p as { milestones?: LegacyMilestone[] }).milestones ?? [])
            : []
          const rawTodos: LegacyMilestone[] =
            Array.isArray(p.todos) && p.todos.length > 0 ? p.todos : legacy
          const todos: Todo[] = rawTodos.map((t) => {
            const { startDate: _start, ...rest } = t
            return {
              ...rest,
              stage: validIds.has(rest.stage ?? '') ? rest.stage : projectStage,
            } as Todo
          })
          const { milestones: _m, ...prest } = p as { milestones?: unknown }
          return {
            ...prest,
            stages,
            stage: projectStage,
            todos,
          } as Project
        })
        return { projects, version: SCHEMA_VERSION } as AppState
      },
    },
  ),
)

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
    if (!t.done) candidates.push({ date: t.endDate, label: t.title })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.date.localeCompare(b.date))
  const future = candidates.find((c) => c.date >= today())
  return future ?? candidates[candidates.length - 1]
}

export interface WeekItem {
  project: Project
  todo: Todo
}

/**
 * Incomplete todos due on or before `end` — the rolling board window plus any
 * overdue carry-over — across non-archived projects. Sorted by importance, then
 * earliest due (overdue floats to the top).
 */
export function weekItems(projects: Project[], end: string): WeekItem[] {
  const items: WeekItem[] = []
  for (const p of projects) {
    if (p.archived) continue
    for (const t of p.todos) {
      if (t.done || !t.endDate) continue
      if (t.endDate <= end) items.push({ project: p, todo: t })
    }
  }
  return items.sort((a, b) => {
    const ra = PRIORITY_META[todoPriority(a.todo)].rank
    const rb = PRIORITY_META[todoPriority(b.todo)].rank
    if (ra !== rb) return ra - rb
    return a.todo.endDate.localeCompare(b.todo.endDate)
  })
}

/** Up to N incomplete todos, overdue first then by endDate. */
export function upcomingTodos(p: Project, n = 3): Todo[] {
  const t = today()
  const incomplete = p.todos.filter((x) => !x.done)
  return [...incomplete]
    .sort((a, b) => {
      const aOver = a.endDate < t
      const bOver = b.endDate < t
      if (aOver && !bOver) return -1
      if (!aOver && bOver) return 1
      return a.endDate.localeCompare(b.endDate)
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

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function importJSON(text: string): AppState {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.projects)) {
    throw new Error('Invalid file: missing `projects` array')
  }
  return {
    projects: parsed.projects as Project[],
    version: typeof parsed.version === 'number' ? parsed.version : SCHEMA_VERSION,
  }
}
