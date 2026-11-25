import { create } from 'zustand'
import { useStore } from '@/lib/store'
import { MATCH_WINDOW_MS, matchSessions, parseSessionMeta, type CodeSessionInfo, type PendingSend } from '@/lib/codeSessions'
import { getDesktop } from './desktop'
import { expandHome } from './folders'

/** Claude 桌面应用存放 Claude Code 会话记录的目录（内部文件，只读）。 */
const SESSIONS_ROOT = '~/Library/Application Support/Claude/claude-code-sessions'

/** 会话 id 到记录文件路径的缓存，省去重复查找。 */
const pathCache = new Map<string, string>()

/**
 * 会话信息的刷新信号：窗口重新获得焦点（多半是从 Claude 回来）时递增，
 * 显示会话的笔记行据此重新读取标题与最后活动时间。
 */
export const useSessionsTick = create<{ tick: number }>(() => ({ tick: 0 }))

export function bumpSessionsTick(): void {
  useSessionsTick.setState((s) => ({ tick: s.tick + 1 }))
}

function requireDesktop(): ClaudeDesktop {
  const desktop = getDesktop()
  if (!desktop) throw new Error('只有桌面版能读取 Claude Code 会话')
  return desktop
}

/** 运行 /usr/bin/find，返回每行一个路径。find 读不到的子目录会让退出码为 1，有输出时照常使用。 */
function find(args: string[]): Promise<string[]> {
  const desktop = requireDesktop()
  return new Promise((resolve, reject) => {
    const child = desktop.childProcess.spawn('/usr/bin/find', args)
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      const lines = out.split('\n').filter(Boolean)
      if (code === 0 || lines.length) resolve(lines)
      else reject(new Error(`find 退出码 ${code}${err.trim() ? `：${err.trim().slice(0, 200)}` : ''}`))
    })
  })
}

async function readMeta(path: string): Promise<CodeSessionInfo | null> {
  const text = await requireDesktop().fs.readFile(path, 'utf8').catch(() => null)
  const info = text === null ? null : parseSessionMeta(text)
  if (info) pathCache.set(info.sessionId, path)
  return info
}

/** sinceMs 之后改动过的会话记录。会话建立后文件才出现，所以只需看这段时间里改动过的文件。 */
export async function recentSessions(sinceMs: number): Promise<CodeSessionInfo[]> {
  const root = await expandHome(SESSIONS_ROOT)
  const minutes = Math.max(1, Math.ceil((Date.now() - sinceMs) / 60_000) + 1)
  const paths = await find([root, '-name', 'local_*.json', '-mmin', `-${minutes}`])
  const infos = await Promise.all(paths.map(readMeta))
  return infos.filter((x): x is CodeSessionInfo => x !== null)
}

/** 一个会话当前的标题、最后活动时间与是否归档；记录不在了返回 null。 */
export async function readSessionInfo(sessionId: string): Promise<CodeSessionInfo | null> {
  let path = pathCache.get(sessionId)
  if (!path) {
    const root = await expandHome(SESSIONS_ROOT)
    path = (await find([root, '-name', `${sessionId}.json`]))[0]
    if (!path) return null
  }
  return readMeta(path)
}

/**
 * 给还没配到会话的发送记录找会话（12 小时内发出的），配上的写进数据。返回配上的条数。
 * 已经配给别的记录的会话不会再配。
 */
export async function resolvePendingSessions(): Promise<number> {
  const { notes, setSentSession } = useStore.getState()
  const since = Date.now() - MATCH_WINDOW_MS
  const pending: PendingSend[] = []
  const claimed = new Set<string>()
  for (const n of notes) {
    for (const s of n.sent ?? []) {
      if (s.sessionId) claimed.add(s.sessionId)
      else if (s.folder && s.at >= since) pending.push({ noteId: n.id, at: s.at, folder: s.folder })
    }
  }
  if (!pending.length) return 0
  const sessions = await recentSessions(Math.min(...pending.map((p) => p.at)) - 60_000)
  const matches = matchSessions(pending, sessions, claimed)
  for (const m of matches) setSentSession(m.noteId, m.at, m.sessionId)
  return matches.length
}
