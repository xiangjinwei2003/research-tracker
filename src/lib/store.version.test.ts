/**
 * 多个标签页、不同版本的代码同时开着时的保护。store 在模块加载时水合，先准备好 localStorage。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultStages } from './types.ts'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}
;(globalThis as unknown as { window: { addEventListener: () => void } }).window = { addEventListener: () => {} }
;(globalThis as unknown as { document: { addEventListener: () => void } }).document = { addEventListener: () => {} }

const project = {
  id: 'p1',
  title: '示例项目',
  description: '',
  color: 'oklch(0.72 0.15 264)',
  stage: 'literature',
  stages: defaultStages(),
  startDate: '2026-11-01',
  collaborators: [],
  todos: [],
  notes: '',
  archived: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}
const envelope = (version: number, notes: unknown[] = []) =>
  JSON.stringify({ state: { projects: [project], sessions: [], notes, analyses: [], activeTimer: null, version }, version })

const { PERSIST_NAME, getPersistHealth, unlockPersistWrites } = await import('./persist.ts')
mem.set(PERSIST_NAME, envelope(99))
const { useStore, onStorageWrite, SCHEMA_VERSION } = await import(`./store.ts?version=${Date.now()}`)
const wait = () => new Promise((r) => setTimeout(r, 20))

test('数据由更新版本写入：停止写入，内存不采用旧规则迁移的结果，存储保持原样', async () => {
  assert.equal(getPersistHealth(), 'outdated')
  assert.deepEqual(useStore.getState().projects, [])
  useStore.getState().addNote({ date: '2026-11-25', text: '不该写入' })
  await wait()
  assert.equal(JSON.parse(mem.get(PERSIST_NAME)!).version, 99)
})

test('另一个标签页用旧版本写入：不采用，把当前数据写回', async () => {
  unlockPersistWrites()
  const note = { id: 'n1', date: '2026-11-25', text: '保留我', level: 0, createdAt: 'x', updatedAt: 'x' }
  mem.set(PERSIST_NAME, envelope(SCHEMA_VERSION, [note]))
  await useStore.persist.rehydrate()
  assert.equal(useStore.getState().notes[0].text, '保留我')
  // 旧标签页写入了去掉笔记的旧版本数据。
  mem.set(PERSIST_NAME, envelope(7))
  onStorageWrite(mem.get(PERSIST_NAME)!)
  await wait()
  assert.equal(useStore.getState().notes[0].text, '保留我')
  const saved = JSON.parse(mem.get(PERSIST_NAME)!)
  assert.equal(saved.version, SCHEMA_VERSION)
  assert.equal(saved.state.notes[0].text, '保留我')
})

test('另一个标签页用相同版本写入：重新读取', async () => {
  const other = { id: 'n2', date: '2026-11-25', text: '另一个标签页写的', level: 0, createdAt: 'x', updatedAt: 'x' }
  mem.set(PERSIST_NAME, envelope(SCHEMA_VERSION, [other]))
  onStorageWrite(mem.get(PERSIST_NAME)!)
  await wait()
  assert.deepEqual(useStore.getState().notes.map((n: { text: string }) => n.text), ['另一个标签页写的'])
})
