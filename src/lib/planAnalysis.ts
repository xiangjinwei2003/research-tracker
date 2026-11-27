import { addDays, format } from 'date-fns'
import { weekStart } from './date'
import { projectShare, resolveSession } from './focus'
import { notesOfDay } from './notes'
import { outlineText } from './promptDraft'
import { folderName } from './claudeLink'
import type { AnalysisResult, FocusSession, NoteEntry, Project } from './types'

/**
 * 博士申请模块的数据与模型输入：把申请计划目录里的材料和本应用的数据拼成一段输入，
 * 交给 sample 的 default 档，要求返回 JSON。这里只有纯函数，读文件、运行命令与调用模型在 platform 与组件里。
 * 输出结构：总判断、对照安排、各项目本周更新与点评、问题与建议、需要用户回答的问题。
 */

export interface WeekRange {
  start: Date
  end: Date
  prevStart: Date
}

/** 本周（周一 00:00 起）与上一周的边界。 */
export function weekRange(now: Date): WeekRange {
  const start = weekStart(now)
  return { start, end: addDays(start, 7), prevStart: addDays(start, -7) }
}

/** 分钟换成小时，保留一位小数。 */
export function hoursOf(min: number): number {
  return Math.round((min / 60) * 10) / 10
}

/** 一个项目这一周的情况。博士申请页的表格和交给模型的材料都由它生成。 */
export interface ProjectWeek {
  id: string
  name: string
  color: string
  folder?: string
  minutes: number
  prevMinutes: number
  /** 本周专注时长最多的任务，最多 4 项，不含未关联任务的专注。 */
  topTasks: { title: string; minutes: number }[]
  /** 本周勾掉的任务（按 doneAt），早的在前；at 为「11月24日」。 */
  done: { title: string; at: string }[]
  /** 本周关联到这个项目的笔记，每条连同子条目。 */
  notes: string[]
  /** 最近的未完成且有截止日期的任务，含已逾期。 */
  nextDue: { title: string; date: string } | null
}

/** 不属于未归档项目的专注：自定义事项、自由专注、已归档项目。 */
export interface OtherFocus {
  name: string
  minutes: number
  prevMinutes: number
}

export interface WeekDigest {
  projects: ProjectWeek[]
  others: OtherFocus[]
  /** 本周没有关联项目的笔记，按日期和顺序，带相对缩进。 */
  looseNotes: string[]
  totalMinutes: number
  prevTotalMinutes: number
}

const inRange = (ms: number, start: Date, end: Date) => ms >= start.getTime() && ms < end.getTime()

/** 一周的笔记按是否关联项目分开：关联项目的条目连同子条目归到项目，其余逐条保留缩进。 */
function splitWeekNotes(notes: NoteEntry[], start: Date, end: Date) {
  const startIso = format(start, 'yyyy-MM-dd')
  const endIso = format(end, 'yyyy-MM-dd')
  const days = [...new Set(notes.filter((n) => n.date >= startIso && n.date < endIso).map((n) => n.date))].sort()
  const byProject = new Map<string, string[]>()
  const loose: string[] = []
  for (const date of days) {
    const day = notesOfDay(notes, date)
    for (let i = 0; i < day.length; ) {
      const n = day[i]
      if (n.projectId) {
        let j = i + 1
        while (j < day.length && day[j].level > n.level) j++
        const text = outlineText(day.slice(i, j))
        if (text) byProject.set(n.projectId, [...(byProject.get(n.projectId) ?? []), text])
        i = j
      } else {
        if (n.text.trim()) loose.push(`${'  '.repeat(n.level)}${n.text.trim()}`)
        i++
      }
    }
  }
  return { byProject, loose }
}

/**
 * 这一周每个未归档项目的专注、完成、笔记与下一个截止，加上不属于项目的专注和笔记。
 * 项目按本周专注时长排列，本周没有任何记录的项目排在最后，保持原来的顺序。
 */
