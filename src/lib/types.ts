/** A stage ID local to a single project's `stages` array. */
export type Stage = string

export interface StageDef {
  id: string
  name: string
  shortLabel: string
  /** Any valid CSS color string (hex, rgb, oklch, etc). */
  color: string
}

/** The default 9-stage HCI / CSCW pipeline. New projects start with this. */
export function defaultStages(): StageDef[] {
  return [
    { id: 'literature', name: '文献调研', shortLabel: '文献', color: 'oklch(0.78 0.10 250)' },
    { id: 'design', name: '研究设计', shortLabel: '设计', color: 'oklch(0.78 0.10 200)' },
    { id: 'irb', name: 'IRB 审批', shortLabel: 'IRB', color: 'oklch(0.80 0.10 100)' },
    { id: 'data', name: '数据采集', shortLabel: '数据', color: 'oklch(0.78 0.10 150)' },
    { id: 'analysis', name: '数据分析', shortLabel: '分析', color: 'oklch(0.78 0.10 50)' },
    { id: 'writing', name: '论文写作', shortLabel: '写作', color: 'oklch(0.78 0.10 320)' },
    { id: 'submitted', name: '投稿/审稿', shortLabel: '投稿', color: 'oklch(0.78 0.10 0)' },
    { id: 'rebuttal', name: 'Rebuttal', shortLabel: 'Rebuttal', color: 'oklch(0.78 0.10 30)' },
    { id: 'done', name: '完成/搁置', shortLabel: '完成', color: 'oklch(0.70 0.05 250)' },
  ]
}

const FALLBACK_STAGE: StageDef = {
  id: '__unknown',
  name: '未指定',
  shortLabel: '未指定',
  color: 'oklch(0.70 0.02 250)',
}

/** Lookup a stage definition by id within a project's stages, with a safe fallback. */
export function findStage(stages: StageDef[], id: string): StageDef {
  return stages.find((s) => s.id === id) ?? FALLBACK_STAGE
}

export type CollaboratorRole = 'advisor' | 'coauthor' | 'student' | 'other'

export const ROLES: { value: CollaboratorRole; label: string }[] = [
  { value: 'advisor', label: '导师' },
  { value: 'coauthor', label: '合作者' },
  { value: 'student', label: '学生' },
  { value: 'other', label: '其他' },
]

export interface Collaborator {
  id: string
  name: string
  role: CollaboratorRole
  /** What we're waiting on them for. Empty string = not blocked on them. */
  waitingFor: string
}

/** Todo importance / priority. Absent on a todo means 'normal'. */
export type Priority = 'high' | 'normal' | 'low'

/** Most-important-first; also the cycle order for the priority toggle. */
export const PRIORITY_ORDER: Priority[] = ['high', 'normal', 'low']

