import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defaultStages } from './types.ts'
import { unlockPersistWrites } from './persist.ts'

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

const { useStore, weekItems, nextDeadline } = await import(`./store.ts?actions=${Date.now()}`)

function add(title: string) {
  return useStore.getState().addProject({
    title,
    description: '',
    color: 'oklch(0.72 0.15 264)',
    stage: 'literature',
    stages: defaultStages(),
    startDate: '2026-09-05',
    collaborators: [],
    todos: [],
    notes: '',
  })
}

beforeEach(() => {
  useStore.setState({ projects: [], sessions: [], activeTimer: null, undoStack: [] })
})

test('addProject prepends and removeProject undo restores the same index', () => {
  const a = add('A')
  const b = add('B')
  assert.equal(useStore.getState().projects[0].id, b)
  const token = useStore.getState().removeProject(a)
  assert.ok(token)
  useStore.getState().undo(token)
  assert.deepEqual(useStore.getState().projects.map((p) => p.id), [b, a])
})

test("undo('') does not revert the newest entry", () => {
  const id = add('keep')
  useStore.getState().removeProject(id)
  const before = useStore.getState().projects.map((p) => p.id)
  const entry = useStore.getState().undo('')
  assert.equal(entry, null)
  assert.deepEqual(useStore.getState().projects.map((p) => p.id), before)
})

test('clearAll nulls the timer and is undoable', () => {
  add('x')
  useStore.setState({
    sessions: [
      {
        id: 's1',
        plannedMin: 30,
        startedAt: 1_000,
        endedAt: 1_000 + 30 * 60_000,
        completed: true,
      },
    ],
  })
  useStore.getState().startTimer({ plannedMin: 30 })
  assert.ok(useStore.getState().activeTimer)
  const startedAt = useStore.getState().activeTimer?.startedAt
  const token = useStore.getState().clearAll()
  assert.equal(useStore.getState().projects.length, 0)
  assert.equal(useStore.getState().sessions.length, 0)
  assert.equal(useStore.getState().activeTimer, null)
  useStore.getState().undo(token)
  assert.ok(useStore.getState().projects.length > 0)
  assert.equal(useStore.getState().sessions.length, 1)
  assert.equal(useStore.getState().activeTimer?.startedAt, startedAt)
})

test('completeTimer returns null when a session with the same startedAt already exists', () => {
  const orig = Date.now
  const now = 4_000_000
  Date.now = () => now
  try {
    useStore.getState().startTimer({ plannedMin: 30 })
    const startedAt = useStore.getState().activeTimer?.startedAt
    assert.ok(startedAt)
    useStore.setState({
      sessions: [
        {
          id: 'dup',
          plannedMin: 30,
          startedAt,
          endedAt: startedAt + 30 * 60_000,
          completed: true,
        },
      ],
    })
    const before = useStore.getState().sessions.length
    assert.equal(useStore.getState().completeTimer(), null)
    assert.equal(useStore.getState().sessions.length, before)
    assert.equal(useStore.getState().activeTimer, null)
  } finally {
    Date.now = orig
  }
})

test('replaceState keeps a running timer', () => {
  useStore.getState().startTimer({ plannedMin: 25 })
  useStore.getState().replaceState({
    projects: [],
    sessions: [],
    version: useStore.getState().version,
  })
  assert.ok(useStore.getState().activeTimer)
  useStore.getState().cancelTimer()
})

test('undo of replaceState does not restore a previous timer', () => {
  const token = useStore.getState().replaceState({
    projects: [],
    sessions: [],
    version: useStore.getState().version,
  })
  useStore.getState().startTimer({ plannedMin: 20 })
  const startedAt = useStore.getState().activeTimer?.startedAt
  useStore.getState().undo(token)
  assert.equal(useStore.getState().activeTimer?.startedAt, startedAt)
})

test('completeTimer discards spans under 60s and records a 5 minute early stop', () => {
  const orig = Date.now
  let now = 2_000_000
  Date.now = () => now
  try {
    useStore.setState({ sessions: [], activeTimer: null })
    useStore.getState().startTimer({ plannedMin: 30 })
    now += 30_000
    assert.equal(useStore.getState().completeTimer({ early: true }), null)

    useStore.getState().startTimer({ plannedMin: 30 })
    now += 5 * 60_000
    const s = useStore.getState().completeTimer({ early: true })
    assert.ok(s)
    assert.equal(s.completed, false)
    assert.equal(s.plannedMin, 30)
    assert.equal(s.endedAt - s.startedAt, 5 * 60_000)
    assert.equal(useStore.getState().sessions[0].id, s.id)
  } finally {
    Date.now = orig
  }
})

test('weekItems skips archived projects and done todos', () => {
  const stages = defaultStages()
  const items = weekItems(
    [
      {
        id: 'arch',
        title: 'archived',
        description: '',
        color: 'oklch(0.72 0.15 264)',
        stage: 'literature',
        stages,
        startDate: '2026-01-01',
        collaborators: [],
        todos: [{ id: 't0', title: 'hidden', endDate: '2026-01-02', done: false, stage: 'literature' }],
        notes: '',
        archived: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'live',
        title: 'live',
        description: '',
        color: 'oklch(0.72 0.15 264)',
        stage: 'literature',
        stages,
        startDate: '2026-01-01',
        collaborators: [],
        todos: [
          { id: 't1', title: 'due', endDate: '2026-01-02', done: false, stage: 'literature' },
          { id: 't2', title: 'done', endDate: '2026-01-02', done: true, stage: 'literature' },
        ],
        notes: '',
        archived: false,
        createdAt: '',
        updatedAt: '',
      },
    ],
    '2026-01-10',
  )
  assert.equal(items.length, 1)
  assert.equal(items[0].todo.id, 't1')
})

test('nextDeadline prefers the next date on or after today', () => {
  const stages = defaultStages()
  const p = {
    id: 'p',
    title: 'p',
    description: '',
    color: 'oklch(0.72 0.15 264)',
    stage: 'literature',
    stages,
    startDate: '2026-01-01',
    venue: { name: 'CHI', deadline: '2099-01-01' },
    collaborators: [],
    todos: [{ id: 't', title: 'old', endDate: '2000-01-01', done: false, stage: 'literature' }],
    notes: '',
    archived: false,
    createdAt: '',
    updatedAt: '',
  }
  const d = nextDeadline(p)
  assert.equal(d?.date, '2099-01-01')
})
