import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dayHasContent,
  indentLevel,
  insertionIndex,
  legacyMemoText,
  noteDayLabel,
  notesOfDay,
  streamDays,
  subtree,
} from './notes.ts'
import { normalizeNote, normalizeState, importJSON, exportJSON, SCHEMA_VERSION } from './normalize.ts'
import type { NoteEntry } from './types.ts'

const note = (id: string, date: string, text: string, level = 0): NoteEntry => ({
  id,
  date,
  text,
  level,
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
})

test('streamDays：今天总在最前，其后是有内容的日期从新到旧，只有空行的日期不显示', () => {
  const notes = [
    note('a', '2026-11-20', '旧的'),
    note('b', '2026-11-24', ''),
    note('c', '2026-11-23', '前天'),
    note('d', '2026-11-22', '  '),
  ]
  assert.deepEqual(streamDays(notes, '2026-11-25', 10), {
    days: ['2026-11-25', '2026-11-23', '2026-11-20'],
    more: false,
  })
  assert.deepEqual(streamDays(notes, '2026-11-25', 1), { days: ['2026-11-25', '2026-11-23'], more: true })
})

test('dayHasContent：发出过提示词的空行也算有内容', () => {
  assert.equal(dayHasContent([note('a', '2026-11-25', '')]), false)
  assert.equal(
    dayHasContent([{ ...note('a', '2026-11-25', ''), sent: [{ at: 1, folder: '/x', prompt: 'p' }] }]),
    true,
  )
})

test('insertionIndex：插在指定条目之后；没有指定时放在这一天最后，没有这一天时放在末尾', () => {
  const notes = [note('a', '2026-11-24', '1'), note('b', '2026-11-25', '2'), note('c', '2026-11-24', '3')]
  assert.equal(insertionIndex(notes, '2026-11-25', 'a'), 1)
  assert.equal(insertionIndex(notes, '2026-11-24'), 3)
  assert.equal(insertionIndex(notes, '2026-11-25'), 2)
  assert.equal(insertionIndex(notes, '2026-11-26'), 3)
  assert.equal(insertionIndex(notes, '2026-11-24', 'missing'), 3)
})

test('subtree：带走同一天里紧随其后、缩进更深的条目', () => {
  const notes = [
    note('a', '2026-11-25', '父', 0),
    note('x', '2026-11-24', '别的日期', 1),
    note('b', '2026-11-25', '子', 1),
    note('c', '2026-11-25', '孙', 2),
    note('d', '2026-11-25', '同级', 0),
    note('e', '2026-11-25', '不相干的子', 1),
  ]
  assert.deepEqual(subtree(notes, 'a').map((n) => n.id), ['a', 'b', 'c'])
  assert.deepEqual(subtree(notes, 'b').map((n) => n.id), ['b', 'c'])
  assert.deepEqual(subtree(notes, 'd').map((n) => n.id), ['d', 'e'])
  assert.deepEqual(subtree(notes, 'missing'), [])
  assert.deepEqual(notesOfDay(notes, '2026-11-24').map((n) => n.id), ['x'])
})

test('indentLevel：Tab 不超过上一条加一级和上限 3；第一条不能缩进', () => {
  assert.equal(indentLevel(0, null), 0)
  assert.equal(indentLevel(0, 0), 1)
  assert.equal(indentLevel(1, 0), 1)
  assert.equal(indentLevel(2, 3), 3)
  assert.equal(indentLevel(3, 3), 3)
})

test('legacyMemoText：迁移过或便签为空时不迁移', () => {
  assert.equal(legacyMemoText('  想法\n第二行 ', false), '想法\n第二行')
  assert.equal(legacyMemoText('想法', true), null)
  assert.equal(legacyMemoText('   ', false), null)
  assert.equal(legacyMemoText(null, false), null)
})

test('noteDayLabel 输出中文日期与星期', () => {
  assert.equal(noteDayLabel('2026-11-25'), '11月25日 星期三')
})

test('normalizeNote：只拷贝已知字段，日期不合法归到今天，缩进夹在 0 到 3，任务关联需要项目', () => {
  const n = normalizeNote({
    id: 'n1',
    date: '2026-11-25',
    text: '想法',
    level: 7.6,
    todoId: 't1',
    sent: [{ at: 1764000000000, folder: '/a', prompt: 'p', sessionId: 's' }, { at: 'bad' }],
    extra: 'drop me',
  })!
  assert.equal(n.level, 3)
  assert.equal(n.projectId, undefined)
  assert.equal(n.todoId, undefined)
  assert.deepEqual(n.sent, [{ at: 1764000000000, folder: '/a', prompt: 'p', sessionId: 's' }])
  assert.equal('extra' in n, false)
  assert.match(normalizeNote({ date: '25/11/2026' })!.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(normalizeNote({ level: -2 })!.level, 0)
  assert.equal(normalizeNote('x'), null)
  const linked = normalizeNote({ projectId: 'p1', todoId: 't1' })!
  assert.deepEqual([linked.projectId, linked.todoId], ['p1', 't1'])
})

test('Schema 8：v7 数据没有 notes 时补空数组；doneAt 只在已完成时保留；folder 去掉首尾空白', () => {
  const state = normalizeState({
    version: 7,
    sessions: [],
    projects: [
      {
        id: 'p1',
        title: 'proj-a',
        folder: '  /Users/me/proj-a ',
        todos: [
          { id: 't1', title: '已完成', done: true, doneAt: '2026-11-24T10:00:00.000Z' },
          { id: 't2', title: '未完成但带了 doneAt', done: false, doneAt: '2026-11-24T10:00:00.000Z' },
        ],
      },
    ],
  })
  assert.deepEqual(state.notes, [])
  assert.equal(state.projects[0].folder, '/Users/me/proj-a')
  assert.equal(state.projects[0].todos[0].doneAt, '2026-11-24T10:00:00.000Z')
  assert.equal(state.projects[0].todos[1].doneAt, undefined)
  assert.ok(SCHEMA_VERSION >= 8)
})

test('导出再导入，笔记原样保留', () => {
  const notes = [note('a', '2026-11-25', '想法', 1)]
  const text = exportJSON({ projects: [], sessions: [], notes, version: SCHEMA_VERSION })
  assert.deepEqual(importJSON(text).notes, notes)
})

test('导入时重复的笔记 id 换成新 id', async () => {
  const { normalizeNotes } = await import('./normalize.ts')
  const list = normalizeNotes([note('same', '2026-11-25', 'a'), note('same', '2026-11-25', 'b')])
  assert.equal(list.length, 2)
  assert.notEqual(list[0].id, list[1].id)
  assert.equal(list[0].id, 'same')
})
