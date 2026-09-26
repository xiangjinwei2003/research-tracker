import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'
import { Container } from './ui/Container'
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
    <Container className="py-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight text-foreground">日历</h2>
      </div>

      {hasActive ? (
        <DeadlineCalendar onEdit={onEdit} />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-12 text-center text-sm text-muted-foreground">
          {hasArchived
            ? '进行中的项目都已归档。截止日期在归档页的项目里。'
            : '还没有项目。用右上角的新建项目开始。'}
        </div>
      )}
    </Container>
  )
}
