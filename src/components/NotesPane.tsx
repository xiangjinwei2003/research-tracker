import { useMemo } from 'react'
import { PanelRightClose, PictureInPicture2 } from 'lucide-react'
import { noteDayLabel } from '@/lib/notes'
import { today as todayIso } from '@/lib/date'
import { toast } from '@/lib/toast'
import { getDesktop } from '@/platform/desktop'
import { switchWindowMode } from '@/platform/windowMode'
import { NotesView } from './notes/NotesView'

interface Props {
  onUnpin: () => void
  onOpenPage: () => void
  focusTick: number
}

/** 固定在右侧的今天笔记，切换到其他分区时仍然可见。 */
export function NotesPane({ onUnpin, onOpenPage, focusTick }: Props) {
  const today = todayIso()
  const days = useMemo(() => [today], [today])
  return (
    <aside className="notes-pane z-30 bg-sidebar" aria-label="今天的笔记">
      <div className="flex h-12 shrink-0 items-center gap-2 pl-5 pr-3">
        <button
          type="button"
          onClick={onOpenPage}
          title="打开笔记页"
          className="flex min-w-0 items-baseline gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-sm font-semibold text-secondary-foreground">今天</span>
          <span className="truncate text-xs text-muted-foreground">{noteDayLabel(today)}</span>
        </button>
        {getDesktop() ? (
          <button
            type="button"
            onClick={() => {
              const desktop = getDesktop()
              if (desktop) {
                switchWindowMode(desktop, 'compact').catch((err: unknown) =>
                  toast({ message: err instanceof Error ? err.message : String(err) }),
                )
              }
            }}
            aria-label="置顶笔记小窗"
            title="置顶笔记小窗"
            className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PictureInPicture2 size={16} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onUnpin}
          aria-label="取消固定"
          title="取消固定"
          className={`${getDesktop() ? '' : 'ml-auto '}inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <NotesView days={days} today={today} compact focusTick={focusTick} />
      </div>
    </aside>
  )
}
