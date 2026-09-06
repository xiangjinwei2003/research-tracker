/**
 * Persist hydrate through a fresh store module. localStorage must be mocked
 * before each import (hydrate runs at module load).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultStages, PROJECT_COLOR_PRESETS, LEGACY_PROJECT_COLOR_PRESETS } from './types.ts'
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

const here = dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(join(here, '..', '..', 'README.md'), 'utf8')

test('README 数据与隐私 names the persist key', () => {
  assert.match(
    readme,
    /所有数据存在浏览器的 \*\*localStorage\*\*，键名 `research-tracker-v1`/,
  )
  assert.equal(PERSIST_NAME, 'research-tracker-v1')
})

test('hydrate reads a seeded persist envelope', async () => {
  unlockPersistWrites()
  mem.clear()
  mem.set(
    PERSIST_NAME,
    JSON.stringify({
      state: {
        projects: [
          {
            id: 'p1',
            title: 'seeded',
            description: '',
            color: 'oklch(0.72 0.15 264)',
            stage: 'literature',
            stages: defaultStages(),
            startDate: '2026-09-05',
            collaborators: [],
            todos: [],
            notes: '',
            archived: false,
            createdAt: '2026-09-05T00:00:00.000Z',
            updatedAt: '2026-09-05T00:00:00.000Z',
          },
        ],
        sessions: [],
        activeTimer: null,
        version: 7,
      },
      version: 7,
    }),
  )
  const { useStore } = await import(`./store.ts?hydrate=${Date.now()}`)
  const hit = useStore.getState().projects.find((p) => p.id === 'p1')
  assert.equal(hit?.title, 'seeded')
})

test('addProject writes PERSIST_NAME without undoStack', async () => {
  unlockPersistWrites()
  mem.clear()
  const { useStore, PERSIST_NAME: name } = await import(`./store.ts?write=${Date.now()}`)
  const id = useStore.getState().addProject({
    title: 'persist-write',
    description: '',
    color: 'oklch(0.78 0.10 250)',
    stage: 'literature',
    stages: defaultStages(),
    startDate: '2026-09-05',
    collaborators: [],
    todos: [],
    notes: '',
  })
  await new Promise((r) => setTimeout(r, 20))
  const raw = localStorage.getItem(name)
  assert.ok(raw)
  const parsed = JSON.parse(raw) as {
    version: number
    state: { projects: { id: string; title: string }[]; undoStack?: unknown }
  }
  assert.equal(typeof parsed.version, 'number')
  assert.ok(Array.isArray(parsed.state.projects))
  const saved = parsed.state.projects.find((p) => p.id === id)
  assert.deepEqual({ id: saved?.id, title: saved?.title }, { id, title: 'persist-write' })
  assert.equal('undoStack' in parsed.state, false)
})

test('hydrate of envelope version 5 respreads the old auto slot', async () => {
  unlockPersistWrites()
  mem.clear()
  const stages = defaultStages()
  const base = {
    description: '',
    stage: 'literature',
    stages,
    startDate: '2026-09-05',
    collaborators: [] as [],
    todos: [] as [],
    notes: '',
    archived: false,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  }
  mem.set(
    PERSIST_NAME,
    JSON.stringify({
      state: {
        projects: [
          { ...base, id: 'p0', title: 'a', color: PROJECT_COLOR_PRESETS[3] },
          { ...base, id: 'p1', title: 'b', color: LEGACY_PROJECT_COLOR_PRESETS[1] },
        ],
        sessions: [],
        activeTimer: null,
        version: 5,
      },
      version: 5,
    }),
  )
  const { useStore } = await import(`./store.ts?v5=${Date.now()}`)
  const b = useStore.getState().projects.find((p) => p.id === 'p1')
  assert.equal(b?.color, PROJECT_COLOR_PRESETS[1])
})

test('corrupt JSON does not overwrite the original blob', async () => {
  unlockPersistWrites()
  mem.clear()
  mem.set(PERSIST_NAME, '{truncated')
  const { useStore } = await import(`./store.ts?corrupt=${Date.now()}`)
  useStore.getState().addProject({
    title: 'should-not-flush',
    description: '',
    color: 'oklch(0.78 0.10 250)',
    stage: 'literature',
    stages: defaultStages(),
    startDate: '2026-09-05',
    collaborators: [],
    todos: [],
    notes: '',
  })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(mem.get(PERSIST_NAME), '{truncated')
})
