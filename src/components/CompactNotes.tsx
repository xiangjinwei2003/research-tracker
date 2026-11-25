import { useEffect, useMemo, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { noteDayLabel } from '@/lib/notes'
import { today as todayIso } from '@/lib/date'
import { toast } from '@/lib/toast'
import { getDesktop } from '@/platform/desktop'
import { QUICK_NOTE_EVENT } from '@/platform/quickNote'
import { switchWindowMode } from '@/platform/windowMode'
import { NotesView } from './notes/NotesView'
import { requestTodayNoteFocus } from './notes/focus'

/**
 * 置顶的笔记小窗：无边框、浮在其他窗口之上，只显示今天的笔记。标题行用来拖动窗口，
 * 右侧按钮回到完整窗口（应用菜单「窗口」里也有同一项）。
 */
export function CompactNotes() {
  const today = todayIso()
  const days = useMemo(() => [today], [today])
  const [focusTick, setFocusTick] = useState(0)

  useEffect(() => {
    const onQuickNote = () => {
      requestTodayNoteFocus()
      setFocusTick((n) => n + 1)
    }
    window.addEventListener(QUICK_NOTE_EVENT, onQuickNote)
    return () => window.removeEventListener(QUICK_NOTE_EVENT, onQuickNote)
  }, [])

  const backToFull = () => {
    const desktop = getDesktop()
    if (!desktop) return
    switchWindowMode(desktop, 'full').catch((err: unknown) =>
      toast({ message: err instanceof Error ? err.message : String(err) }),
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-sidebar text-foreground">
      <header className="app-drag flex h-10 shrink-0 items-center gap-2 pl-4 pr-2">
        <span className="text-sm font-semibold text-secondary-foreground">今天</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{noteDayLabel(today)}</span>
        <button
          type="button"
          onClick={backToFull}
          aria-label="回到完整窗口"
          title="回到完整窗口"
          className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Maximize2 size={15} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        <NotesView days={days} today={today} compact focusTick={focusTick} />
      </div>
    </div>
  )
}
