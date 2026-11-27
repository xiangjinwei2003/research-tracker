import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAnalysisInput,
  dueDigest,
  extractJson,
  latestReviewName,
  notesDigest,
  parseAnalysis,
  roleSection,
  weekDigest,
  weekRange,
  type WeekDigest,
} from './planAnalysis.ts'
import { normalizeAnalyses, normalizeState, SCHEMA_VERSION } from './normalize.ts'
import { defaultStages, type FocusSession, type NoteEntry, type Project } from './types.ts'

const at = (iso: string) => new Date(iso).getTime()
const NOW = new Date('2026-11-25T16:00:00') // 周三

const project = (id: string, title: string, extra: Partial<Project> = {}): Project => ({
  id,
  title,
  description: '',
  color: 'oklch(0.72 0.15 264)',
  stage: 'literature',
  stages: defaultStages(),
  startDate: '2026-11-01',
  collaborators: [],
  todos: [],
  notes: '',
  archived: false,
  createdAt: '',
  updatedAt: '',
  ...extra,
})

const session = (start: string, minutes: number, extra: Partial<FocusSession> = {}): FocusSession => ({
  id: `${start}-${minutes}`,
  plannedMin: minutes,
  startedAt: at(start),
  endedAt: at(start) + minutes * 60_000,
  completed: true,
  ...extra,
})

test('weekRange：一周从周一 00:00 开始，周日也属于这一周', () => {
  const w = weekRange(NOW)
  assert.equal(w.start.getTime(), at('2026-11-23T00:00:00'))
  assert.equal(w.end.getTime(), at('2026-11-30T00:00:00'))
  assert.equal(w.prevStart.getTime(), at('2026-11-16T00:00:00'))
  assert.equal(weekRange(new Date('2026-11-29T23:00:00')).start.getTime(), at('2026-11-23T00:00:00'))
})

const note = (id: string, date: string, text: string, extra: Partial<NoteEntry> = {}): NoteEntry => ({
  id,
  date,
  text,
  level: 0,
  createdAt: '',
  updatedAt: '',
  ...extra,
})

test('weekDigest：按开始时刻归周；项目的专注、完成、笔记、下一个截止；不属于项目的专注单列', () => {
  const projects = [
    project('p1', '示例项目', {
      folder: '/Users/me/Documents/Projects/proj-a',
      todos: [
        { id: 't2', title: '写 Method', endDate: '2026-12-02', done: false, stage: 'literature' },
        { id: 't3', title: '逾期的', endDate: '2026-11-20', done: false, stage: 'literature' },
        { id: 'd1', title: '本周完成', endDate: '', done: true, doneAt: '2026-11-24T10:00:00', stage: 'literature' },
        { id: 'd2', title: '上周完成', endDate: '', done: true, doneAt: '2026-11-21T10:00:00', stage: 'literature' },
      ],
    }),
    project('p2', '没有动静的项目'),
    project('p3', '归档的', { archived: true }),
  ]
  const sessions = [
    session('2026-11-22T23:30:00', 60, { projectId: 'p1', todoId: 't1', todoTitle: '上周的事' }),
    session('2026-11-23T00:00:00', 90, { projectId: 'p1', todoId: 't2', todoTitle: '写 Method' }),
    session('2026-11-24T09:00:00', 30, { projectId: 'p1' }),
    session('2026-11-24T20:00:00', 120, { label: '英语', manual: true }),
    session('2026-11-25T08:00:00', 30),
    session('2026-11-25T09:00:00', 30, { projectId: 'p3' }),
  ]
  const notes = [
    note('n1', '2026-11-24', '方法部分先写参与者', { projectId: 'p1' }),
    note('n2', '2026-11-24', '招募渠道', { level: 1 }),
    note('n3', '2026-11-24', '随手一记'),
    note('n4', '2026-11-22', '上周的笔记', { projectId: 'p1' }),
  ]
  const d = weekDigest(projects, sessions, notes, weekRange(NOW))
  assert.equal(d.totalMinutes, 300)
  assert.equal(d.prevTotalMinutes, 60)
  assert.deepEqual(d.projects.map((p) => p.name), ['示例项目', '没有动静的项目'])
  const p1 = d.projects[0]
  assert.equal(p1.folder, '/Users/me/Documents/Projects/proj-a')
  assert.deepEqual([p1.minutes, p1.prevMinutes], [120, 60])
  assert.deepEqual(p1.topTasks, [{ title: '写 Method', minutes: 90 }])
  assert.deepEqual(p1.done, [{ title: '本周完成', at: '11月24日' }])
  assert.deepEqual(p1.notes, ['方法部分先写参与者\n  招募渠道'])
  assert.deepEqual(p1.nextDue, { title: '逾期的', date: '2026-11-20' })
  assert.deepEqual(d.projects[1].notes, [])
  assert.deepEqual(d.others, [
    { name: '英语', minutes: 120, prevMinutes: 0 },
    { name: '自由专注', minutes: 30, prevMinutes: 0 },
    { name: '归档的', minutes: 30, prevMinutes: 0 },
  ])
  assert.deepEqual(d.looseNotes, ['随手一记'])
})

