import type { AppState } from '../lib/types'
import { SCHEMA_VERSION, persistedSnapshot, useStore } from '../lib/store'
import { getPersistHealth } from '../lib/persist'
import { toast } from '../lib/toast'
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
import { setSample } from './sample'
import { readSettings, setCurrentSettings, type DesktopSettings } from './settings'
import { applyWindowOptions } from './windowMode'
import { pushNotice } from './desktopIntegration'

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
  | { kind: 'permission'; state: FilePermission; desktop: ClaudeDesktop; reason?: string }
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
  // sample 不影响启动：拿不到时界面里不显示 AI 整理。
  void claude.use('sample').then(setSample, () => setSample(null))
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
  return afterPermission(desktop, state)
}

/** 由点击触发：弹出系统的权限对话框。request 自身失败时，失败原因显示在权限页。 */
export async function requestFileAccess(desktop: ClaudeDesktop): Promise<BootPhase> {
  let state: ClaudeDesktop.PermissionState
  try {
    state = (await desktop.permissions.request(['full-access']))['full-access']
  } catch (err) {
    return { kind: 'permission', state: 'unavailable', desktop, reason: reasonOf(err) }
  }
  return afterPermission(desktop, state)
}

async function afterPermission(
  desktop: ClaudeDesktop,
  state: ClaudeDesktop.PermissionState,
): Promise<BootPhase> {
  if (state === 'granted') return openData(desktop)
  if (state !== 'unavailable') return { kind: 'permission', state, desktop }
  return probeUnavailable(desktop)
}

/**
 * `unavailable` 合并了多种情况（组织不允许、平台无法确认作者、页面版本未确认、权限未声明等），
 * state() 不区分。对需要 full-access 的接口做一次只读调用，平台在拒绝时给出具体原因，原样显示。
 */
async function probeUnavailable(desktop: ClaudeDesktop): Promise<BootPhase> {
  try {
    await desktop.fs.stat('~')
  } catch (err) {
    return { kind: 'permission', state: 'unavailable', desktop, reason: reasonOf(err) }
  }
  return openData(desktop)
}

export async function openData(desktop: ClaudeDesktop): Promise<BootPhase> {
  setDesktop(desktop)
  const fs = desktop.fs as DataFs
  const backend = new FileBackend(fs, undefined, (err) =>
    toast({ message: `今天的数据备份没有写成：${reasonOf(err)}。数据文件照常保存。` }),
  )
  attachFileBackend(backend)
  const result = await backend.open()
  if (result.kind === 'missing') {
    return { kind: 'first-run', backups: await findBackups(desktop.fs), desktop }
  }
  if (result.kind === 'unreadable') return { kind: 'unreadable', reason: result.reason, desktop }
  await useStore.persist.rehydrate()
  // zustand 会吞掉水合中的异常（迁移函数抛错等），只能从 hasHydrated 判断。
  if (!useStore.persist.hasHydrated()) {
    return {
      kind: 'failed',
      reason:
        getPersistHealth() === 'outdated'
          ? '数据文件由更新版本的应用写入，这一版不能读取，原文件没有改动'
          : '数据文件可以读取，但载入时出错，原文件没有改动',
    }
  }
  backend.markReady()
  if (result.value.version !== SCHEMA_VERSION) backend.write(persistedSnapshot())
  watchWindow()
  return applyLocalSettings(desktop)
}

/**
 * 读本机设置并应用窗口选项。设置文件读不出时按默认设置打开，并在应用渲染后提示；
 * 窗口需要重建时平台会重新加载页面，这里停在加载页。
 */
async function applyLocalSettings(desktop: ClaudeDesktop): Promise<BootPhase> {
  let settings: DesktopSettings = {}
  try {
    settings = await readSettings()
  } catch (err) {
    pushNotice(`${reasonOf(err)}，已按默认设置打开`)
  }
  setCurrentSettings(settings)
  const applied = await applyWindowOptions(desktop, settings)
  if (applied.reloading) return { kind: 'loading' }
  if (applied.error) pushNotice(`窗口设置没有生效：${applied.error}`)
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
      analyses: state?.analyses ?? [],
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
