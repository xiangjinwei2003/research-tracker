import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'
import { CalendarDays } from 'lucide-react'
import { DeadlineCalendar } from './DeadlineCalendar'
import { PageHeader } from './PageHeader'

interface Props {
  onEdit: (p: Project) => void
}

/** 截止日历页：整屏月视图，任务按截止日期排在对应日期。 */
export function Timeline({ onEdit }: Props) {
  const projects = useStore((s) => s.projects)
  const hasActive = projects.some((p) => !p.archived)
  const hasArchived = projects.some((p) => p.archived)

  return (
    <main className="flex flex-1 flex-col px-4 pb-8 pt-2 sm:px-6 lg:pt-4">
      {hasActive ? (
        <DeadlineCalendar onEdit={onEdit} />
      ) : (
        <PageHeader
          icon={CalendarDays}
          tint="text-purple-11"
          title="日历"
          subtitle={
            hasArchived
              ? '进行中的项目都已归档。截止日期在归档页的项目里。'
              : '还没有项目。任务的截止日期会排在这里。'
          }
        />
      )}
    </main>
  )
}
