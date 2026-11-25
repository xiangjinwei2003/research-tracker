import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDebouncedLocalStorage,
  getPersistHealth,
  unlockPersistWrites,
  readRawPersistItem,
  markPersistHealth,
  PERSIST_NAME,
  LEGACY_PERSIST_NAME,
} from './persist.ts'

const mem = new Map<string, string>()
let setItemImpl: (k: string, v: string) => void = (k, v) => {
  mem.set(k, v)
}

const localStorageMock = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => setItemImpl(k, v),
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

beforeEach(() => {
  mem.clear()
  setItemImpl = (k, v) => {
    mem.set(k, v)
  }
  unlockPersistWrites()
})

const envelope = {
  state: { projects: [], sessions: [], activeTimer: null, version: 7 },
  version: 7,
}

test('存储键是 v2，旧键 v1 只读', () => {
  assert.equal(PERSIST_NAME, 'research-tracker-v2')
  assert.equal(LEGACY_PERSIST_NAME, 'research-tracker-v1')
})

test('新键为空时读旧键，并原样复制到新键；旧键保持不动，之后只写新键', () => {
  const legacy = JSON.stringify(envelope)
  mem.set(LEGACY_PERSIST_NAME, legacy)
  const storage = createDebouncedLocalStorage(0)
  assert.deepEqual(storage.getItem(PERSIST_NAME), envelope)
  assert.equal(mem.get(PERSIST_NAME), legacy)
  storage.setItem(PERSIST_NAME, { ...envelope, version: 9 })
  storage.flushNow()
  assert.equal(JSON.parse(mem.get(PERSIST_NAME)!).version, 9)
  assert.equal(mem.get(LEGACY_PERSIST_NAME), legacy)
  assert.equal(readRawPersistItem(), mem.get(PERSIST_NAME))
})

test('数据比代码新（outdated）时停止写入', () => {
  mem.set(PERSIST_NAME, JSON.stringify(envelope))
  const storage = createDebouncedLocalStorage(0)
  markPersistHealth('outdated')
  storage.setItem(PERSIST_NAME, { ...envelope, version: 1 })
  storage.flushNow()
  assert.equal(JSON.parse(mem.get(PERSIST_NAME)!).version, 7)
})

test('getItem throws on corrupt JSON and blocks later writes', () => {
  mem.set(PERSIST_NAME, '{truncated')
  const storage = createDebouncedLocalStorage(0)
  assert.throws(() => storage.getItem(PERSIST_NAME))
  assert.equal(getPersistHealth(), 'unreadable')
  assert.equal(readRawPersistItem(), '{truncated')
  storage.setItem(PERSIST_NAME, envelope)
  storage.flushNow()
  assert.equal(mem.get(PERSIST_NAME), '{truncated')
})

test('failed setItem keeps pending so a later flush retries', () => {
  let fail = true
  setItemImpl = (k, v) => {
    if (fail) throw new Error('quota')
    mem.set(k, v)
  }
  const warn = console.warn
  console.warn = () => {}
  const storage = createDebouncedLocalStorage(0)
  storage.setItem(PERSIST_NAME, envelope)
  storage.flushNow()
  console.warn = warn
  assert.equal(getPersistHealth(), 'write-failed')
  assert.equal(mem.has(PERSIST_NAME), false)
  fail = false
  storage.flushNow()
  assert.ok(mem.get(PERSIST_NAME))
  assert.equal(getPersistHealth(), 'ok')
})

test('getItem success drops pending so a later flush cannot overwrite disk', () => {
  const storage = createDebouncedLocalStorage(0)
  storage.setItem(PERSIST_NAME, envelope)
  mem.set(PERSIST_NAME, JSON.stringify({ ...envelope, version: 1 }))
  const got = storage.getItem(PERSIST_NAME)
  assert.equal(got?.version, 1)
  storage.flushNow()
  const onDisk = JSON.parse(mem.get(PERSIST_NAME)!) as { version: number }
  assert.equal(onDisk.version, 1)
})

test('a state object without projects is unreadable', () => {
  mem.set(PERSIST_NAME, JSON.stringify({ state: { foo: 1 }, version: 7 }))
  const storage = createDebouncedLocalStorage(0)
  assert.throws(() => storage.getItem(PERSIST_NAME))
  assert.equal(getPersistHealth(), 'unreadable')
})

test('unlockPersistWrites allows a later flush to replace a corrupt blob', () => {
  mem.set(PERSIST_NAME, '{truncated')
  const storage = createDebouncedLocalStorage(0)
  assert.throws(() => storage.getItem(PERSIST_NAME))
  unlockPersistWrites()
  storage.setItem(PERSIST_NAME, envelope)
  storage.flushNow()
  assert.ok(mem.get(PERSIST_NAME)?.startsWith('{'))
  assert.notEqual(mem.get(PERSIST_NAME), '{truncated')
})

test('an AppState JSON blob is wrapped as a persist envelope', () => {
  mem.set(
    PERSIST_NAME,
    JSON.stringify({ projects: [{ title: 'from-export' }], version: 4 }),
  )
  const storage = createDebouncedLocalStorage(0)
  const got = storage.getItem(PERSIST_NAME)
  assert.ok(got)
  assert.equal(got.version, 4)
  assert.ok(Array.isArray((got.state as { projects: unknown[] }).projects))
  assert.equal((got.state as { projects: { title: string }[] }).projects[0].title, 'from-export')
})
