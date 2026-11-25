import { latestReviewName, roleSection } from '@/lib/planAnalysis'
import { getDesktop } from './desktop'
import { expandHome } from './folders'

/** 申请计划目录里必须有的文件，选目录时据此检查。 */
export const PLAN_STATE_FILE = '当前状态.md'

export interface PlanSources {
  state: string
  role: string
  review: { name: string; text: string } | null
  scan: { ok: true; text: string } | { ok: false; reason: string }
}

/** 选目录时检查：目录里有 当前状态.md 才算申请计划目录。 */
export async function isPlanDir(dir: string): Promise<boolean> {
  const desktop = getDesktop()
  if (!desktop) return false
  return desktop.fs.exists(`${await expandHome(dir)}/${PLAN_STATE_FILE}`)
}

/**
 * 从申请计划目录读取分析要用的材料，只读：当前状态.md（必需）、AGENTS.md 的角色一节、reviews/ 里最新一份周报；
 * 并在该目录运行它自己的扫描脚本 `scripts/scan.sh 7`（只列出最近 7 天改动的文件与提交）。
 * 扫描失败不影响分析，原因随结果一起显示。
 */
export async function readPlanSources(planDir: string): Promise<PlanSources> {
  const desktop = getDesktop()
  if (!desktop) throw new Error('只有桌面版可以读取申请计划目录')
  const fs = desktop.fs
  const dir = await expandHome(planDir)

  let state: string
  try {
    state = await fs.readFile(`${dir}/${PLAN_STATE_FILE}`, 'utf8')
  } catch {
    throw new Error(`没有找到 ${dir}/${PLAN_STATE_FILE}`)
  }
  const agents = await fs.readFile(`${dir}/AGENTS.md`, 'utf8').catch(() => null)

  let review: PlanSources['review'] = null
  const names = await fs.readdir(`${dir}/reviews`).then(
    (entries) => entries.filter((e) => e.isFile).map((e) => e.name),
    () => [] as string[],
  )
  const latest = latestReviewName(names)
  if (latest) {
    const text = await fs.readFile(`${dir}/reviews/${latest}`, 'utf8').catch(() => null)
    if (text !== null) review = { name: latest, text }
  }

  let scan: PlanSources['scan']
  try {
    const res = await desktop.childProcess.exec('/bin/zsh scripts/scan.sh 7', { cwd: dir, timeout: 60_000 })
    scan =
      res.code === 0 && res.stdout.trim()
        ? { ok: true, text: res.stdout }
        : { ok: false, reason: (res.stderr.trim() || `退出码 ${res.code}`).slice(0, 300) }
  } catch (err) {
    scan = { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }

  return {
    state,
    role: agents === null ? '（申请计划目录里没有找到 AGENTS.md）' : roleSection(agents),
    review,
    scan,
  }
}
