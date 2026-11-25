import type { AppState } from '../lib/types'
import { SCHEMA_VERSION, persistedSnapshot, useStore } from '../lib/store'
import {
  DATA_DIR,
  DATA_FILE,
  FileBackend,
  attachFileBackend,
  fileBackend,
  type DataFs,
} from './fileStore'
import { claudeRuntime } from './runtime'
import { setDesktop } from './desktop'

/**
 * 桌面版的启动流程：拿到 desktop 能力 → 确认文件权限 → 打开数据文件 → 水合 store。
 * 每一步失败都停在对应的启动页，由用户操作后继续，不在背后换用别的存储。
 */

export type FilePermission = 'prompt' | 'denied' | 'unavailable'

export interface BackupFile {
  name: string
  path: string
}

export type BootPhase =
  | { kind: 'loading' }
  | { kind: 'install'; state: 'available' | 'installed' | 'unavailable'; desktop: ClaudeDesktop | null }
  | { kind: 'permission'; state: FilePermission; desktop: ClaudeDesktop }
  | { kind: 'first-run'; backups: BackupFile[]; desktop: ClaudeDesktop }
  | { kind: 'unreadable'; reason: string; desktop: ClaudeDesktop }
  | { kind: 'failed'; reason: string }
  | { kind: 'ready' }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function reasonOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function startBoot(): Promise<BootPhase> {
  const claude = claudeRuntime()
  if (!claude) return { kind: 'failed', reason: '当前页面不在 Claude 的 Artifact 环境中' }
  const desktop = await claude.use('desktop')
  if (!desktop?.fs) {
    const state = desktop
      ? await desktop.install.state().catch(() => 'unavailable' as const)
      : 'unavailable'
    return { kind: 'install', state, desktop }
  }
  setDesktop(desktop)
  return checkFileAccess(desktop)
}

/**
 * 读权限状态不弹窗。`unavailable` 可能是应用还在登录或确认页面版本，
 * 按 desktop.d.ts 的说明稍后再查，最多等约 8 秒。
 */
export async function checkFileAccess(desktop: ClaudeDesktop): Promise<BootPhase> {
  let state = await desktop.permissions.state('full-access')
  for (let i = 0; i < 8 && state === 'unavailable'; i++) {
    await wait(1000)
    state = await desktop.permissions.state('full-access')
  }
  if (state !== 'granted') return { kind: 'permission', state, desktop }
  return openData(desktop)
}

/** 由点击触发：弹出系统的权限对话框。 */
export async function requestFileAccess(desktop: ClaudeDesktop): Promise<BootPhase> {
  let state: ClaudeDesktop.PermissionState
  try {
    state = (await desktop.permissions.request(['full-access']))['full-access']
  } catch {
    state = 'unavailable'
  }
  if (state !== 'granted') return { kind: 'permission', state, desktop }
  return openData(desktop)
}

export async function openData(desktop: ClaudeDesktop): Promise<BootPhase> {
  const fs = desktop.fs as DataFs
  const backend = new FileBackend(fs)
  attachFileBackend(backend)
  const result = await backend.open()
  if (result.kind === 'missing') {
    return { kind: 'first-run', backups: await findBackups(desktop.fs), desktop }
  }
  if (result.kind === 'unreadable') return { kind: 'unreadable', reason: result.reason, desktop }
  await useStore.persist.rehydrate()
  // zustand 会吞掉水合中的异常（迁移函数抛错等），只能从 hasHydrated 判断。
  if (!useStore.persist.hasHydrated()) {
    return { kind: 'failed', reason: '数据文件可以读取，但载入时出错，原文件没有改动' }
  }
  backend.markReady()
  if (result.value.version !== SCHEMA_VERSION) backend.write(persistedSnapshot())
  watchWindow()
  return { kind: 'ready' }
}

/** 首次使用：用导入的数据或空数据建文件，再按正常流程打开。 */
export async function createData(desktop: ClaudeDesktop, state: AppState | null): Promise<BootPhase> {
  const backend = new FileBackend(desktop.fs as DataFs)
  await backend.create({
    state: {
      projects: state?.projects ?? [],
      sessions: state?.sessions ?? [],
      notes: state?.notes ?? [],
      activeTimer: null,
      version: SCHEMA_VERSION,
    },
    version: SCHEMA_VERSION,
  })
  return openData(desktop)
}

/** 把读不出的文件改名留在原目录，再进入首次运行页。不删除任何内容。 */
export async function setAsideUnreadable(desktop: ClaudeDesktop): Promise<BootPhase> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
  await desktop.fs.rename(DATA_FILE, `${DATA_DIR}/research-tracker.unreadable-${stamp}.json`)
  return { kind: 'first-run', backups: await findBackups(desktop.fs), desktop }
}

const EXPORT_RE = /^research-tracker-\d{4}-\d{2}-\d{2}( \(\d+\))?\.json$/

/** 下载文件夹里网页版导出的备份，按修改时间从新到旧，最多 3 个。 */
export async function findBackups(
  fs: Pick<ClaudeDesktop.Fs, 'readdir' | 'stat'>,
): Promise<BackupFile[]> {
  let entries: ClaudeDesktop.DirEntry[]
  try {
    entries = await fs.readdir('~/Downloads')
  } catch {
    return []
  }
  const found: (BackupFile & { mtime: number })[] = []
  for (const e of entries) {
    if (!e.isFile || !EXPORT_RE.test(e.name)) continue
    const path = `~/Downloads/${e.name}`
    const mtime = await fs.stat(path).then((s) => s.mtimeMs, () => 0)
    found.push({ name: e.name, path, mtime })
  }
  return found
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 3)
    .map(({ name, path }) => ({ name, path }))
}

let watching = false

/** 窗口重新获得焦点或被隐藏时，补写上次失败的改动。 */
function watchWindow(): void {
  if (watching || typeof window === 'undefined') return
  watching = true
  window.addEventListener('focus', () => fileBackend()?.retry())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') fileBackend()?.retry()
  })
}
