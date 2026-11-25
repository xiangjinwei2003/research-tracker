import { getDesktop } from './desktop'

/** 工作区目录，桌面版从这里列出候选的项目目录。 */
export const PROJECTS_ROOT = '~/Documents/Projects'

function requireDesktop(): ClaudeDesktop {
  const desktop = getDesktop()
  if (!desktop) throw new Error('只有桌面版可以读写本机目录')
  return desktop
}

/** `~` 开头的路径展开成绝对路径（深链接的 folder 必须是绝对路径）。 */
export async function expandHome(path: string): Promise<string> {
  const trimmed = path.trim()
  if (trimmed !== '~' && !trimmed.startsWith('~/')) return trimmed
  const home = await requireDesktop().os.homedir()
  return trimmed === '~' ? home : `${home}${trimmed.slice(1)}`
}

/** ~/Documents/Projects 下的子目录（不含隐藏目录与符号链接），绝对路径，按名称排序。 */
export async function listProjectFolders(): Promise<string[]> {
  const desktop = requireDesktop()
  const [home, entries] = await Promise.all([desktop.os.homedir(), desktop.fs.readdir(PROJECTS_ROOT)])
  return entries
    .filter((e) => e.isDirectory && !e.isSymbolicLink && !e.name.startsWith('.'))
    .map((e) => `${home}/Documents/Projects/${e.name}`)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export async function folderExists(path: string): Promise<boolean> {
  const desktop = requireDesktop()
  try {
    return (await desktop.fs.stat(path)).isDirectory
  } catch {
    return false
  }
}

/**
 * 在项目的 docs/tasks 下写任务文件：`日期_标题.md`，重名时加 `_2`、`_3`。
 * 只新建文件，不覆盖已有文件。返回相对项目目录的路径。
 */
export async function writeTaskFile(opts: {
  folder: string
  date: string
  title: string
  content: string
}): Promise<string> {
  const desktop = requireDesktop()
  const dir = `${opts.folder}/docs/tasks`
  await desktop.fs.mkdir(dir, { recursive: true })
  for (let i = 1; i < 100; i++) {
    const name = `${opts.date}_${opts.title}${i === 1 ? '' : `_${i}`}.md`
    if (await desktop.fs.exists(`${dir}/${name}`)) continue
    await desktop.fs.writeFile(`${dir}/${name}`, opts.content, 'utf8')
    return `docs/tasks/${name}`
  }
  throw new Error('docs/tasks 里同名文件过多')
}
