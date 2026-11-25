import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Project,
  Todo,
  AppState,
  FocusSession,
  ActiveTimer,
  ProjectTag,
  NoteEntry,
  NoteSent,
  AnalysisRecord,
} from './types'
import { ANALYSIS_KEEP, NOTE_MAX_LEVEL, PROJECT_COLOR_PRESETS, PROJECT_TAG_ORDER } from './types'
import { insertionIndex, notesOfDay } from './notes'
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
  type Persisted,
} from './persist'
import { IN_ARTIFACT } from '../platform/runtime'
import { fileStorage } from '../platform/fileStore'

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
  | { kind: 'session-removed'; session: FocusSession; index: number }
  | { kind: 'note-removed'; note: NoteEntry; index: number }
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
  /**
   * 补记一段没有经过倒计时的专注。区间由 manualSpan 算出；
   * 这里只拒绝结构上不成立的区间（抛错）。按开始时间插入，保持新的在前。
   * 有 projectId 时忽略 label。
   */
  addManualSession: (opts: {
    startedAt: number
    endedAt: number
    projectId?: string
    todoId?: string
    label?: string
    note?: string
  }) => FocusSession
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
  /**
   * 按 `ids` 重排这些项目，只在它们原先占据的位置之间调换，
   * 不在 `ids` 里的项目（如已归档项目）位置不变。
   */
  reorderProjects: (ids: string[]) => void
  toggleProjectTag: (id: string, tag: ProjectTag) => void

  addTodo: (projectId: string, t?: Partial<Todo>) => string
  updateTodo: (projectId: string, todoId: string, patch: Partial<Todo>) => void
  /** Returns the undo token, or '' if nothing was removed. */
  removeTodo: (projectId: string, todoId: string) => string
  /** 把任务移到另一个项目，排在末尾；阶段在目标项目里不存在时改用目标项目的当前阶段。 */
  moveTodo: (fromProjectId: string, todoId: string, toProjectId: string) => void
  reorderTodos: (projectId: string, ids: string[]) => void
  toggleTodoDone: (projectId: string, todoId: string) => void

  /**
   * 新建一条笔记，插在 `afterId` 之后（没有时放在这一天的最后）。
   * 可以指定 id：今天还没有笔记时页面先用一个预留 id 渲染输入框，第一次输入时用同一个 id 建笔记，
   * 输入框不会重新挂载，输入法的组字不中断。
   */
  addNote: (opts: {
    date: string
    id?: string
    afterId?: string
    text?: string
    level?: number
    projectId?: string
    todoId?: string
  }) => string
  /** 改文字、缩进或关联。关联字段传 undefined 表示去掉。 */
  updateNote: (
    id: string,
    patch: Partial<Pick<NoteEntry, 'text' | 'level' | 'projectId' | 'todoId'>>,
  ) => void
  /** Enter：在 `at` 处把文字拆成两条，后半段成为紧随其后的同级新条目。返回新条目的 id。 */
  splitNote: (id: string, at: number) => string
  /** 行首退格：并入同一天的上一条。返回上一条的 id 和拼接处的光标位置；没有上一条时返回 null。 */
  mergeNoteUp: (id: string) => { id: string; caret: number } | null
  /** 删除一条笔记。`undoable` 时返回撤销令牌（菜单里的删除），否则返回 ''（退格删空行）。 */
  removeNote: (id: string, opts?: { undoable?: boolean }) => string
  /** 记下一次发送到 Claude Code。 */
  markNoteSent: (id: string, sent: NoteSent) => void
  /** 保存一次分析，放在最前，只保留最近 ANALYSIS_KEEP 条。 */
  addAnalysis: (record: AnalysisRecord) => void

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
      notes: [],
      analyses: [],
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

      addManualSession: ({ startedAt, endedAt, projectId, todoId, label, note }) => {
        if (!(endedAt - startedAt >= 60_000)) {
          throw new Error(`addManualSession: invalid span ${startedAt}..${endedAt}`)
        }
        const project = projectId
          ? get().projects.find((p) => p.id === projectId)
          : undefined
        const todo = todoId ? project?.todos.find((t) => t.id === todoId) : undefined
        const session: FocusSession = {
          id: uid(),
          plannedMin: Math.round((endedAt - startedAt) / 60_000),
          startedAt,
          endedAt,
          completed: true,
          manual: true,
          projectId: project?.id,
          todoId: todo?.id,
          projectTitle: project?.title,
          todoTitle: todo?.title,
          color: project?.color,
        }
        if (!project && label?.trim()) session.label = label.trim()
        if (note?.trim()) session.note = note.trim()
        set((s) => {
          const at = s.sessions.findIndex((x) => x.startedAt < startedAt)
          const next = [...s.sessions]
          next.splice(at === -1 ? next.length : at, 0, session)
          return { sessions: next }
        })
        return session
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

      reorderProjects: (ids) => {
        set((s) => {
          const subset = new Set(ids)
          const queue = reorderBy(
            s.projects.filter((p) => subset.has(p.id)),
            ids,
          )
          let i = 0
          return {
            projects: s.projects.map((p) => (subset.has(p.id) ? queue[i++] : p)),
          }
        })
      },

      toggleProjectTag: (id, tag) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p
            const has = p.tags?.includes(tag) ?? false
            const tags = PROJECT_TAG_ORDER.filter((x) =>
              x === tag ? !has : (p.tags?.includes(x) ?? false),
            )
            const next = { ...p, updatedAt: stamp() }
            if (tags.length) next.tags = tags
            else delete next.tags
            return next
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
                      // 没选日期就是没有日期，不默认记成今天到期。
                      endDate: '',
                      done: false,
                      stage: p.stage,
                      priority: 'normal',
                      // 调用方没指定优先级的新任务先进待分配组。
                      ...(t?.priority ? {} : { pending: true }),
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
                  todos: p.todos.map((t) => {
                    if (t.id !== todoId) return t
                    const next = withDoneAt(t, { ...t, ...patch })
                    // 指定优先级即离开待分配组。
                    if (patch.priority && patch.pending === undefined) delete next.pending
                    return next
                  }),
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
          `已删除任务「${todo.title || '未命名'}」`,
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

      moveTodo: (fromProjectId, todoId, toProjectId) => {
        set((s) => {
          const from = s.projects.find((p) => p.id === fromProjectId)
          const to = s.projects.find((p) => p.id === toProjectId)
          const todo = from?.todos.find((t) => t.id === todoId)
          if (!from || !to || !todo || from === to) return {}
          const moved: Todo = to.stages.some((st) => st.id === todo.stage)
            ? todo
            : { ...todo, stage: to.stage }
          const now = stamp()
          return {
            projects: s.projects.map((p) =>
              p === from
                ? { ...p, todos: p.todos.filter((t) => t.id !== todoId), updatedAt: now }
                : p === to
                  ? { ...p, todos: [...p.todos, moved], updatedAt: now }
                  : p,
            ),
          }
        })
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
                    t.id === todoId ? withDoneAt(t, { ...t, done: !t.done }) : t,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }))
      },

      addNote: ({ date, id: wanted, afterId, text, level, projectId, todoId }) => {
        const id = wanted && !get().notes.some((n) => n.id === wanted) ? wanted : uid()
        const now = stamp()
        const note: NoteEntry = {
          id,
          date,
          text: text ?? '',
          level: clampNoteLevel(level ?? 0),
          createdAt: now,
          updatedAt: now,
        }
        if (projectId) {
          note.projectId = projectId
          if (todoId) note.todoId = todoId
        }
        set((s) => {
          const next = [...s.notes]
          next.splice(insertionIndex(s.notes, date, afterId), 0, note)
          return { notes: next }
        })
        return id
      },

      updateNote: (id, patch) => {
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== id) return n
            const next: NoteEntry = { ...n, updatedAt: stamp() }
            if (patch.text !== undefined) next.text = patch.text
            if (patch.level !== undefined) next.level = clampNoteLevel(patch.level)
            if ('projectId' in patch) {
              if (patch.projectId) next.projectId = patch.projectId
              else delete next.projectId
              // 换了项目或去掉项目时，原来的任务关联不再成立。
              if (!patch.projectId || patch.projectId !== n.projectId) delete next.todoId
            }
            if ('todoId' in patch) {
              if (patch.todoId && next.projectId) next.todoId = patch.todoId
              else delete next.todoId
            }
            return next
          }),
        }))
      },

      splitNote: (id, at) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return ''
        const head = note.text.slice(0, at)
        const tail = note.text.slice(at)
        get().updateNote(id, { text: head })
        return get().addNote({ date: note.date, afterId: id, text: tail, level: note.level })
      },

      mergeNoteUp: (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return null
        const day = notesOfDay(get().notes, note.date)
        const at = day.findIndex((n) => n.id === id)
        if (at <= 0) return null
        const prev = day[at - 1]
        const caret = prev.text.length
        set((s) => ({
          notes: s.notes
            .filter((n) => n.id !== id)
            .map((n) => (n.id === prev.id ? { ...n, text: prev.text + note.text, updatedAt: stamp() } : n)),
        }))
        return { id: prev.id, caret }
      },

      removeNote: (id, opts) => {
        const index = get().notes.findIndex((n) => n.id === id)
        if (index === -1) return ''
        const note = get().notes[index]
        if (!opts?.undoable) {
          set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
          return ''
        }
        const entry = makeUndo({ kind: 'note-removed', note, index }, '已删除笔记')
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id), undoStack: pushUndo(s, entry) }))
        return entry.token
      },

      markNoteSent: (id, sent) => {
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, sent: [...(n.sent ?? []), sent], updatedAt: stamp() } : n,
          ),
        }))
      },

      addAnalysis: (record) => {
        set((s) => ({ analyses: [record, ...s.analyses].slice(0, ANALYSIS_KEEP) }))
      },

      replaceState: (next) => {
        const prev = {
          projects: get().projects,
          sessions: get().sessions,
          notes: get().notes,
          analyses: get().analyses,
          version: get().version,
        }
        const entry = makeUndo({ kind: 'replace-state', prev }, '已替换全部数据')
        unlockPersistWrites()
        // A running countdown survives an import. It is not part of AppState.
        set((s) => ({
          projects: next.projects,
          sessions: next.sessions,
          notes: next.notes,
          analyses: next.analyses,
          version: next.version,
          undoStack: pushUndo(s, entry),
        }))
        return entry.token
      },

      clearAll: () => {
        const prev = {
          projects: get().projects,
          sessions: get().sessions,
          notes: get().notes,
          analyses: get().analyses,
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
          notes: [],
          analyses: [],
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
            case 'session-removed': {
              const next = [...s.sessions]
              next.splice(Math.min(entry.index, next.length), 0, entry.session)
              return { sessions: next, undoStack: rest }
            }
            case 'note-removed': {
              const next = [...s.notes]
              next.splice(Math.min(entry.index, next.length), 0, entry.note)
              return { notes: next, undoStack: rest }
            }
            case 'replace-state': {
              return {
                projects: entry.prev.projects,
                sessions: entry.prev.sessions,
                notes: entry.prev.notes,
                analyses: entry.prev.analyses,
                version: entry.prev.version,
                undoStack: rest,
              }
            }
            case 'clear-all': {
              return {
                projects: entry.prev.projects,
                sessions: entry.prev.sessions,
                notes: entry.prev.notes,
                analyses: entry.prev.analyses,
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
      // 网页版：localStorage，模块加载时同步水合。桌面版：本机数据文件，
      // 由启动流程（platform/boot.ts）打开文件后再 rehydrate。
      storage: IN_ARTIFACT ? fileStorage : createDebouncedLocalStorage(),
      skipHydration: IN_ARTIFACT,
      partialize: persistedPart,
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

// 网页版在别的标签页改了数据时重新读取。桌面版只有一个窗口，数据在文件里。
if (typeof window !== 'undefined' && !IN_ARTIFACT) {
  window.addEventListener('storage', (e) => {
    if (e.key === PERSIST_NAME) void useStore.persist.rehydrate()
  })
}

/** 写入存储的部分。函数声明会提升，create() 调用时已可用。 */
function persistedPart(s: Store): Persisted {
  return {
    projects: s.projects,
    sessions: s.sessions,
    notes: s.notes,
    analyses: s.analyses,
    activeTimer: s.activeTimer,
    version: s.version,
  }
}

/** 勾掉时记下时刻，取消勾选时清除。函数声明，迁移期间也可用。 */
function withDoneAt(before: Todo, after: Todo): Todo {
  if (after.done && !before.done) return { ...after, doneAt: new Date().toISOString() }
  if (!after.done && after.doneAt !== undefined) {
    const { doneAt: _drop, ...rest } = after
    return rest
  }
  return after
}

function clampNoteLevel(level: number): number {
  return Math.min(NOTE_MAX_LEVEL, Math.max(0, Math.trunc(level)))
}

/** 当前状态按存储格式打包，桌面版在迁移后补写一次文件时使用。 */
export function persistedSnapshot(): { state: Persisted; version: number } {
  return { state: persistedPart(useStore.getState()), version: SCHEMA_VERSION }
}

function hydratePersisted(persisted: unknown, fromVersion: number) {
  const state = normalizeState(persisted)
  const raw =
    persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : null
  return {
    projects: fromVersion < 6 ? respreadAutoColors(state.projects) : state.projects,
    sessions: state.sessions,
    notes: state.notes,
    analyses: state.analyses,
    activeTimer: normalizeActiveTimer(raw?.activeTimer),
    version: SCHEMA_VERSION,
  }
}

/** Pure helpers used outside the store */

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