test('dueDigest：两周内到期与已逾期按日期排列，归档项目不计', () => {
  const projects = [
    project('p1', '示例项目', {
      todos: [
        { id: 'a', title: '逾期的', endDate: '2026-11-20', done: false, stage: 'literature' },
        { id: 'b', title: '两周后', endDate: '2026-12-10', done: false, stage: 'literature' },
        { id: 'c', title: '下周的', endDate: '2026-12-02', done: false, stage: 'literature' },
        { id: 'd', title: '完成了', endDate: '2026-11-26', done: true, stage: 'literature' },
      ],
    }),
    project('p2', '归档的', {
      archived: true,
      todos: [{ id: 'g', title: '不该出现', endDate: '2026-11-26', done: false, stage: 'literature' }],
    }),
  ]
  assert.deepEqual(dueDigest(projects, NOW), ['示例项目：逾期的，截止 2026-11-20（已逾期）', '示例项目：下周的，截止 2026-12-02'])
})

test('notesDigest：本周有文字的笔记条数，发送次数按目录名统计', () => {
  const sentNote = (date: string, text: string, sent: NoteEntry['sent'] = undefined): NoteEntry => ({
    id: `${date}${text}`,
    date,
    text,
    level: 0,
    createdAt: '',
    updatedAt: '',
    ...(sent ? { sent } : {}),
  })
  const notes = [
    sentNote('2026-11-23', '周一的想法', [{ at: at('2026-11-23T10:00:00'), folder: '/w/proj-a', prompt: 'p' }]),
    sentNote('2026-11-24', ''),
    sentNote('2026-11-25', '今天', [
      { at: at('2026-11-25T10:00:00'), folder: '/w/proj-a', prompt: 'p' },
      { at: at('2026-11-25T11:00:00'), folder: '/w/todo web', prompt: 'p' },
    ]),
    sentNote('2026-11-20', '上周', [{ at: at('2026-11-20T10:00:00'), folder: '/w/proj-a', prompt: 'p' }]),
  ]
  const w = weekRange(NOW)
  assert.deepEqual(notesDigest(notes, w.start, w.end), { count: 2, sent: ['proj-a 2 次', 'todo web 1 次'] })
})

test('roleSection 取「## 角色」到下一节之前；latestReviewName 取日期最新的周报', () => {
  const md = '# 标题\n\n## 这个文件夹的用途\n用途\n\n## 角色\n\n1. 判断依据\n2. 每项工作先问\n\n## 每周同步\n同步'
  assert.equal(roleSection(md), '## 角色\n\n1. 判断依据\n2. 每项工作先问')
  assert.equal(roleSection('没有角色一节'), '没有角色一节')
  assert.equal(latestReviewName(['2026-11-08.md', '2026-11-22.md', 'notes.md', '2026-11-16.md']), '2026-11-22.md')
  assert.equal(latestReviewName([]), null)
})