export interface PriorityMeta {
  /** Full label, e.g. weekly-view group headers. */
  label: string
  /** Compact label for chips. */
  short: string
  /** Lower = more important. Used for sorting. */
  rank: number
  /** Chip classes (border + bg + text), light + dark — WCAG-AA legible. */
  chip: string
  /** Accent text color (light + dark) for counts / labels. */
  text: string
  /** Dot indicator background (light + dark). */
  dot: string
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: {
    label: '本周主攻',
    short: '主攻',
    rank: 0,
    chip: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  normal: {
    label: '一般',
    short: '一般',
    rank: 1,
    chip: 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/50 dark:text-brand-300',
    text: 'text-brand-600 dark:text-brand-400',
    dot: 'bg-brand-500',
  },
  low: {
    label: '次要',
    short: '次要',
    rank: 2,
    chip: 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    text: 'text-neutral-500 dark:text-neutral-400',
    dot: 'bg-neutral-400 dark:bg-neutral-500',
  },
}

/**
 * Priority of a todo. Legacy todos without the field — and any out-of-union
 * value from imported / hand-edited JSON — resolve to 'normal', so the
 * `PRIORITY_META[...]` lookups in sorting and rendering never crash.
 */
export function todoPriority(t: { priority?: Priority }): Priority {
  return t.priority && t.priority in PRIORITY_META ? t.priority : 'normal'
}

export interface Todo {
  id: string
  title: string
  /** Due date — ISO YYYY-MM-DD. */
  endDate: string
  done: boolean
  /** Stage ID referencing one of the project's stages. */
  stage: Stage
  /** Importance / priority (drives the 本周 view ordering); absent = 'normal'. */
  priority?: Priority
  /**
   * Manually pinned into 本周重点 from the project overview, so it shows there
   * even when its due date is outside the rolling window. Absent = not pinned.
   */
  inWeek?: boolean
  notes?: string
}

export interface Venue {
  /** e.g. CHI / CSCW / JMIR / custom */
  name: string
  /** ISO date string YYYY-MM-DD — submission deadline */
  deadline: string
  /** rebuttal start (optional) */
  rebuttalAt?: string
}

export interface Project {
  id: string
  title: string
  description: string
  /**
   * Per-project accent color (a raw CSS color string, e.g. oklch). Used as a
   * quiet identity cue so cards from the same project group visually in 本周重点.
   * Always non-empty after normalization (auto-assigned from PROJECT_COLOR_PRESETS).
   */
  color: string
  /** Current main stage; must be an id in `stages`. */
  stage: Stage
  /** Ordered list of stages available for this project. Each project has its own pipeline. */
  stages: StageDef[]
  /** ISO date string — when the project was started, used for Gantt left edge */
  startDate: string
  venue?: Venue
  collaborators: Collaborator[]
  todos: Todo[]
  /** Free-form notes */
  notes: string
  /** Hidden from main views (kept for history) */
  archived: boolean
  createdAt: string
  updatedAt: string
}

/** One recorded focus session — a countdown that ran, fully or partially. */
export interface FocusSession {
  id: string
  /** Chosen countdown length in minutes (30 | 60). */
  plannedMin: number
  /** Epoch ms. */
  startedAt: number
  endedAt: number
  /** True when the countdown ran to 0 (vs ended early). */
  completed: boolean
  /** Binding to a todo/project; absent = 自由专注. */
  projectId?: string
  todoId?: string
  /** Denormalized snapshots so 回顾 survives project/todo deletion. */
  projectTitle?: string
  todoTitle?: string
  /** Project accent color snapshot (raw CSS color). */
  color?: string
}

/** The running countdown. Persisted so a reload keeps it ticking. */
export interface ActiveTimer {
  startedAt: number
  plannedMin: number
  projectId?: string
  todoId?: string
  projectTitle?: string
  todoTitle?: string
  color?: string
}

export interface AppState {
  projects: Project[]
  /** Recorded focus sessions, newest first. */
  sessions: FocusSession[]
  /** Schema version, for future migrations */
  version: number
}

export const PRESET_VENUES = [
  'CHI',
  'CSCW',
  'UIST',
  'IUI',
  'DIS',
  'JMIR',
  'JAMIA',
  'TOCHI',
  'IJHCS',
] as const

/**
 * Per-project accent palette. Ordered so that CONSECUTIVE entries are far apart
 * on the hue wheel — projects are auto-assigned colours by position, so this
 * ordering makes the first several projects maximally distinguishable (the first
 * five are ≥120° apart) instead of a blue→green run that's hard to tell apart.
 */
export const PROJECT_COLOR_PRESETS = [
  'oklch(0.72 0.15 264)', // indigo
  'oklch(0.71 0.16 40)', // orange
  'oklch(0.74 0.14 162)', // green
  'oklch(0.69 0.16 328)', // magenta
  'oklch(0.80 0.13 96)', // yellow
  'oklch(0.72 0.13 230)', // blue
  'oklch(0.68 0.17 18)', // red
  'oklch(0.74 0.12 196)', // teal
  'oklch(0.68 0.15 300)', // purple
  'oklch(0.77 0.15 66)', // amber
  'oklch(0.78 0.14 132)', // lime
  'oklch(0.70 0.16 350)', // pink
] as const

/**
 * The previous (sequential) preset ordering. Used only to detect a project whose
 * colour was AUTO-assigned under the old order, so a one-time migration can
 * re-spread those to the new distinct order while leaving hand-picked colours
 * (which won't match any of these) untouched.
 */
export const LEGACY_PROJECT_COLOR_PRESETS: readonly string[] = [
  'oklch(0.72 0.15 264)',
  'oklch(0.72 0.13 230)',
  'oklch(0.74 0.12 196)',
  'oklch(0.74 0.14 162)',
  'oklch(0.78 0.14 132)',
  'oklch(0.80 0.13 96)',
  'oklch(0.77 0.15 66)',
  'oklch(0.71 0.16 40)',
  'oklch(0.68 0.17 18)',
  'oklch(0.70 0.16 350)',
  'oklch(0.69 0.16 328)',
  'oklch(0.68 0.15 300)',
]

/** Common color presets for the stage color picker. */
export const STAGE_COLOR_PRESETS = [
  'oklch(0.78 0.10 250)',
  'oklch(0.78 0.10 200)',
  'oklch(0.80 0.10 100)',
  'oklch(0.78 0.10 150)',
  'oklch(0.78 0.10 50)',
  'oklch(0.78 0.10 320)',
  'oklch(0.78 0.10 0)',
  'oklch(0.78 0.10 30)',
  'oklch(0.70 0.05 250)',
  'oklch(0.72 0.13 280)',
  'oklch(0.75 0.13 130)',
  'oklch(0.70 0.05 30)',
] as const