export function weekDigest(
  projects: Project[],
  sessions: FocusSession[],
  notes: NoteEntry[],
  week: WeekRange,
): WeekDigest {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const resolve = (from: Date, to: Date) =>
    sessions.filter((s) => inRange(s.startedAt, from, to)).map((s) => resolveSession(s, byId))
  const thisWeek = resolve(week.start, week.end)
  const lastWeek = resolve(week.prevStart, week.start)
  const shares = new Map(projectShare(thisWeek).map((g) => [g.key, g]))
  const prevShares = new Map(projectShare(lastWeek).map((g) => [g.key, g]))
  const { byProject, loose } = splitWeekNotes(notes, week.start, week.end)

  const live = projects.filter((p) => !p.archived)
  const rows: ProjectWeek[] = live.map((p) => {
    const share = shares.get(p.id)
    const done = p.todos
      .filter((t) => t.done && t.doneAt && inRange(new Date(t.doneAt).getTime(), week.start, week.end))
      .sort((a, b) => (a.doneAt ?? '').localeCompare(b.doneAt ?? ''))
      .map((t) => ({ title: t.title || '未命名任务', at: format(new Date(t.doneAt!), 'M月d日') }))
    const due = p.todos
      .filter((t) => !t.done && t.endDate)
      .sort((a, b) => a.endDate.localeCompare(b.endDate))[0]
    return {
      id: p.id,
      name: p.title || '未命名项目',
      color: p.color,
      ...(p.folder ? { folder: p.folder } : {}),
      minutes: share?.minutes ?? 0,
      prevMinutes: prevShares.get(p.id)?.minutes ?? 0,
      topTasks: (share?.tasks ?? [])
        .filter((t) => t.key !== '__none')
        .slice(0, 4)
        .map((t) => ({ title: t.title, minutes: t.minutes })),
      done,
      notes: byProject.get(p.id) ?? [],
      nextDue: due ? { title: due.title || '未命名任务', date: due.endDate } : null,
    }
  })
  const active = (r: ProjectWeek) => r.minutes > 0 || r.done.length > 0 || r.notes.length > 0
  const order = new Map(rows.map((r, i) => [r.id, i]))
  rows.sort(
    (a, b) =>
      Number(active(b)) - Number(active(a)) ||
      b.minutes - a.minutes ||
      b.done.length - a.done.length ||
      order.get(a.id)! - order.get(b.id)!,
  )

  const liveIds = new Set(live.map((p) => p.id))
  const otherKeys = [...new Set([...shares.keys(), ...prevShares.keys()])].filter((k) => !liveIds.has(k))
  const others = otherKeys
    .map((k) => ({
      name: (shares.get(k) ?? prevShares.get(k))!.name,
      minutes: shares.get(k)?.minutes ?? 0,
      prevMinutes: prevShares.get(k)?.minutes ?? 0,
    }))
    .sort((a, b) => b.minutes - a.minutes || b.prevMinutes - a.prevMinutes)

  const sum = (list: { minutes: number }[]) => list.reduce((n, r) => n + r.minutes, 0)
  return {
    projects: rows,
    others,
    looseNotes: loose,
    totalMinutes: sum(thisWeek),
    prevTotalMinutes: sum(lastWeek),
  }
}

/** 两周内到期（含已逾期）的未完成任务，按日期排列。归档项目不计。 */
export function dueDigest(projects: Project[], now: Date): string[] {
  const today = format(now, 'yyyy-MM-dd')
  const horizon = format(addDays(now, 14), 'yyyy-MM-dd')
  const due: { date: string; line: string }[] = []
  for (const p of projects) {
    if (p.archived) continue
    for (const t of p.todos) {
      if (t.done || !t.endDate || t.endDate > horizon) continue
      due.push({
        date: t.endDate,
        line: `${p.title || '未命名项目'}：${t.title || '未命名任务'}，截止 ${t.endDate}${t.endDate < today ? '（已逾期）' : ''}`,
      })
    }
  }
  return due.sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.line)
}

