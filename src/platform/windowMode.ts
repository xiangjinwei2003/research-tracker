import { updateSettings, type DesktopSettings, type WindowMode } from './settings'

/**
 * 窗口选项。只放结构性的项（标题栏、置顶、最小尺寸），不放宽高：
 * 选项和窗口现有的不同时，平台会重建窗口并重新加载页面，所以每次都要传完全相同的选项；
 * 宽高会随用户拖动改变，放进选项可能导致反复重载，摆放位置改用 window.place。
 */
export function windowOptions(mode: WindowMode, systemTitleBar: boolean): ClaudeDesktop.WindowOptions {
  if (mode === 'compact') {
    // 置顶需要无边框（alwaysOnTop 不能和隐藏标题栏同用），拖动区由页面的 app-region 决定。
    return { frame: false, alwaysOnTop: true, dragHeight: 0, minWidth: 280, minHeight: 320 }
  }
  if (systemTitleBar) return { minWidth: 800, minHeight: 520 }
  // 红绿灯放在侧栏顶部那一行（行高 48px，按钮高 12px）。顶部平台拖动条压到 8px，避开顶栏按钮。
  return {
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    dragHeight: 8,
    minWidth: 800,
    minHeight: 520,
  }
}

export const PLACEMENT: Record<WindowMode, ClaudeDesktop.Placement> = {
  compact: { anchor: 'top_right', margin: 24, width: 360, height: 560 },
  full: { anchor: 'center', width: 1200, height: 800 },
}

const GUARD_KEY = 'research-tracker.window-reloads'

/**
 * 防止选项不被平台视为相同而反复重载：15 秒内因 setOptions 重载超过 3 次就不再调用。
 * 用 sessionStorage 记次，读写失败时这层保护不生效，不影响其余功能。
 */
function reloadGuardTripped(): boolean {
  try {
    const now = Date.now()
    const recent = (JSON.parse(sessionStorage.getItem(GUARD_KEY) ?? '[]') as number[]).filter((t) => now - t < 15_000)
    if (recent.length >= 3) return true
    sessionStorage.setItem(GUARD_KEY, JSON.stringify([...recent, now]))
    return false
  } catch {
    return false
  }
}

export interface ApplyResult {
  reloading: boolean
  error?: string
}

/** 每次打开时按设置应用窗口选项；需要时把窗口摆到切换后的位置。 */
export async function applyWindowOptions(desktop: ClaudeDesktop, settings: DesktopSettings): Promise<ApplyResult> {
  const mode = settings.windowMode ?? 'full'
  const options = windowOptions(mode, !!settings.systemTitleBar)
  try {
    const { applied } = await desktop.window.getOptions()
    const same = (Object.keys(options) as (keyof ClaudeDesktop.WindowOptions)[]).every(
      (k) => JSON.stringify(applied[k]) === JSON.stringify(options[k]),
    )
    if (!same) {
      if (reloadGuardTripped()) return { reloading: false, error: '窗口选项没有生效，已停止重试' }
      const res = await desktop.window.setOptions(options)
      if (res.reloading) return { reloading: true }
    }
    if (settings.pendingPlace) {
      await desktop.window.place(PLACEMENT[settings.pendingPlace]).catch(() => undefined)
      await updateSettings({ pendingPlace: undefined })
    }
    return { reloading: false }
  } catch (err) {
    return { reloading: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 切换完整窗口与置顶小窗。置顶需要 overlay 权限，由这次点击请求；被拒绝时报错，不切换。
 * 先写设置再改选项：平台随后重建窗口并重新加载页面，加载时按新设置渲染。
 */
export async function switchWindowMode(desktop: ClaudeDesktop, mode: WindowMode): Promise<void> {
  if (mode === 'compact') {
    const state = (await desktop.permissions.request(['overlay']))['overlay']
    if (state !== 'granted') throw new Error('置顶小窗需要允许浮动窗口，可在权限设置里打开')
  }
  const next = await updateSettings({ windowMode: mode, pendingPlace: mode })
  const res = await desktop.window.setOptions(windowOptions(mode, !!next.systemTitleBar))
  if (!res.reloading) {
    // 没有重建（平台认为选项相同）时直接摆放位置。
    await desktop.window.place(PLACEMENT[mode]).catch(() => undefined)
    await updateSettings({ pendingPlace: undefined })
  }
}
