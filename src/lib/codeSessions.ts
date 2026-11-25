/**
 * Claude 桌面应用里 Claude Code 会话的记录（每个会话一个 JSON，存在
 * ~/Library/Application Support/Claude/claude-code-sessions/<账号>/<组织>/local_<id>.json）。
 * 这是 Claude 应用的内部文件，字段可能随版本变化，这里只读用得到的几项，缺了就当作读不到。
 * 本机 Claude 7.37095.0 核实（2026年11月25日）。
 */
export interface CodeSessionInfo {
  sessionId: string
  cwd: string
  createdAt: number
  lastActivityAt: number
  title: string
  isArchived: boolean
}

/** `claude://code/continue?session=` 只接受这种 id（Claude 7.37095.0 的 claudeURLHandler）。 */
const SESSION_ID = /^local_[A-Za-z0-9-]{1,64}$/

export function parseSessionMeta(text: string): CodeSessionInfo | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.sessionId !== 'string' || !SESSION_ID.test(r.sessionId)) return null
  if (typeof r.cwd !== 'string' || typeof r.createdAt !== 'number') return null
  return {
    sessionId: r.sessionId,
    cwd: r.cwd,
    createdAt: r.createdAt,
    lastActivityAt: typeof r.lastActivityAt === 'number' ? r.lastActivityAt : r.createdAt,
    title: typeof r.title === 'string' ? r.title : '',
    isArchived: r.isArchived === true,
  }
}

/** 打开桌面端的某个 Claude Code 会话。id 不合规时报错，不拼出平台会拒绝的链接。 */
export function continueSessionUrl(sessionId: string): string {
  if (!SESSION_ID.test(sessionId)) throw new Error('会话 id 的格式不对')
  return `claude://code/continue?session=${sessionId}`
}

export interface PendingSend {
  /** 用来回写的键：笔记 id 与发送时刻。 */
  noteId: string
  at: number
  folder: string
}

/** 深链接打开后，会话在用户按下发送时才建立，可能晚很久；超过这个时长不再配对。 */
export const MATCH_WINDOW_MS = 12 * 60 * 60 * 1000
/** 本机时钟与会话记录之间的误差容忍。 */
const CLOCK_SLACK_MS = 5_000

/**
 * 把发送记录配到会话：同一工作目录、在发送之后建立的会话里，最早的那个；一个会话只配一次。
 * 发送记录按时间从早到晚处理，所以同一目录连发几次时，按先后各自配到先后建立的会话。
 */
export function matchSessions(
  pending: PendingSend[],
  sessions: CodeSessionInfo[],
  claimed: Set<string>,
): { noteId: string; at: number; sessionId: string }[] {
  const taken = new Set(claimed)
  const sorted = [...sessions].sort((a, b) => a.createdAt - b.createdAt)
  const out: { noteId: string; at: number; sessionId: string }[] = []
  for (const p of [...pending].sort((a, b) => a.at - b.at)) {
    const hit = sorted.find(
      (s) =>
        !taken.has(s.sessionId) &&
        s.cwd === p.folder &&
        s.createdAt >= p.at - CLOCK_SLACK_MS &&
        s.createdAt <= p.at + MATCH_WINDOW_MS,
    )
    if (!hit) continue
    taken.add(hit.sessionId)
    out.push({ noteId: p.noteId, at: p.at, sessionId: hit.sessionId })
  }
  return out
}
