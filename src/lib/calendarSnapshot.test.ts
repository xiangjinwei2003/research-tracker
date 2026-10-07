import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSnapshot, parseSnapshot } from './calendarSnapshot.ts'
import { defaultStages, type Project } from './types.ts'

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'CHI 论文',
    description: '描述',
    color: 'oklch(0.72 0.15 264)',
    stage: 'literature',
    stages: defaultStages(),
    startDate: '2026-01-01',
    collaborators: [],
    todos: [
      {
        id: 't1',
        title: '改 discussion',
        endDate: '2026-10-20',
        done: false,
        stage: 'writing',
        priority: 'high',
        notes: '私人备注',
      },
    ],
    notes: '项目备注',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

test('buildSnapshot keeps only whitelisted fields', () => {
  const s = buildSnapshot([project()])
  assert.deepEqual(s, {
    v: 1,
    todos: [{ id: 't1', projectId: 'p1', project: 'CHI 论文', title: '改 discussion', due: '2026-10-20', done: false }],
  })
  const text = JSON.stringify(s)
  for (const leaked of ['私人备注', '项目备注', 'high', '描述']) assert.equal(text.includes(leaked), false)
})

test('buildSnapshot leaves out archived projects', () => {
  const s = buildSnapshot([project({ archived: true }), project({ id: 'p2' })])
  assert.deepEqual(
    s.todos.map((t) => t.projectId),
    ['p2'],
  )
})

test('parseSnapshot accepts what buildSnapshot produces', () => {
  const s = buildSnapshot([project()])
  const r = parseSnapshot(JSON.parse(JSON.stringify(s)))
  assert.ok(r.ok)
  assert.deepEqual(r.snapshot, s)
})

test('buildSnapshot leaves out done todos and todos without a due date', () => {
  const base = project()
  const s = buildSnapshot([
    project({
      todos: [
        { ...base.todos[0], id: 'a', done: true },
        { ...base.todos[0], id: 'b', endDate: '' },
        { ...base.todos[0], id: 'c' },
      ],
    }),
  ])
  assert.deepEqual(
    s.todos.map((t) => t.id),
    ['c'],
  )
})

test('edits outside the calendar fields leave the snapshot unchanged', () => {
  const a = buildSnapshot([project()])
  const b = buildSnapshot([project({ notes: '改了', todos: [{ ...project().todos[0], notes: '也改了', priority: 'low' }] })])
  assert.equal(JSON.stringify(a), JSON.stringify(b))
})
