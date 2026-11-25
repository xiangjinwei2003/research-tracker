import { useMemo, useState } from 'react'
import { NotebookPen, PanelRight, PanelRightClose } from 'lucide-react'
import { useStore } from '@/lib/store'
import { streamDays } from '@/lib/notes'
import { today as todayIso } from '@/lib/date'
import { PageHeader } from './PageHeader'
import { Button } from './ui/Button'
import { NotesView } from './notes/NotesView'

/** 今天以外先显示的有内容日期数，「显示更早的笔记」每次再加这么多。 */
const PAGE_DAYS = 14

interface Props {
  pinned: boolean
  onTogglePin: () => void
  focusTick: number
}

/** 每日笔记：今天在最上面，往下是更早有内容的日期。 */
export function Notes({ pinned, onTogglePin, focusTick }: Props) {
  const notes = useStore((s) => s.notes)
  const [limit, setLimit] = useState(PAGE_DAYS)
  const today = todayIso()
  const { days, more } = useMemo(() => streamDays(notes, today, limit), [notes, today, limit])

  return (
    <main className="mx-auto w-full max-w-[66rem] px-4 pb-24 pt-2 sm:px-6 lg:pt-4">
      <div className="mb-8">
        <PageHeader
          icon={NotebookPen}
          tint="text-cyan-11"
          title="笔记"
          actions={
            // 右侧栏只在宽窗口出现，窄窗口不显示这个按钮。
            <Button variant="ghost" size="sm" className="hidden min-[68.75rem]:inline-flex" onClick={onTogglePin}>
              {pinned ? <PanelRightClose /> : <PanelRight />}
              {pinned ? '取消固定' : '固定到右侧'}
            </Button>
          }
        />
      </div>
      <div className="max-w-[46rem] pl-9">
        <NotesView days={days} today={today} focusTick={focusTick} />
        {more ? (
          <Button variant="ghost" size="sm" className="-ml-2.5 mt-8" onClick={() => setLimit((n) => n + PAGE_DAYS)}>
            显示更早的笔记
          </Button>
        ) : null}
      </div>
    </main>
  )
}
