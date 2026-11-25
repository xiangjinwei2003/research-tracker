import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defaultStages } from './types.ts'
import { PERSIST_NAME, unlockPersistWrites } from './persist.ts'

const mem = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, v)
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size
  },
}
;(globalThis as unknown as { localStorage: typeof localStorageMock }).localStorage = localStorageMock
;(globalThis as unknown as { window: { addEventListener: () => void } }).window = {
  addEventListener: () => {},
}
;(globalThis as unknown as { document: { addEventListener: () => void } }).document = {
  addEventListener: () => {},
}

unlockPersistWrites()
mem.clear()

// v7 的真实结构：有项目、待办、专注记录，没有 notes。store 加载时按 Schema 8 迁移。
const v7 = {
  state: {
    projects: [
      {
        id: 'p1',
        title: 'proj-a',
        description: '',
        color: 'oklch(0.72 0.15 264)',
        stage: 'data',
        stages: defaultStages(),
        startDate: '2026-05-01',
        collaborators: [],
        todos: [
          { id: 't1', title: '整理访谈记录', endDate: '2026-11-20', done: true, stage: 'data', priority: 'high' },
          { id: 't2', title: '写方法部分', endDate: '', done: false, stage: 'writing', priority: 'normal' },
        ],
        notes: '项目备注保留',
        archived: false,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
      },
    ],
    sessions: [
      { id: 's1', plannedMin: 60, startedAt: 1763600000000, endedAt: 1763603600000, completed: true, projectId: 'p1', todoId: 't1', projectTitle: 'proj-a', todoTitle: '整理访谈记录' },
    ],
    activeTimer: null,
    version: 7,
  },
  version: 7,
}
mem.set(PERSIST_NAME, JSON.stringify(v7))

const { useStore, SCHEMA_VERSION } = await import(`./store.ts?notes=${Date.now()}`)

test('v7 数据迁移到 Schema 8：项目、待办、专注记录不变，notes 为空，写回的版本为 8', async () => {
  const s = useStore.getState()
  assert.equal(s.projects.length, 1)
  assert.equal(s.projects[0].notes, '项目备注保留')
  assert.deepEqual(
    s.projects[0].todos.map((t: { title: string; done: boolean }) => [t.title, t.done]),
    [['整理访谈记录', true], ['写方法部分', false]],
  )
  assert.equal(s.sessions.length, 1)
  assert.deepEqual(s.notes, [])
  await new Promise((r) => setTimeout(r, 20))
  const saved = JSON.parse(mem.get(PERSIST_NAME)!)
  assert.equal(saved.version, SCHEMA_VERSION)
  assert.deepEqual(saved.state.notes, [])
  assert.equal(saved.state.projects[0].todos.length, 2)
})

beforeEach(() => {
  useStore.setState({ notes: [], undoStack: [] })
})

test('addNote：插在指定条目之后；可以用指定的 id 建笔记，id 已存在时改用新 id', () => {
  const { addNote } = useStore.getState()
  const a = addNote({ date: '2026-11-25', text: 'a' })
  const c = addNote({ date: '2026-11-25', text: 'c' })
  const b = addNote({ date: '2026-11-25', text: 'b', afterId: a })
  assert.deepEqual(useStore.getState().notes.map((n: { id: string }) => n.id), [a, b, c])
  assert.equal(addNote({ date: '2026-11-25', id: 'ghost-1', text: 'x' }), 'ghost-1')
  assert.notEqual(addNote({ date: '2026-11-25', id: 'ghost-1', text: 'y' }), 'ghost-1')
})

test('splitNote 与 mergeNoteUp：拆分保留缩进，合并回到拼接处', () => {
  const { addNote, splitNote, mergeNoteUp } = useStore.getState()
  const a = addNote({ date: '2026-11-25', text: '先读文献再写摘要', level: 1 })
  const b = splitNote(a, 4)
  let notes = useStore.getState().notes
  assert.deepEqual(notes.map((n: { text: string; level: number }) => [n.text, n.level]), [['先读文献', 1], ['再写摘要', 1]])
  assert.deepEqual(mergeNoteUp(b), { id: a, caret: 4 })
  notes = useStore.getState().notes
  assert.deepEqual(notes.map((n: { text: string }) => n.text), ['先读文献再写摘要'])
  // 当天第一条没有可以并入的上一条。
  assert.equal(mergeNoteUp(a), null)
})

test('mergeNoteUp 只在同一天里找上一条', () => {
  const { addNote, mergeNoteUp } = useStore.getState()
  addNote({ date: '2026-11-24', text: '昨天' })
  const today = addNote({ date: '2026-11-25', text: '今天' })
  assert.equal(mergeNoteUp(today), null)
})

test('removeNote：菜单删除可撤销并回到原位置，退格删空行不进撤销栈', () => {
  const { addNote, removeNote, undo } = useStore.getState()
  const a = addNote({ date: '2026-11-25', text: 'a' })
  const b = addNote({ date: '2026-11-25', text: 'b' })
  const c = addNote({ date: '2026-11-25', text: '' })
  assert.equal(removeNote(c), '')
  assert.equal(useStore.getState().undoStack.length, 0)
  const token = removeNote(a, { undoable: true })
  assert.ok(token)
  undo(token)
  assert.deepEqual(useStore.getState().notes.map((n: { id: string }) => n.id), [a, b])
})

