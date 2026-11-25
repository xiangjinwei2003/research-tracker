import { create } from 'zustand'
import { useStore } from './store'
import { toast } from './toast'
import { buildSnapshot } from './calendarSnapshot'
import { getDesktop } from '../platform/desktop'
import { curlRequest, readCalendarFile, writeCalendarFile, type HttpResult } from '../platform/calendarDesktop'

/**
 * Apple Calendar subscription: uploads a snapshot of todos to
 * /api/calendar/:id whenever `projects` changes (debounced), and the server
 * renders /api/calendar/:id.ics for Calendar to poll.
 *
 * Token and write key live outside the project schema and the JSON export:
 * 网页版在单独的 localStorage 键里，桌面版在数据目录的 calendar-sync.json。
 * 网页版用同源 fetch 上传，桌面版的页面不能访问网络，用 curl 上传到生产域名（见 platform/calendarDesktop.ts）。
 */

export const CALENDAR_SYNC_KEY = 'research-tracker.calendar-sync'
const DEBOUNCE_MS = 3000
/**
 * Server data expires 180 days after the last read or write. Upload at least
 * this often on app start even when nothing changed, so an address whose
 * calendar is not being polled still stays alive while the app is in use.
 */
const FORCE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

interface Settings {
  enabled: boolean
  /** Read token in the subscription URL. */
  id: string
  /** Write key; the server stores only its SHA-256. */
  key: string
  /** Epoch ms of the last successful upload. */
  lastSyncAt: number | null
  /** SHA-256 of the last uploaded body; an identical body is not sent again. */
  uploadedHash: string | null
  /**
   * https URL of the .ics as returned by the server. It may be on a different
   * host than this page (the unprotected production domain).
   */
  icsUrl: string | null
}

export type SyncPhase = 'off' | 'syncing' | 'ok' | 'error' | 'unconfigured'

interface SyncState {
  settings: Settings | null
  phase: SyncPhase
  /** Reason for the last failure, or what is missing when unconfigured. */
  error: string | null
}

export const useCalendarSync = create<SyncState>(() => ({
  settings: null,
  phase: 'off',
  error: null,
}))

/** 订阅设置的存储与请求的发送，网页版与桌面版各一套。 */
interface CalendarBackend {
  load(): Promise<string | null>
  save(text: string): Promise<void>
  request(method: 'PUT' | 'DELETE', s: Settings, body?: string): Promise<HttpResult>
}

