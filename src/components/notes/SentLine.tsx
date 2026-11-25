import { useEffect, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { format, isToday } from 'date-fns'
import type { NoteSent } from '@/lib/types'
import { folderName } from '@/lib/claudeLink'
import { continueSessionUrl, type CodeSessionInfo } from '@/lib/codeSessions'
import { toast } from '@/lib/toast'
import { getDesktop } from '@/platform/desktop'
import { openSchemeUrl } from '@/platform/claudeCode'
import { readSessionInfo, useSessionsTick } from '@/platform/claudeSessions'

const when = (ms: number) => format(ms, isToday(ms) ? 'HH:mm' : 'M月d日 HH:mm')

/**
 * 笔记下方的发送记录：最近一次的发送时间；配到会话后显示会话标题、最后活动时间和「打开」，
 * 否则显示工作目录名。会话信息在窗口重新获得焦点时刷新。
 */
export function SentLine({ sent }: { sent: NoteSent[] }) {
  const last = sent[sent.length - 1]
  const tick = useSessionsTick((s) => s.tick)
  const [session, setSession] = useState<CodeSessionInfo | null>(null)

  useEffect(() => {
    if (!last.sessionId || !getDesktop()) return
    let alive = true
    readSessionInfo(last.sessionId).then(
      (info) => {
        if (alive) setSession(info)
      },
      (err: unknown) => {
        console.warn('[research-tracker] 会话信息读不到。', err)
        if (alive) setSession(null)
      },
    )
    return () => {
      alive = false
    }
  }, [last.sessionId, tick])

  const open = () => {
    if (!session) return
    openSchemeUrl(continueSessionUrl(session.sessionId)).catch((err: unknown) =>
      toast({ message: `没有打开会话：${err instanceof Error ? err.message : String(err)}` }),
    )
  }

  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={last.prompt}>
      <SendHorizontal size={11} className="shrink-0" />
      <span className="shrink-0 tabular-nums">已发送 {when(last.at)}</span>
      {session ? (
        <>
          <span className="truncate text-secondary-foreground">{session.title || folderName(session.cwd)}</span>
          <span className="shrink-0 tabular-nums">
            {session.isArchived ? '已归档' : `最后活动 ${when(session.lastActivityAt)}`}
          </span>
          {session.isArchived ? null : (
            <button
              type="button"
              onClick={open}
              className="shrink-0 rounded-sm text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              打开
            </button>
          )}
        </>
      ) : last.folder ? (
        <span className="truncate">{folderName(last.folder)}</span>
      ) : null}
      {sent.length > 1 ? <span className="shrink-0">共 {sent.length} 次</span> : null}
    </div>
  )
}