test('updateNote 的关联：换项目时去掉原任务，去掉项目时一起去掉任务，缩进夹在 0 到 3', () => {
  const { addNote, updateNote } = useStore.getState()
  const id = addNote({ date: '2026-11-25', text: 'x' })
  const get = () => useStore.getState().notes.find((n: { id: string }) => n.id === id)
  updateNote(id, { projectId: 'p1', todoId: 't2' })
  assert.deepEqual([get().projectId, get().todoId], ['p1', 't2'])
  updateNote(id, { projectId: 'p2' })
  assert.deepEqual([get().projectId, get().todoId], ['p2', undefined])
  updateNote(id, { projectId: 'p1', todoId: 't1' })
  updateNote(id, { projectId: undefined, todoId: undefined })
  assert.equal('projectId' in get(), false)
  assert.equal('todoId' in get(), false)
  updateNote(id, { level: 9 })
  assert.equal(get().level, 3)
})

test('完成任务时记下 doneAt，取消完成时清除', () => {
  const { updateTodo, toggleTodoDone } = useStore.getState()
  const todo = () => useStore.getState().projects[0].todos.find((t: { id: string }) => t.id === 't2')
  updateTodo('p1', 't2', { done: true })
  assert.match(todo().doneAt, /^\d{4}-\d{2}-\d{2}T/)
  updateTodo('p1', 't2', { done: false })
  assert.equal('doneAt' in todo(), false)
  toggleTodoDone('p1', 't2')
  assert.ok(todo().doneAt)
  toggleTodoDone('p1', 't2')
  assert.equal(todo().doneAt, undefined)
  // 改别的字段不影响已完成任务的 doneAt。
  updateTodo('p1', 't2', { done: true })
  const at = todo().doneAt
  updateTodo('p1', 't2', { title: '改名' })
  assert.equal(todo().doneAt, at)
})

test('清空与导入都带上笔记，撤销后笔记回来', () => {
  const { addNote, clearAll, undo, replaceState } = useStore.getState()
  addNote({ date: '2026-11-25', text: '保留我' })
  const token = clearAll()
  assert.deepEqual(useStore.getState().notes, [])
  undo(token)
  assert.equal(useStore.getState().notes[0].text, '保留我')
  const t2 = replaceState({ projects: [], sessions: [], notes: [], version: SCHEMA_VERSION })
  assert.deepEqual(useStore.getState().notes, [])
  undo(t2)
  assert.equal(useStore.getState().notes[0].text, '保留我')
})

test('markNoteSent：发送记录按时间追加', () => {
  const { addNote, markNoteSent } = useStore.getState()
  const id = addNote({ date: '2026-11-25', text: '整理实验记录' })
  markNoteSent(id, { at: 1764030000000, folder: '/work/proj-a', prompt: '第一次' })
  markNoteSent(id, { at: 1764033600000, folder: '/work/proj-a', prompt: '第二次' })
  const sent = useStore.getState().notes.find((n: { id: string }) => n.id === id).sent
  assert.deepEqual(sent.map((x: { prompt: string }) => x.prompt), ['第一次', '第二次'])
})

test('addAnalysis：新的在最前，只保留 20 条；清空后可撤销', () => {
  const { addAnalysis, clearAll, undo } = useStore.getState()
  useStore.setState({ analyses: [] })
  const record = (id: string) => ({
    id,
    createdAt: '2026-11-25T16:00:00.000Z',
    weekStart: '2026-11-23',
    tier: 'default',
    sources: { review: null, scan: 'ok' as const },
    result: { summary: id, plan: [], issues: [], questions: [] },
  })
  for (let i = 0; i < 22; i++) addAnalysis(record(`a${i}`))
  const ids = useStore.getState().analyses.map((a: { id: string }) => a.id)
  assert.equal(ids.length, 20)
  assert.equal(ids[0], 'a21')
  const token = clearAll()
  assert.deepEqual(useStore.getState().analyses, [])
  undo(token)
  assert.equal(useStore.getState().analyses.length, 20)
})

test('删除今天第一条后，在同一个预留 id 上新建，再撤销删除：恢复的笔记换成新 id，不出现重复', () => {
  const { addNote, removeNote, undo } = useStore.getState()
  addNote({ date: '2026-11-25', id: 'ghost-day', text: '第一条' })
  const token = removeNote('ghost-day', { undoable: true })
  addNote({ date: '2026-11-25', id: 'ghost-day', text: '重新写的' })
  undo(token)
  const ids = useStore.getState().notes.map((n: { id: string }) => n.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(
    useStore.getState().notes.map((n: { text: string }) => n.text).sort(),
    ['第一条', '重新写的'],
  )
})

test('合并时发送记录并入上一条；上一条没有关联时接过关联；两条关联不同时不合并', () => {
  const { addNote, mergeNoteUp, markNoteSent, updateNote } = useStore.getState()
  const a = addNote({ date: '2026-11-25', text: '上一条' })
  const b = addNote({ date: '2026-11-25', text: '这一条', projectId: 'p1', todoId: 't2' })
  markNoteSent(b, { at: 2, folder: '/w', prompt: 'p' })
  assert.ok(mergeNoteUp(b))
  const merged = useStore.getState().notes.find((n: { id: string }) => n.id === a)
  assert.equal(merged.text, '上一条这一条')
  assert.deepEqual([merged.projectId, merged.todoId], ['p1', 't2'])
  assert.equal(merged.sent.length, 1)
  const c = addNote({ date: '2026-11-25', text: '关联到别的任务', projectId: 'p1', todoId: 't1' })
  assert.equal(mergeNoteUp(c), null)
  updateNote(c, { projectId: 'p1', todoId: 't2' })
  assert.ok(mergeNoteUp(c))
})
