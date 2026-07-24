import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'
import { Container } from './ui/Container'
import { DeadlineCalendar } from './DeadlineCalendar'

interface Props {
  onEdit: (p: Project) => void
}

/** 截止日历页：把投稿截止 / Rebuttal / 待办到期都落到月历上，点某天看当天详情。 */
export function Timeline({ onEdit }: Props) {
  const hasProjects = useStore((s) => s.projects.some((p) => !p.archived))

  return (
    <Container className="py-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">截止日历</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          红点 = 投稿截止 / Rebuttal；灰点 = 待办到期。点某天查看当天到期事项。
        </p>
      </div>

      {hasProjects ? (
        <DeadlineCalendar onEdit={onEdit} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          还没有项目，去「总览」新建一个吧。
        </div>
      )}
    </Container>
  )
}
