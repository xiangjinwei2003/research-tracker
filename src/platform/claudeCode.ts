import { getDesktop } from './desktop'

/**
 * 打开自定义协议的链接（claude://、webcal://）。
 * 桌面版：Artifact 页面里的自定义协议链接不可靠，用 full-access 的子进程运行 macOS 的 open，
 * 退出码为 0 表示系统已把链接交给对应的应用。
 * 网页版：点击一个临时链接，由浏览器询问是否打开对应的应用；页面无法知道用户是否同意。
 */
export async function openSchemeUrl(url: string): Promise<'opened' | 'requested'> {
  const desktop = getDesktop()
  if (desktop) {
    const platform = await desktop.os.platform()
    if (platform !== 'darwin') throw new Error('目前只支持在 macOS 上直接打开')
    await new Promise<void>((resolve, reject) => {
      const child = desktop.childProcess.spawn('open', [url])
      child.on('error', reject)
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`open 命令退出码 ${code}`))))
    })
    return 'opened'
  }
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  a.click()
  return 'requested'
}

/** 打开 claude:// 深链接，在 Claude 桌面应用里新建会话。 */
export function openClaudeLink(url: string): Promise<'opened' | 'requested'> {
  return openSchemeUrl(url)
}
