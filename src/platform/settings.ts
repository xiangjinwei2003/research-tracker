import { getDesktop } from './desktop'
import { DATA_DIR } from './fileStore'

export type WindowMode = 'full' | 'compact'

/**
 * 桌面版的本机设置，存在数据目录的 settings.json。都是本机路径与界面偏好，不进项目数据，也不随导出走。
 * 仓库是公开的，个人目录只存在这里，代码里不写死。
 */
export interface DesktopSettings {
  /** 申请计划所在的目录（含 当前状态.md、AGENTS.md、reviews/、scripts/scan.sh），绝对路径。 */
  planDir?: string
  /** 完整窗口，或置顶的笔记小窗。 */
  windowMode?: WindowMode
  /** 下一次打开时要把窗口摆到的位置（切换窗口模式后设置，用过即清除）。 */
  pendingPlace?: WindowMode
  /** 用系统标题栏，不隐藏。 */
  systemTitleBar?: boolean
  /** 全局快捷键记笔记。 */
  quickNote?: boolean
  /** 菜单栏显示专注倒计时。 */
  menuBar?: boolean
}

export const SETTINGS_FILE = `${DATA_DIR}/settings.json`

function requireFs(): ClaudeDesktop.Fs {
  const desktop = getDesktop()
  if (!desktop) throw new Error('只有桌面版有本机设置')
  return desktop.fs
}

/** 只保留认识的字段和合法的取值。 */
export function parseSettings(raw: unknown): DesktopSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: DesktopSettings = {}
  if (typeof s.planDir === 'string' && s.planDir.trim()) out.planDir = s.planDir.trim()
  if (s.windowMode === 'full' || s.windowMode === 'compact') out.windowMode = s.windowMode
  if (s.pendingPlace === 'full' || s.pendingPlace === 'compact') out.pendingPlace = s.pendingPlace
  if (s.systemTitleBar === true) out.systemTitleBar = true
  if (s.quickNote === true) out.quickNote = true
  if (s.menuBar === true) out.menuBar = true
  return out
}

/** 读取设置。文件不存在时为空；内容不是 JSON 时报错，不当作空设置。 */
export async function readSettings(): Promise<DesktopSettings> {
  const fs = requireFs()
  if (!(await fs.exists(SETTINGS_FILE))) return {}
  const text = await fs.readFile(SETTINGS_FILE, 'utf8')
  try {
    return parseSettings(JSON.parse(text))
  } catch {
    throw new Error(`${SETTINGS_FILE} 不是有效的 JSON`)
  }
}

/** 合并后整份写回，先写临时文件再改名。值为 undefined 的字段会被删除。 */
export async function updateSettings(patch: DesktopSettings): Promise<DesktopSettings> {
  const fs = requireFs()
  const next: DesktopSettings = { ...(await readSettings()), ...patch }
  for (const key of Object.keys(next) as (keyof DesktopSettings)[]) {
    if (next[key] === undefined) delete next[key]
  }
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(`${SETTINGS_FILE}.tmp`, JSON.stringify(next, null, 2), 'utf8')
  await fs.rename(`${SETTINGS_FILE}.tmp`, SETTINGS_FILE)
  current = next
  return next
}

/** 启动时读到的设置，组件同步读取；之后的修改经 updateSettings 同步到这里。 */
let current: DesktopSettings = {}

export function setCurrentSettings(settings: DesktopSettings): void {
  current = settings
}

export function currentSettings(): DesktopSettings {
  return current
}
