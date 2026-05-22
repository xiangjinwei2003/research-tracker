import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Project, Milestone, Collaborator, AppState } from './types'
import { uid } from './id'
import { today } from './date'
import { seedProjects } from './seed'

const SCHEMA_VERSION = 2

type UndoEntry =
  | { kind: 'project-removed'; project: Project; index: number; label: string }
  | { kind: 'project-archived'; id: string; prevArchived: boolean; label: string }
  | { kind: 'milestone-removed'; projectId: string; milestone: Milestone; index: number; label: string }
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

  addMilestone: (projectId: string, m?: Partial<Milestone>) => string
  updateMilestone: (projectId: string, milestoneId: string, patch: Partial<Milestone>) => void
  removeMilestone: (projectId: string, milestoneId: string) => void
  reorderMilestones: (projectId: string, ids: string[]) => void
  toggleMilestoneDone: (projectId: string, milestoneId: string) => void
  applyProjectStageToMilestones: (projectId: string) => void

  addCollaborator: (projectId: string, c?: Partial<Collaborator>) => string
  updateCollaborator: (
    projectId: string,
    collaboratorId: string,
    patch: Partial<Collaborator>,
  ) => void
  removeCollaborator: (projectId: string, collaboratorId: string) => void

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
      projects: seedProjects(),
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

      addMilestone: (projectId, m) => {
        const id = uid()
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: [
                    ...p.milestones,
                    {
                      id,
                      title: '',
                      startDate: today(),
                      endDate: today(),
                      done: false,
                      stage: p.stage,
                      ...m,
                    },
                  ],
                  updatedAt: stamp(),
                },
          ),
        }))
        return id
      },

      updateMilestone: (projectId, milestoneId, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id === milestoneId ? { ...m, ...patch } : m,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      removeMilestone: (projectId, milestoneId) => {
        const state = get()
        const project = state.projects.find((p) => p.id === projectId)
        if (!project) return
        const idx = project.milestones.findIndex((m) => m.id === milestoneId)
        if (idx === -1) return
        const milestone = project.milestones[idx]
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.filter((m) => m.id !== milestoneId),
                  updatedAt: stamp(),
                },
          ),
          undoStack: pushUndo(s, {
            kind: 'milestone-removed',
            projectId,
            milestone,
            index: idx,
            label: `已删除里程碑「${milestone.title || '未命名'}」`,
          }),
        }))
      },

      reorderMilestones: (projectId, ids) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p
            const byId = new Map(p.milestones.map((m) => [m.id, m]))
            const next = ids.map((id) => byId.get(id)).filter(Boolean) as Milestone[]
            // Append any milestones not in `ids` (safety).
            for (const m of p.milestones) {
              if (!ids.includes(m.id)) next.push(m)
            }
            return { ...p, milestones: next, updatedAt: stamp() }
          }),
        }))
      },

      toggleMilestoneDone: (projectId, milestoneId) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id === milestoneId ? { ...m, done: !m.done } : m,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      applyProjectStageToMilestones: (projectId) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.map((m) => ({ ...m, stage: p.stage })),
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
            case 'milestone-removed': {
              return {
                projects: s.projects.map((p) => {
                  if (p.id !== entry.projectId) return p
                  const next = [...p.milestones]
                  next.splice(entry.index, 0, entry.milestone)
                  return { ...p, milestones: next }
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
        const projects = state.projects.map((p) => ({
          ...p,
          milestones: (p.milestones ?? []).map((m) => ({
            ...m,
            stage: m.stage ?? p.stage,
          })),
        }))
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
  for (const m of p.milestones) {
    if (!m.done) candidates.push({ date: m.endDate, label: m.title })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.date.localeCompare(b.date))
  const future = candidates.find((c) => c.date >= today())
  return future ?? candidates[candidates.length - 1]
}

/** Up to N incomplete milestones, overdue first then by endDate. */
export function upcomingMilestones(p: Project, n = 3): Milestone[] {
  const t = today()
  const incomplete = p.milestones.filter((m) => !m.done)
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