/** 本周的笔记条数，以及发送到 Claude Code 的提示词按目录统计。 */
export function notesDigest(notes: NoteEntry[], start: Date, end: Date): { count: number; sent: string[] } {
  const startIso = format(start, 'yyyy-MM-dd')
  const endIso = format(end, 'yyyy-MM-dd')
  const week = notes.filter((n) => n.date >= startIso && n.date < endIso && n.text.trim())
  const perFolder = new Map<string, number>()
  for (const n of notes) {
    for (const s of n.sent ?? []) {
      if (s.at < start.getTime() || s.at >= end.getTime()) continue
      const key = s.folder ? folderName(s.folder) : '未指定目录'
      perFolder.set(key, (perFolder.get(key) ?? 0) + 1)
    }
  }
  return {
    count: week.length,
    sent: [...perFolder.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} 次`),
  }
}

/** AGENTS.md 里「## 角色」一节；没有这一节时取全文开头，最多 4000 字。 */
export function roleSection(agentsMd: string): string {
  const at = agentsMd.search(/^## 角色\s*$/m)
  if (at === -1) return agentsMd.slice(0, 4000)
  const rest = agentsMd.slice(at)
  const next = rest.slice(1).search(/^## /m)
  return (next === -1 ? rest : rest.slice(0, next + 1)).trim()
}

/** reviews/ 下日期最新的周报文件名。 */
export function latestReviewName(names: string[]): string | null {
  const reports = names.filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n)).sort()
  return reports.length ? reports[reports.length - 1] : null
}

/** 一个项目目录本周的 git 提交：成功时每条一行「日期 标题」，失败时写原因。 */
export type CommitLog = { ok: true; lines: string[] } | { ok: false; reason: string }

export interface AnalysisInput {
  role: string
  state: string
  review: { name: string; text: string } | null
  scan: { ok: true; text: string } | { ok: false; reason: string }
  week: WeekRange
  now: Date
  digest: WeekDigest
  /** 按项目 id；没有设置目录的项目不在里面。 */
  commits: Record<string, CommitLog>
  due: string[]
  notes: { count: number; sent: string[] }
}

const block = (lines: string[], empty: string) => (lines.length ? lines.join('\n') : empty)
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n（以下截断）` : text)

/** 一个项目在模型输入里的一节。 */
function projectSection(p: ProjectWeek, commits: CommitLog | undefined): string {
  const name = p.folder ? `${p.name}（目录 ${folderName(p.folder)}）` : p.name
  const tasks = p.topTasks.map((t) => `${t.title} ${hoursOf(t.minutes)}`).join('，')
  const commitText = !p.folder
    ? '没有设置项目目录'
    : !commits
      ? '没有读取'
      : commits.ok
        ? block(commits.lines.slice(0, 20), '无')
        : `读取失败：${commits.reason}`
  return [
    `### ${name}`,
    `专注：本周 ${hoursOf(p.minutes)} 小时，上周 ${hoursOf(p.prevMinutes)} 小时${tasks ? `；任务：${tasks}` : ''}`,
    `本周完成：${p.done.length ? p.done.map((d) => `${d.title}（${d.at}）`).join('；') : '无'}`,
    '本周笔记：',
    p.notes.length ? clip(p.notes.join('\n'), 1500) : '无',
    '本周提交：',
    commitText,
    `下一个截止：${p.nextDue ? `${p.nextDue.title}，${p.nextDue.date}` : '无'}`,
  ].join('\n')
}

/** 交给 default 档模型的完整输入。sample 每次调用不带记忆，规则、材料和输出格式都在这一段里。 */
export function buildAnalysisInput(i: AnalysisInput): string {
  const from = format(i.week.start, 'yyyy-MM-dd')
  const to = format(i.now, 'yyyy-MM-dd')
  const d = i.digest
  const others = d.others.map((o) => `${o.name} ${hoursOf(o.minutes)} 小时（上周 ${hoursOf(o.prevMinutes)} 小时）`)
  return [
    '你是用户的 PhD 申请导师。下面「导师规则」是用户为这个角色写的规则，判断时遵守。',
    '',
    '【导师规则】',
    clip(i.role, 4000),
    '',
    '【当前状态】（用户确认过的事实与安排）',
    clip(i.state, 8000),
    '',
    i.review
      ? `【上一份周报 ${i.review.name}】（其中「下周安排」由导师提出，用户尚未确认）\n${clip(i.review.text, 6000)}`
      : '【上一份周报】无',
    '',
    `【本周数据】${from} 至 ${to}，一周从周一开始。以下来自 Research Tracker。`,
    `专注合计：本周 ${hoursOf(d.totalMinutes)} 小时，上周 ${hoursOf(d.prevTotalMinutes)} 小时。`,
    `不属于项目的专注：${others.length ? others.join('；') : '无'}`,
    '两周内到期或已逾期的未完成任务：',
    block(i.due, '无'),
    `本周笔记 ${i.notes.count} 条；发送到 Claude Code 的提示词：${i.notes.sent.length ? i.notes.sent.join('，') : '无'}`,
    '没有关联项目的笔记：',
    d.looseNotes.length ? clip(d.looseNotes.join('\n'), 2000) : '无',
    '',
    '【各项目本周更新】（完成时间从 2026年11月25日起才有记录；提交来自项目目录的 git log）',
    d.projects.map((p) => projectSection(p, i.commits[p.id])).join('\n\n') || '没有项目',
    '',
    '【工作区改动扫描】（scripts/scan.sh，最近 7 天）',
    i.scan.ok ? clip(i.scan.text, 20000) : `扫描失败：${i.scan.reason}`,
    '',
    '【任务】',
    '对照最近一次的每周安排判断本周进展，并对每个项目本周的更新给出点评和建议，说明它对 PhD 申请的意义。当前状态里的安排是用户确认过的；上一份周报的「下周安排」尚未确认，两者不一致时以当前状态为准，并在 issues 里指出安排需要在同步时更新。',
    '只依据上面的材料，材料里没有的写「未确认」。专注时长只说明投入，不说明交付；交付以提交、扫描和任务记录为准，看不到的写「扫描看不到」。',
    '',
    '只回复一个 JSON 对象，不要其他文字。格式：',
    '{"summary": "一句话总判断", "plan": [{"item": "安排里的项目名", "plannedHours": 8, "actualHours": 3.5, "status": "完成", "note": "依据或差距，一句话"}], "projects": [{"name": "项目名，与「各项目本周更新」里一致", "update": "本周更新，一两句，只写材料里有的", "comment": "点评与建议，一两句"}], "issues": [{"phenomenon": "现象", "impact": "对申请的影响", "suggestion": "一个具体建议"}], "questions": ["同步时要问用户的问题，写明答案会改变哪项安排"]}',
    'status 只用：完成、部分完成、未做、扫描看不到。plannedHours 或 actualHours 不知道时写 null。plan 按安排逐项列出；projects 按「各项目本周更新」的顺序，本周没有任何更新且不在安排里的项目省略；issues 按对申请的影响从大到小，最多 4 条；questions 最多 3 个。',
    '文字要求：判断带主体，数字写原始值，不用破折号和连字符连接句子，不用比喻，不用口语，不写开场白和总结。',
  ].join('\n')
}

/**
 * 从模型回复里取出 JSON：整段是 JSON；否则取一个 Markdown 代码块；否则取第一个 { 到最后一个 }。
 * 与 sample.json 的读取规则一致。取不出时报错。
 */
export function extractJson(text: string): unknown {
  const attempts = [text.trim()]
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) attempts.push(fence[1].trim())
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1))
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate)
    } catch {
      // 换下一种取法
    }
  }
  throw new Error('Claude 的回复里没有可以读取的 JSON')
}