const webBackend: CalendarBackend = {
  load: async () => localStorage.getItem(CALENDAR_SYNC_KEY),
  save: async (text) => localStorage.setItem(CALENDAR_SYNC_KEY, text),
  request: async (method, s, body) => {
    const res = await fetch(`/api/calendar/${s.id}`, {
      method,
      headers: {
        authorization: `Bearer ${s.key}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body,
    })
    return { status: res.status, text: await res.text() }
  },
}

const desktopBackend: CalendarBackend = {
  load: readCalendarFile,
  save: writeCalendarFile,
  request: (method, s, body) => curlRequest(method, s.id, s.key, body),
}

function backend(): CalendarBackend {
  return getDesktop() ? desktopBackend : webBackend
}

/** 只认完整的设置；缺少 id 或 key 时当作没有设置。 */
export function parseCalendarSettings(raw: string | null): Settings | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<Settings>
    if (typeof s.id !== 'string' || typeof s.key !== 'string') return null
    return {
      enabled: s.enabled === true,
      id: s.id,
      key: s.key,
      lastSyncAt: typeof s.lastSyncAt === 'number' ? s.lastSyncAt : null,
      uploadedHash: typeof s.uploadedHash === 'string' ? s.uploadedHash : null,
      icsUrl: typeof s.icsUrl === 'string' ? s.icsUrl : null,
    }
  } catch {
    return null
  }
}

function saveSettings(s: Settings): void {
  useCalendarSync.setState({ settings: s })
  backend()
    .save(JSON.stringify(s))
    .catch((err: unknown) => {
      toast({ message: `订阅设置没有保存：${err instanceof Error ? err.message : String(err)}` })
    })
}

/** 32 random bytes as base64url (43 characters, 256 bits). */
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function webcalUrl(icsUrl: string): string {
  return icsUrl.replace(/^https?:/, 'webcal:')
}

export type Outcome =
  | { kind: 'ok'; icsUrl?: string }
  | { kind: 'unconfigured'; message: string }
  | { kind: 'error'; message: string }

/** HTTP 结果换成同步状态。网页版与桌面版共用。 */
export function outcomeOf(method: 'PUT' | 'DELETE', res: HttpResult): Outcome {
  const json = (): Record<string, unknown> => {
    try {
      const v = JSON.parse(res.text) as unknown
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
    } catch {
      // 不是 JSON（例如平台的 404 页面），下面只报状态码。
      return {}
    }
  }
  if (res.status >= 200 && res.status < 300) {
    if (method === 'DELETE') return { kind: 'ok' }
    const url = json().url
    if (typeof url !== 'string') return { kind: 'error', message: '服务端响应缺少订阅地址' }
    return { kind: 'ok', icsUrl: url }
  }
  const info = json()
  const error = typeof info.error === 'string' ? info.error : undefined
  const message = typeof info.message === 'string' ? info.message : undefined
  if (res.status === 503 && error === 'storage-not-configured') {
    return { kind: 'unconfigured', message: message ?? '服务端没有配置存储' }
  }
  const detail = message ?? error
  return { kind: 'error', message: `HTTP ${res.status}${detail ? `：${detail}` : ''}` }
}

async function call(method: 'PUT' | 'DELETE', s: Settings, body?: string): Promise<Outcome> {
  let res: HttpResult
  try {
    res = await backend().request(method, s, body)
  } catch (err) {
    return { kind: 'error', message: `网络错误：${err instanceof Error ? err.message : String(err)}` }
  }
  return outcomeOf(method, res)
}

/** True once a failure toast was shown; reset by the next success. */
let failureNotified = false
let inFlight = false
let again = false
let timer: ReturnType<typeof setTimeout> | null = null

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function report(o: Outcome, uploadedHash: string): void {
  if (o.kind === 'ok') {
    failureNotified = false
    const s = useCalendarSync.getState().settings
    if (s) saveSettings({ ...s, lastSyncAt: Date.now(), uploadedHash, icsUrl: o.icsUrl ?? s.icsUrl })
    useCalendarSync.setState({ phase: 'ok', error: null })
  } else if (o.kind === 'unconfigured') {
    useCalendarSync.setState({ phase: 'unconfigured', error: o.message })
  } else {
    useCalendarSync.setState({ phase: 'error', error: o.message })
    if (!failureNotified) {
      failureNotified = true
      toast({ message: `日历同步失败：${o.message}` })
    }
  }
}

/**
 * Upload the current snapshot. Skipped when it equals the last successful
 * upload, unless `force`. Overlapping calls coalesce into one follow up.
 */
export async function syncNow(force = false): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  const s = useCalendarSync.getState().settings
  if (!s?.enabled) return
  if (inFlight) {
    again = true
    return
  }
  inFlight = true
  try {
    const body = JSON.stringify(buildSnapshot(useStore.getState().projects))
    const hash = await sha256Hex(body)
    if (!force && hash === s.uploadedHash) {
      useCalendarSync.setState({ phase: 'ok', error: null })
    } else {
      useCalendarSync.setState({ phase: 'syncing' })
      report(await call('PUT', s, body), hash)
    }
  } finally {
    inFlight = false
  }
  if (again) {
    again = false
    await syncNow()
  }
}

function schedule(): void {
  if (!useCalendarSync.getState().settings?.enabled) return
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), DEBOUNCE_MS)
}

/**
 * Delete server data for `s`. A 503 means storage was never configured, so
 * nothing can be stored there; that counts as done.
 */
async function deleteRemote(s: Settings): Promise<boolean> {
  const o = await call('DELETE', s)
  if (o.kind === 'error') {
    useCalendarSync.setState({ phase: 'error', error: `删除服务端数据失败：${o.message}` })
    toast({ message: `删除服务端数据失败：${o.message}` })
    return false
  }
  return true
}

export async function enableSync(): Promise<void> {
  const cur = useCalendarSync.getState().settings
  saveSettings(cur ? { ...cur, enabled: true, uploadedHash: null } : { enabled: true, id: randomToken(), key: randomToken(), lastSyncAt: null, uploadedHash: null, icsUrl: null })
  await syncNow(true)
}

/** Turning off deletes the server copy; the address is kept for later. */
export async function disableSync(): Promise<void> {
  const s = useCalendarSync.getState().settings
  if (!s) return
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  if (!(await deleteRemote(s))) return
  saveSettings({ ...s, enabled: false, lastSyncAt: null, uploadedHash: null, icsUrl: null })
  useCalendarSync.setState({ phase: 'off', error: null })
}

/** Invalidate the old address: delete its server data, then mint a new one. */
export async function regenerate(): Promise<void> {
  const s = useCalendarSync.getState().settings
  if (s && !(await deleteRemote(s))) return
  saveSettings({
    enabled: s?.enabled ?? false,
    id: randomToken(),
    key: randomToken(),
    lastSyncAt: null,
    uploadedHash: null,
    icsUrl: null,
  })
  if (useCalendarSync.getState().settings?.enabled) await syncNow(true)
  else useCalendarSync.setState({ phase: 'off', error: null })
}

let started = false

/**
 * Call once at app start (after the desktop boot, so the right backend is chosen).
 * 读取订阅设置，订阅项目改动，开启时同步一次。设置读不出时报错并保持关闭。
 */
export function startCalendarSync(): void {
  if (started) return
  started = true
  useStore.subscribe((state, prev) => {
    if (state.projects !== prev.projects) schedule()
  })
  backend()
    .load()
    .then(
      (raw) => {
        const s = parseCalendarSettings(raw)
        useCalendarSync.setState({ settings: s })
        if (s?.enabled) void syncNow(s.lastSyncAt === null || Date.now() - s.lastSyncAt > FORCE_AFTER_MS)
      },
      (err: unknown) => {
        useCalendarSync.setState({ phase: 'error', error: `订阅设置读不出：${err instanceof Error ? err.message : String(err)}` })
      },
    )
}
