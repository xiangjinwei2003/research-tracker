import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeColor,
  respreadAutoColors,
  normalizeProject,
  normalizeState,
  importJSON,
  exportJSON,
  SCHEMA_VERSION,
} from './normalize.ts'
import { PROJECT_COLOR_PRESETS, LEGACY_PROJECT_COLOR_PRESETS, defaultStages } from './types.ts'

test('sanitizeColor keeps oklch and hex, drops url()', () => {
  assert.equal(sanitizeColor('oklch(0.72 0.15 264)'), 'oklch(0.72 0.15 264)')
  assert.equal(sanitizeColor('#abc'), '#abc')
  assert.equal(sanitizeColor('url(https://attacker.example/p.png)', 'oklch(0.7 0.02 250)'), 'oklch(0.7 0.02 250)')
  assert.equal(sanitizeColor('red'), 'red')
  assert.equal(sanitizeColor('#fff url/**/(https://attacker.example/p.png)', ''), '')
})

test('respreadAutoColors rewrites only the old auto slot at that index', () => {
  const stages = defaultStages()
  const dummy = {
    ...normalizeProject({ title: 'a', stage: stages[0].id, stages }),
    color: PROJECT_COLOR_PRESETS[3],
  }
  const autoOldSlot = {
    ...normalizeProject({ title: 'b', stage: stages[0].id, stages }),
    color: LEGACY_PROJECT_COLOR_PRESETS[1],
  }
  const pickedIndigo = {
    ...normalizeProject({ title: 'c', stage: stages[0].id, stages }),
    color: PROJECT_COLOR_PRESETS[0],
  }
  const rewritten = respreadAutoColors([dummy, autoOldSlot])
  assert.equal(rewritten[1].color, PROJECT_COLOR_PRESETS[1])
  const kept = respreadAutoColors([dummy, pickedIndigo])
  assert.equal(kept[1].color, PROJECT_COLOR_PRESETS[0])
})

test('normalizeProject maps milestones to todos and drops startDate', () => {
  const p = normalizeProject({
    title: 'legacy',
    milestones: [{ title: 'm1', startDate: '2020-01-01', endDate: '2020-02-01' }],
  })
  assert.equal(p.todos.length, 1)
  assert.equal(p.todos[0].title, 'm1')
  assert.equal(p.todos[0].endDate, '2020-02-01')
  assert.equal('startDate' in p.todos[0], false)
})

test('normalizeProject heals null todos and empty collaborators', () => {
  const p = normalizeProject({ title: 'x', todos: [null], collaborators: [{}] })
  assert.equal(p.todos.length, 1)
  assert.equal(typeof p.todos[0].id, 'string')
  assert.equal(p.collaborators.length, 1)
  assert.equal(p.collaborators[0].role, 'coauthor')
})

test('normalizeProject rejects a url() color', () => {
  const p = normalizeProject({ title: 'x', color: 'url(https://attacker.example/p.png)' })
  assert.equal(p.color, '')
})

test('importJSON accepts a persist envelope', () => {
  const text = JSON.stringify({
    state: {
      projects: [{ title: 'from-envelope', stage: 'literature', stages: defaultStages(), todos: [], collaborators: [] }],
      version: 7,
    },
    version: 7,
  })
  const state = importJSON(text)
  assert.equal(state.projects[0].title, 'from-envelope')
})

test('importJSON requires projects and does not respread palette colors', () => {
  assert.throws(() => importJSON('{}'))
  const text = JSON.stringify({
    projects: [
      {
        title: 'pad',
        color: PROJECT_COLOR_PRESETS[3],
        stage: 'literature',
        stages: defaultStages(),
        todos: [],
        collaborators: [],
      },
      {
        title: 'p',
        color: LEGACY_PROJECT_COLOR_PRESETS[1],
        stage: 'literature',
        stages: defaultStages(),
        todos: [],
        collaborators: [],
      },
    ],
    version: 5,
  })
  const state = importJSON(text)
  assert.equal(state.projects[1].color, LEGACY_PROJECT_COLOR_PRESETS[1])
  assert.notEqual(state.projects[1].color, PROJECT_COLOR_PRESETS[1])
  assert.equal(state.version, 5)
})

test('exportJSON round trip keeps known fields and drops unknown ones', () => {
  const incoming = JSON.stringify({
    projects: [
      {
        title: 'keep',
        extra: 'nope',
        stage: 'literature',
        stages: defaultStages(),
        todos: [],
        collaborators: [],
      },
    ],
    sessions: [{ id: 'bad' }],
  })
  const state = importJSON(incoming)
  const back = JSON.parse(exportJSON(state)) as { projects: { extra?: string }[]; sessions: unknown[] }
  assert.equal(back.projects[0].extra, undefined)
  assert.equal(back.sessions.length, 0)
  assert.equal(SCHEMA_VERSION, 7)
})

test('normalizeState heals a blob with null projects as empty', () => {
  const s = normalizeState({ projects: null })
  assert.deepEqual(s.projects, [])
})