const STATUSES = ['完成', '部分完成', '未做', '扫描看不到'] as const

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null)

/** 校验模型返回的 JSON。缺少 summary 或 plan 时报错，其余字段只保留合规的条目。 */
export function parseAnalysis(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== 'object') throw new Error('Claude 返回的不是 JSON 对象')
  const r = raw as Record<string, unknown>
  const summary = str(r.summary)
  if (!summary || !Array.isArray(r.plan)) throw new Error('Claude 返回的结果缺少总判断或安排对照')
  const plan = r.plan
    .map((row) => {
      const x = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
      const status = str(x.status)
      return {
        item: str(x.item),
        plannedHours: num(x.plannedHours),
        actualHours: num(x.actualHours),
        status: (STATUSES as readonly string[]).includes(status) ? status : '未确认',
        note: str(x.note),
      }
    })
    .filter((row) => row.item)
  const issues = (Array.isArray(r.issues) ? r.issues : [])
    .map((row) => {
      const x = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
      return { phenomenon: str(x.phenomenon), impact: str(x.impact), suggestion: str(x.suggestion) }
    })
    .filter((row) => row.phenomenon)
    .slice(0, 4)
  const projects = (Array.isArray(r.projects) ? r.projects : [])
    .map((row) => {
      const x = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
      return { name: str(x.name), update: str(x.update), comment: str(x.comment) }
    })
    .filter((row) => row.name && (row.update || row.comment))
    .slice(0, 12)
  const questions = (Array.isArray(r.questions) ? r.questions : []).map(str).filter(Boolean).slice(0, 3)
  return { summary, plan, projects, issues, questions }
}
