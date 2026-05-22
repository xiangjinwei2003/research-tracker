export type Stage =
  | 'literature'
  | 'design'
  | 'irb'
  | 'data'
  | 'analysis'
  | 'writing'
  | 'submitted'
  | 'rebuttal'
  | 'done'

export const STAGES: { value: Stage; label: string; shortLabel: string; colorVar: string }[] = [
  { value: 'literature', label: '文献调研', shortLabel: '文献', colorVar: '--color-stage-lit' },
  { value: 'design', label: '研究设计', shortLabel: '设计', colorVar: '--color-stage-design' },
  { value: 'irb', label: 'IRB 审批', shortLabel: 'IRB', colorVar: '--color-stage-irb' },
  { value: 'data', label: '数据采集', shortLabel: '数据', colorVar: '--color-stage-data' },
  { value: 'analysis', label: '数据分析', shortLabel: '分析', colorVar: '--color-stage-analysis' },
  { value: 'writing', label: '论文写作', shortLabel: '写作', colorVar: '--color-stage-writing' },
  { value: 'submitted', label: '投稿/审稿', shortLabel: '投稿', colorVar: '--color-stage-submit' },
  { value: 'rebuttal', label: 'Rebuttal', shortLabel: 'Rebuttal', colorVar: '--color-stage-rebuttal' },
  { value: 'done', label: '完成/搁置', shortLabel: '完成', colorVar: '--color-stage-done' },
]

export const STAGE_BY_VALUE: Record<Stage, (typeof STAGES)[number]> = Object.fromEntries(
  STAGES.map((s) => [s.value, s]),
) as Record<Stage, (typeof STAGES)[number]>

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

export interface Milestone {
  id: string
  title: string
  /** ISO date string YYYY-MM-DD */
  startDate: string
  /** ISO date string YYYY-MM-DD; must be >= startDate */
  endDate: string
  done: boolean
  /** Which research stage this milestone belongs to. Required. */
  stage: Stage
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
  stage: Stage
  /** ISO date string — when the project was started, used for Gantt left edge */
  startDate: string
  venue?: Venue
  collaborators: Collaborator[]
  milestones: Milestone[]
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
