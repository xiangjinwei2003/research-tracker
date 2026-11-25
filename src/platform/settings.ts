import { getDesktop } from './desktop'
import { DATA_DIR } from './fileStore'

/**
 * 桌面版的本机设置，存在数据目录的 settings.json。都是本机路径，不进项目数据，也不随导出走。
 * 仓库是公开的，个人目录只存在这里，代码里不写死。
 */
export interface DesktopSettings {
  /** 申请计划所在的目录（含 当前状态.md、AGENTS.md、reviews/、scripts/scan.sh），绝对路径。 */
  planDir?: string
}

export const SETTINGS_FILE = `${DATA_DIR}/settings.json`

function requireFs(): ClaudeDesktop.Fs {
  const desktop = getDesktop()
  if (!desktop) throw new Error('只有桌面版有本机设置')
  return desktop.fs
}

/** 读取设置。文件不存在时为空；内容不是 JSON 时报错，不当作空设置。 */
export async function readSettings(): Promise<DesktopSettings> {
  const fs = requireFs()
  if (!(await fs.exists(SETTINGS_FILE))) return {}
  const text = await fs.readFile(SETTINGS_FILE, 'utf8')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`${SETTINGS_FILE} 不是有效的 JSON`)
  }
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return typeof s.planDir === 'string' && s.planDir.trim() ? { planDir: s.planDir.trim() } : {}
}

/** 合并后整份写回，先写临时文件再改名。 */
export async function updateSettings(patch: DesktopSettings): Promise<DesktopSettings> {
  const fs = requireFs()
  const next = { ...(await readSettings()), ...patch }
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(`${SETTINGS_FILE}.tmp`, JSON.stringify(next, null, 2), 'utf8')
  await fs.rename(`${SETTINGS_FILE}.tmp`, SETTINGS_FILE)
  return next
}
