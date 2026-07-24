import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'
import { Container } from './ui/Container'
import { DeadlineCalendar } from './DeadlineCalendar'

interface Props {
  onEdit: (p: Project) => void
}

/** 截止日历页：整屏月视图，投稿截止 / Rebuttal / 待办到期都落到对应日期。 */
export function Timeline({ onEdit }: Props) {
  const hasProjects = useStore((s) => s.projects.some((p) => !p.archived))

  return (
    <Container className="py-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">截止日历</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          整月一览：▲ 投稿截止、◆ Rebuttal、待办到期落在对应日期；过去的日子置灰。点月份可跳到任意日期。
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
