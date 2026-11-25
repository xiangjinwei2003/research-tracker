/**
 * 安装后窗口里的 desktop 能力。启动流程拿到后存在这里，组件同步读取。
 * 网页版、浏览器里的 Artifact 面板都为 null。
 */
let current: ClaudeDesktop | null = null

export function setDesktop(desktop: ClaudeDesktop): void {
  current = desktop
}

export function getDesktop(): ClaudeDesktop | null {
  return current
}

/** 下载文件夹里不重名的文件路径：name.json、name (1).json、name (2).json…… */
export async function freePathInDownloads(
  fs: Pick<ClaudeDesktop.Fs, 'exists'>,
  base: string,
  ext: string,
): Promise<{ path: string; name: string }> {
  for (let i = 0; i < 100; i++) {
    const name = i === 0 ? `${base}${ext}` : `${base} (${i})${ext}`
    const path = `~/Downloads/${name}`
    if (!(await fs.exists(path))) return { path, name }
  }
  throw new Error('下载文件夹里同名文件过多')
}
