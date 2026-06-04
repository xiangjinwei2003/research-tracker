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

/** Weekly importance. Absent on a todo means 'normal'. */
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
  color: string
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: { label: '本周主攻', short: '主攻', rank: 0, color: 'oklch(0.62 0.20 25)' },
  normal: { label: '一般', short: '一般', rank: 1, color: 'oklch(0.68 0.12 250)' },
  low: { label: '次要', short: '次要', rank: 2, color: 'oklch(0.64 0.02 250)' },
}

/** Priority of a todo, treating legacy todos without the field as 'normal'. */
export function todoPriority(t: { priority?: Priority }): Priority {
  return t.priority ?? 'normal'
}

export interface Todo {
  id: string
  title: string
  /** Due date — ISO YYYY-MM-DD. */
  endDate: string
  done: boolean
  /** Stage ID referencing one of the project's stages. */
  stage: Stage
  /** Weekly importance; absent = 'normal'. */
  priority?: Priority
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

export interface AppState {
  projects: Project[]
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
