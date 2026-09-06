import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { ActiveTimer, AppState } from './types'

/** localStorage key for zustand persist. */
export const PERSIST_NAME = 'research-tracker-v1'

export type Persisted = Pick<AppState, 'projects' | 'sessions' | 'version'> & {
  activeTimer: ActiveTimer | null
}

export type PersistHealth = 'ok' | 'unreadable' | 'write-failed'

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

function asEnvelope(parsed: unknown): StorageValue<Persisted> | null {
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
    return localStorage.getItem(PERSIST_NAME)
  } catch {
    return null
  }
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
    if (health === 'unreadable') return
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
      if (health === 'unreadable') return
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
