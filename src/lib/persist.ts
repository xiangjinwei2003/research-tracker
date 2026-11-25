import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { ActiveTimer, AppState } from './types'

/**
 * localStorage key for zustand persist.
 * 2026年11月25日起改用 v2：部署前打开的旧标签页还在运行旧代码，收到新版本写入的
 * storage 事件后会按旧规则迁移并写回，去掉笔记等新字段，两边来回覆盖。换键后旧标签页
 * 只读写 v1，与新代码分开。第一次读取时把 v1 的内容原样复制到 v2，v1 保持不动。
 */
export const PERSIST_NAME = 'research-tracker-v2'
export const LEGACY_PERSIST_NAME = 'research-tracker-v1'

export type Persisted = Pick<AppState, 'projects' | 'sessions' | 'notes' | 'analyses' | 'version'> & {
  activeTimer: ActiveTimer | null
}

/**
 * unreadable：存储读不出，停止写入。outdated：数据由更新版本的代码写入，这个页面的代码较旧，
 * 停止写入以免去掉新字段，提示刷新。write-failed：写入失败，下次改动再试。
 */
export type PersistHealth = 'ok' | 'unreadable' | 'outdated' | 'write-failed'

let health: PersistHealth = 'ok'
const listeners = new Set<(h: PersistHealth) => void>()

export function getPersistHealth(): PersistHealth {
  return health
}

export function subscribePersistHealth(fn: (h: PersistHealth) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function unlockPersistWrites(): void {
  setHealth('ok')
}

/** 桌面版的文件存储用同一套状态报告读写结果，顶栏据此提示。 */
export function markPersistHealth(next: PersistHealth): void {
  setHealth(next)
}

function setHealth(next: PersistHealth): void {
  if (health === next) return
  health = next
  for (const fn of listeners) fn(next)
}

function defaultDelayMs(): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  return env?.NODE_TEST_CONTEXT ? 0 : 400
}

export function asEnvelope(parsed: unknown): StorageValue<Persisted> | null {
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  if ('state' in obj && obj.state && typeof obj.state === 'object') {
    const state = obj.state as Record<string, unknown>
    if (!Array.isArray(state.projects)) return null
    return parsed as StorageValue<Persisted>
  }
  if (Array.isArray(obj.projects)) {
    const version = typeof obj.version === 'number' ? obj.version : 0
    return {
      state: {
        projects: obj.projects,
        sessions: Array.isArray(obj.sessions) ? obj.sessions : [],
        notes: Array.isArray(obj.notes) ? obj.notes : [],
        analyses: Array.isArray(obj.analyses) ? obj.analyses : [],
        activeTimer:
          obj.activeTimer && typeof obj.activeTimer === 'object'
            ? (obj.activeTimer as ActiveTimer)
            : null,
        version,
      } as Persisted,
      version,
    }
  }
  return null
}

export function readRawPersistItem(): string | null {
  try {
    return localStorage.getItem(PERSIST_NAME) ?? localStorage.getItem(LEGACY_PERSIST_NAME)
  } catch {
    return null
  }
}

/** 写入被暂停：读不出，或数据比代码新。 */
function writesBlocked(): boolean {
  return health === 'unreadable' || health === 'outdated'
}

/**
 * Coalesce rapid writes. Flush immediately when the tab is hidden or closing.
 * A failed setItem keeps the pending snapshot so a later flush can retry.
 * Unreadable JSON does not count as an empty key: writes stay blocked until
 * unlockPersistWrites (清空 or 导入).
 */
export function createDebouncedLocalStorage(
  delayMs = defaultDelayMs(),
): PersistStorage<Persisted> & { flushNow: () => void } {
  const pending = new Map<string, StorageValue<Persisted>>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (writesBlocked()) return
    for (const [name, value] of pending) {
      try {
        localStorage.setItem(name, JSON.stringify(value))
        pending.delete(name)
        if (health === 'write-failed') setHealth('ok')
      } catch (err) {
        setHealth('write-failed')
        console.warn(
          '[research-tracker] localStorage write failed; recent changes may not persist.',
          err,
        )
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  return {
    flushNow: flush,
    getItem: (name) => {
      let str: string | null
      try {
        str = localStorage.getItem(name)
        // 新键还没有内容时读旧键，并立即原样复制到新键，之后的迁移与写入都只动新键。
        if (!str && name === PERSIST_NAME) {
          str = localStorage.getItem(LEGACY_PERSIST_NAME)
          if (str) localStorage.setItem(PERSIST_NAME, str)
        }
      } catch (err) {
        setHealth('unreadable')
        throw err
      }
      if (!str) return null
      let parsed: unknown
      try {
        parsed = JSON.parse(str)
      } catch {
        setHealth('unreadable')
        throw new Error(`[research-tracker] persist key ${name} is not valid JSON`)
      }
      const envelope = asEnvelope(parsed)
      if (!envelope) {
        setHealth('unreadable')
        throw new Error(`[research-tracker] persist key ${name} has no state`)
      }
      pending.delete(name)
      if (pending.size === 0 && timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      if (health !== 'ok') setHealth('ok')
      return envelope
    },
    setItem: (name, value) => {
      if (writesBlocked()) return
      pending.set(name, value)
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      pending.delete(name)
      localStorage.removeItem(name)
    },
  }
}
