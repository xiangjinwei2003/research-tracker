/**
 * Claude 桌面应用的深链接（本机 Claude 7.37095.0 的 claudeURLHandler 核实，2026年11月25日）：
 * `claude://code/new?q=<提示词>&folder=<绝对路径>` 新建一个 Claude Code 会话，提示词预填进输入框，
 * 不会自动发送。q 超过 CLAUDE_PROMPT_MAX 个字符的部分会被截掉；folder 不是绝对路径时不会被解析。
 */
export const CLAUDE_PROMPT_MAX = 14336

/** macOS、Linux 的绝对路径，或 Windows 的盘符路径。 */
export function isAbsoluteFolder(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
}

/** 路径最后一段，用于界面显示。 */
export function folderName(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function claudeCodeNewUrl({ prompt, folder }: { prompt: string; folder?: string }): string {
  if (prompt.length > CLAUDE_PROMPT_MAX) {
    throw new Error(`提示词有 ${prompt.length} 个字符，超过 ${CLAUDE_PROMPT_MAX} 的上限`)
  }
  if (folder && !isAbsoluteFolder(folder)) {
    throw new Error('工作目录需要是绝对路径')
  }
  const params = new URLSearchParams()
  params.set('q', prompt)
  if (folder) params.append('folder', folder)
  return `claude://code/new?${params.toString()}`
}
