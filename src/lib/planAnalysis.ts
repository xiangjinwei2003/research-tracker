import { addDays, format } from 'date-fns'
import { weekStart } from './date'
import { projectShare, resolveSession } from './focus'
import { folderName } from './claudeLink'
import type { AnalysisResult, FocusSession, NoteEntry, Project } from './types'

/**
 * 按 PhD 申请计划分析：把申请计划目录里的材料和本应用的数据拼成一段输入，
 * 交给 sample 的 default 档，要求返回 JSON。这里只有纯函数，读文件与调用模型在 platform 与组件里。
 * 输出结构对应导师周报的三节：对照安排、问题、需要你回答的问题。
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

const hours = (min: number) => Math.round((min / 60) * 10) / 10

/** [start, end) 内的专注，按项目或事项汇总成几行文字，每个项目带时长最多的 4 项任务。 */
export function focusDigest(
  sessions: FocusSession[],
  projects: Project[],
  start: Date,
  end: Date,
): { totalHours: number; lines: string[] } {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const inRange = sessions.filter((s) => s.startedAt >= start.getTime() && s.startedAt < end.getTime())
  const resolved = inRange.map((s) => resolveSession(s, byId))
  const total = resolved.reduce((sum, r) => sum + r.minutes, 0)
  const lines = projectShare(resolved).map((g) => {
    const folder = byId.get(g.key)?.folder
    const name = folder ? `${g.name}（目录 ${folderName(folder)}）` : g.name
    const tasks = g.tasks
      .slice(0, 4)
      .map((t) => `${t.title} ${hours(t.minutes)}`)
      .join('，')
    return `${name}：${hours(g.minutes)} 小时${tasks ? `；任务：${tasks}` : ''}`
  })
  return { totalHours: hours(total), lines }
}

/** 两周内到期（含已逾期）的未完成任务，与本周勾掉的任务。归档项目不计。 */
export function taskDigest(
  projects: Project[],
  now: Date,
  start: Date,
): { due: string[]; done: string[] } {
  const today = format(now, 'yyyy-MM-dd')
  const horizon = format(addDays(now, 14), 'yyyy-MM-dd')
  const due: { date: string; line: string }[] = []
  const done: string[] = []
  for (const p of projects) {
    if (p.archived) continue
    for (const t of p.todos) {
      const title = t.title || '未命名任务'
      if (!t.done && t.endDate && t.endDate <= horizon) {
        due.push({
          date: t.endDate,
          line: `${p.title || '未命名项目'}：${title}，截止 ${t.endDate}${t.endDate < today ? '（已逾期）' : ''}`,
        })
      }
      if (t.done && t.doneAt && new Date(t.doneAt).getTime() >= start.getTime()) {
        done.push(`${p.title || '未命名项目'}：${title}，${format(new Date(t.doneAt), 'M月d日')}完成`)
      }
    }
  }
  return { due: due.sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.line), done }
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

export interface AnalysisInput {
  role: string
  state: string
  review: { name: string; text: string } | null
  scan: { ok: true; text: string } | { ok: false; reason: string }
  week: WeekRange
  now: Date
  focusThis: { totalHours: number; lines: string[] }
  focusPrev: { totalHours: number; lines: string[] }
  tasks: { due: string[]; done: string[] }
  notes: { count: number; sent: string[] }
}

const block = (lines: string[], empty: string) => (lines.length ? lines.join('\n') : empty)
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n（以下截断）` : text)

/** 交给 default 档模型的完整输入。sample 每次调用不带记忆，规则、材料和输出格式都在这一段里。 */
export function buildAnalysisInput(i: AnalysisInput): string {
  const from = format(i.week.start, 'yyyy-MM-dd')
  const to = format(i.now, 'yyyy-MM-dd')
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
    `专注时长，本周合计 ${i.focusThis.totalHours} 小时：`,
    block(i.focusThis.lines, '本周没有专注记录'),
    `上周合计 ${i.focusPrev.totalHours} 小时：`,
    block(i.focusPrev.lines, '上周没有专注记录'),
    '两周内到期或已逾期的未完成任务：',
    block(i.tasks.due, '无'),
    '本周完成的任务（2026年11月25日起才记录完成时间，更早完成的这里看不到）：',
    block(i.tasks.done, '无'),
    `本周笔记 ${i.notes.count} 条；发送到 Claude Code 的提示词：${i.notes.sent.length ? i.notes.sent.join('，') : '无'}`,
    '',
    '【工作区改动扫描】（scripts/scan.sh，最近 7 天）',
    i.scan.ok ? clip(i.scan.text, 20000) : `扫描失败：${i.scan.reason}`,
    '',
    '【任务】',
    '对照最近一次的每周安排判断本周进展。当前状态里的安排是用户确认过的；上一份周报的「下周安排」尚未确认，两者不一致时以当前状态为准，并在 issues 里指出安排需要在同步时更新。',
    '只依据上面的材料，材料里没有的写「未确认」。专注时长只说明投入，不说明交付；交付以扫描和任务记录为准，扫描看不到的写「扫描看不到」。',
    '',
    '只回复一个 JSON 对象，不要其他文字。格式：',
    '{"summary": "一句话总判断", "plan": [{"item": "安排里的项目名", "plannedHours": 8, "actualHours": 3.5, "status": "完成", "note": "依据或差距，一句话"}], "issues": [{"phenomenon": "现象", "impact": "对申请的影响", "suggestion": "一个具体建议"}], "questions": ["同步时要问用户的问题，写明答案会改变哪项安排"]}',
    'status 只用：完成、部分完成、未做、扫描看不到。plannedHours 或 actualHours 不知道时写 null。plan 按安排逐项列出；issues 按对申请的影响从大到小，最多 4 条；questions 最多 3 个。',
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
  const questions = (Array.isArray(r.questions) ? r.questions : []).map(str).filter(Boolean).slice(0, 3)
  return { summary, plan, issues, questions }
}
