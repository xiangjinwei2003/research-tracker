/** A stage ID local to a single project's `stages` array. */
export type Stage = string

export interface StageDef {
  id: string
  name: string
  shortLabel: string
  /** Concrete CSS color (hex, rgb, oklch, named). url() is rejected on import. */
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

export type CollaboratorRole = 'advisor' | 'coauthor' | 'student' | 'other'

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
  /** Accent text color (dark-only) for counts / labels. */
  text: string
  /** Dot indicator background (dark-only). */
  dot: string
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: {
    label: '高优先级',
    short: '高',
    rank: 0,
    text: 'text-[var(--priority-high)]',
    dot: 'bg-[var(--priority-high)]',
  },
  normal: {
    label: '普通优先级',
    short: '普通',
    rank: 1,
    text: 'text-[var(--priority-normal)]',
    dot: 'bg-[var(--priority-normal)]',
  },
  low: {
    label: '低优先级',
    short: '低',
    rank: 2,
    text: 'text-[var(--priority-low)]',
    dot: 'bg-[var(--priority-low)]',
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
   * 待分配：新建后还没定优先级。首页把它放在单独的「待分配」组，直到用户
   * 指定优先级（updateTodo 里设置 priority 会清掉此标记）。Absent = 已分配。
   */
  pending?: boolean
  /**
   * Manually pinned into 本周重点 from the project overview, so it shows there
   * even when its due date is outside the rolling window. Absent = not pinned.
   */
  inWeek?: boolean
  notes?: string
  /** 勾掉的时刻（ISO）。取消勾选时清除；Schema 8 之前完成的任务没有这个字段。 */
  doneAt?: string
}

export interface Venue {
  /** e.g. CHI / CSCW / JMIR / custom */
  name: string
  /** ISO date string YYYY-MM-DD — submission deadline */
  deadline: string
  /** rebuttal start (optional) */
  rebuttalAt?: string
}

/** 项目标签，可多选。 */
export type ProjectTag = 'waiting' | 'active' | 'urgent' | 'casual'

/** 菜单与项目行里的显示顺序。 */
export const PROJECT_TAG_ORDER: ProjectTag[] = ['waiting', 'active', 'urgent', 'casual']

/** 颜色取自 Radix Colors 暗色色阶：step 3 作底色，step 11 作文字色。 */
export const PROJECT_TAG_META: Record<ProjectTag, { label: string; bg: string; text: string }> = {
  waiting: { label: '等待', bg: '#302008', text: '#ffca16' }, // amber
  active: { label: '推进', bg: '#132d21', text: '#3dd68c' }, // green
  urgent: { label: '急迫', bg: '#3b1219', text: '#ff9592' }, // red
  casual: { label: '随意', bg: '#212225', text: '#b0b4ba' }, // slate
}

export interface Project {
  id: string
  title: string
  description: string
  /** 标签，按 PROJECT_TAG_ORDER 排序且不重复。Absent = 无标签。 */
  tags?: ProjectTag[]
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
  /** 本机项目目录的绝对路径，发送到 Claude Code 时作工作目录。Absent = 未设置。 */
  folder?: string
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
  /** True when the countdown ran to 0 (vs ended early). 补记的记录为 true。 */
  completed: boolean
  /** 事后手动补记，没有经过倒计时，开始与结束时刻只用于归到某一天。Absent = 计时器记录。 */
  manual?: true
  /** 不属于任何项目的自定义事项（如「英语」），只出现在专注记录里。有 projectId 时不使用。 */
  label?: string
  /** 备注。 */
  note?: string
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

/** 笔记发送到 Claude Code 的一次记录。 */
export interface NoteSent {
  /** 发送时刻，epoch ms。 */
  at: number
  /** 工作目录（绝对路径）。 */
  folder: string
  /** 实际发送的提示词。 */
  prompt: string
  /** 对应的 Claude Code 会话 id，找到后写入。 */
  sessionId?: string
}

/** 每日笔记的缩进上限：0 到 3 级。 */
export const NOTE_MAX_LEVEL = 3

/** 每日笔记的一条。同一天的条目按数组里的先后排列。 */
export interface NoteEntry {
  id: string
  /** 所属日期，本地日期 YYYY-MM-DD。 */
  date: string
  text: string
  /** 缩进层级，0 到 NOTE_MAX_LEVEL。 */
  level: number
  createdAt: string
  updatedAt: string
  /** 关联的项目。有 todoId 时一定有 projectId。 */
  projectId?: string
  todoId?: string
  /** 发送到 Claude Code 的记录，早的在前。 */
  sent?: NoteSent[]
}

/** 博士申请模块的点评结果：对照安排、各项目本周更新与点评、问题与建议、需要用户回答的问题。 */
export interface AnalysisResult {
  summary: string
  plan: {
    item: string
    plannedHours: number | null
    actualHours: number | null
    /** 完成、部分完成、未做、扫描看不到；模型给了别的值时为「未确认」。 */
    status: string
    note: string
  }[]
  /** 各项目本周更新与点评，Schema 10 起；更早的分析为空。 */
  projects: { name: string; update: string; comment: string }[]
  issues: { phenomenon: string; impact: string; suggestion: string }[]
  questions: string[]
}

/** 保存下来的一次分析。 */
export interface AnalysisRecord {
  id: string
  createdAt: string
  /** 被分析那一周的周一，YYYY-MM-DD。 */
  weekStart: string
  /** 实际回答的模型档位。 */
  tier: string
  /** 依据：周报文件名，改动扫描是否成功，读到提交记录的项目目录数（Schema 10 起）。 */
  sources: { review: string | null; scan: 'ok' | 'failed'; scanNote?: string; commits?: number }
  result: AnalysisResult
}

/** 最多保存的分析条数，新的在前。 */
export const ANALYSIS_KEEP = 20

export interface AppState {
  projects: Project[]
  /** Recorded focus sessions, newest first. */
  sessions: FocusSession[]
  /** 每日笔记，Schema 8 起。 */
  notes: NoteEntry[]
  /** 博士申请模块的点评，新的在前，Schema 9 起。 */
  analyses: AnalysisRecord[]
  /** Schema version, for future migrations */
  version: number
}

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
