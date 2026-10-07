import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'
import { CalendarDays } from 'lucide-react'
import { DeadlineCalendar } from './DeadlineCalendar'

interface Props {
  onEdit: (p: Project) => void
}

/** 截止日历页：整屏月视图，投稿截止 / Rebuttal / 待办到期都落到对应日期。 */
export function Timeline({ onEdit }: Props) {
  const projects = useStore((s) => s.projects)
  const hasActive = projects.some((p) => !p.archived)
  const hasArchived = projects.some((p) => p.archived)

  return (
    <main className="flex flex-1 flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      {hasActive ? (
        <DeadlineCalendar onEdit={onEdit} />
      ) : (
        <>
          <h1 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.01em]">
            <CalendarDays size={26} strokeWidth={2.2} className="text-destructive" aria-hidden />
            日历
          </h1>
          <p className="mt-1.5 max-w-sm pl-[36px] text-[13px] leading-6 text-muted-foreground">
            {hasArchived
              ? '进行中的项目都已归档。截止日期在归档页的项目里。'
              : '还没有项目。投稿截止、Rebuttal 和待办到期日会排在这里。'}
          </p>
        </>
      )}
    </main>
  )
}