test('buildAnalysisInput：写明材料来源、各项目更新、扫描失败原因与输出格式，过长的材料截断', () => {
  const w = weekRange(NOW)
  const digest: WeekDigest = {
    projects: [
      {
        id: 'p1',
        name: '示例项目',
        color: '',
        folder: '/Users/me/Documents/Projects/proj-a',
        minutes: 120,
        prevMinutes: 60,
        topTasks: [{ title: '写 Method', minutes: 90 }],
        done: [{ title: '写引言', at: '11月24日' }],
        notes: ['方法部分先写参与者'],
        nextDue: { title: '交初稿', date: '2026-12-02' },
      },
      {
        id: 'p2',
        name: '没有目录的项目',
        color: '',
        minutes: 0,
        prevMinutes: 0,
        topTasks: [],
        done: [],
        notes: [],
        nextDue: null,
      },
      {
        id: 'p3',
        name: '不是仓库',
        color: '',
        folder: '/w/p3',
        minutes: 0,
        prevMinutes: 0,
        topTasks: [],
        done: [],
        notes: [],
        nextDue: null,
      },
    ],
    others: [{ name: '英语', minutes: 120, prevMinutes: 0 }],
    looseNotes: ['随手一记'],
    totalMinutes: 270,
    prevTotalMinutes: 60,
  }
  const input = buildAnalysisInput({
    role: '## 角色\n1. 判断依据只有两样',
    state: '状态'.repeat(6000),
    review: null,
    scan: { ok: false, reason: '权限不足' },
    week: w,
    now: NOW,
    digest,
    commits: {
      p1: { ok: true, lines: ['2026-11-24 写完方法部分'] },
      p3: { ok: false, reason: '目录不是 git 仓库' },
    },
    due: [],
    notes: { count: 2, sent: [] },
  })
  assert.match(input, /【导师规则】\n## 角色\n1\. 判断依据只有两样/)
  assert.match(input, /（以下截断）/)
  assert.match(input, /【上一份周报】无/)
  assert.match(input, /2026-11-23 至 2026-11-25/)
  assert.match(input, /专注合计：本周 4\.5 小时，上周 1 小时。/)
  assert.match(input, /不属于项目的专注：英语 2 小时（上周 0 小时）/)
  assert.match(input, /没有关联项目的笔记：\n随手一记/)
  assert.match(
    input,
    /### 示例项目（目录 proj-a）\n专注：本周 2 小时，上周 1 小时；任务：写 Method 1\.5\n本周完成：写引言（11月24日）\n本周笔记：\n方法部分先写参与者\n本周提交：\n2026-11-24 写完方法部分\n下一个截止：交初稿，2026-12-02/,
  )
  assert.match(input, /### 没有目录的项目\n[\s\S]*?本周提交：\n没有设置项目目录/)
  assert.match(input, /### 不是仓库（目录 p3）[\s\S]*?读取失败：目录不是 git 仓库/)
  assert.match(input, /扫描失败：权限不足/)
  assert.match(input, /"projects": \[/)
  assert.match(input, /只回复一个 JSON 对象/)
})

test('extractJson：整段、代码块、夹在文字里的对象都能取出；取不出时报错', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 })
  assert.deepEqual(extractJson('结果如下：\n```json\n{"a":2}\n```'), { a: 2 })
  assert.deepEqual(extractJson('前面一句 {"a":3} 后面一句'), { a: 3 })
  assert.throws(() => extractJson('没有 JSON'), /没有可以读取的 JSON/)
})

test('parseAnalysis：状态不在四种之内记为未确认，没有项目名的行丢弃，问题最多 4 条、提问最多 3 个', () => {
  const result = parseAnalysis({
    summary: ' 本周 proj-a 投入不足 ',
    plan: [
      { item: 'proj-a', plannedHours: 8, actualHours: 2.04, status: '部分完成', note: '只写了一节' },
      { item: '英语', plannedHours: 6, actualHours: null, status: '还行', note: '' },
      { item: '', plannedHours: 1 },
    ],
    projects: [
      { name: '示例项目', update: ' 写完方法部分 ', comment: '下周补参与者描述' },
      { name: '只有名字' },
      { update: '没有名字' },
    ],
    issues: Array.from({ length: 6 }, (_, i) => ({ phenomenon: `问题${i}`, impact: '影响', suggestion: '建议' })),
    questions: ['问一', '问二', '问三', '问四', 5],
  })
  assert.equal(result.summary, '本周 proj-a 投入不足')
  assert.deepEqual(result.plan.map((r) => [r.item, r.actualHours, r.status]), [
    ['proj-a', 2, '部分完成'],
    ['英语', null, '未确认'],
  ])
  assert.deepEqual(result.projects, [{ name: '示例项目', update: '写完方法部分', comment: '下周补参与者描述' }])
  assert.deepEqual(parseAnalysis({ summary: '判断', plan: [] }).projects, [])
  assert.equal(result.issues.length, 4)
  assert.deepEqual(result.questions, ['问一', '问二', '问三'])
  assert.throws(() => parseAnalysis({ plan: [] }), /缺少总判断/)
  assert.throws(() => parseAnalysis('文字'), /不是 JSON 对象/)
})

test('Schema 10：旧数据补空的 analyses；保存的分析结构不完整的整条丢弃，最多 20 条；没有项目点评的旧分析补空', () => {
  assert.equal(SCHEMA_VERSION, 10)
  assert.deepEqual(normalizeState({ projects: [], sessions: [], notes: [], version: 8 }).analyses, [])
  const good = {
    id: 'a1',
    createdAt: '2026-11-25T16:00:00.000Z',
    weekStart: '2026-11-23',
    tier: 'default',
    sources: { review: '2026-11-22.md', scan: 'ok' },
    result: { summary: '判断', plan: [{ item: 'proj-a', plannedHours: 8, actualHours: 3, status: '部分完成', note: '' }], issues: [], questions: [] },
  }
  const list = normalizeAnalyses([good, { result: { plan: [] } }, 'x', ...Array.from({ length: 25 }, (_, i) => ({ ...good, id: `b${i}` }))])
  assert.equal(list.length, 20)
  assert.equal(list[0].id, 'a1')
  assert.deepEqual(list[0].sources, { review: '2026-11-22.md', scan: 'ok' })
  assert.equal(normalizeAnalyses([{ ...good, sources: { scan: 'weird' } }])[0].sources.scan, 'failed')
  assert.deepEqual(list[0].result.projects, [])
  const withProjects = normalizeAnalyses([
    {
      ...good,
      sources: { review: null, scan: 'ok', commits: 2 },
      result: { ...good.result, projects: [{ name: '示例项目', update: '更新', comment: '点评' }, 'x'] },
    },
  ])[0]
  assert.deepEqual(withProjects.result.projects, [{ name: '示例项目', update: '更新', comment: '点评' }])
  assert.equal(withProjects.sources.commits, 2)
})
