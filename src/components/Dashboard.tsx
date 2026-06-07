import { useMemo } from 'react'
import { Plus, Archive, Sparkles } from 'lucide-react'
import { useStore, nextDeadline } from '@/lib/store'
import { daysUntil } from '@/lib/date'
import { toast } from '@/lib/toast'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'
import { Logo } from './Logo'
import { Button } from './ui/Button'
import { Container } from './ui/Container'

interface Props {
  showArchived: boolean
  onNew: () => void
  onEdit: (p: Project) => void
}

export function Dashboard({ showArchived, onNew, onEdit }: Props) {
  const projects = useStore((s) => s.projects)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const undo = useStore((s) => s.undo)

  const visible = useMemo(() => {
    const filtered = projects.filter((p) => p.archived === showArchived)
    // Sort: items with deadlines by soonest first; no-deadline at the bottom by recency.
    return [...filtered].sort((a, b) => {
      const da = nextDeadline(a)?.date
      const db = nextDeadline(b)?.date
      if (da && db) return da.localeCompare(db)
      if (da) return -1
      if (db) return 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [projects, showArchived])

  const urgentCount = visible.filter((p) => {
    const nd = nextDeadline(p)
    if (!nd) return false
    const d = daysUntil(nd.date)
    return d != null && d <= 14
  }).length

  const onLoadDemo = () => {
    resetToSeed()
    toast({
      message: '已加载演示数据',
      action: { label: '撤销', onClick: () => undo() },
    })
  }

  return (
    <Container className="py-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {showArchived ? '已归档项目' : '项目总览'}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {showArchived ? (
              `${visible.length} 个已归档项目`
            ) : (
              <>
                {visible.length} 个进行中
                {urgentCount > 0 ? (
                  <>
                    {' · '}
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {urgentCount} 个有 14 天内的截止
                    </span>
                  </>
                ) : (
                  ' · 近 14 天无紧迫截止'
                )}
              </>
            )}
          </p>
        </div>
        {!showArchived && visible.length > 0 ? (
          <Button variant="primary" onClick={onNew}>
            <Plus size={16} /> 新建项目
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        showArchived ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
            <Archive size={28} className="mx-auto mb-2 text-neutral-400" />
            <p className="text-sm text-neutral-500">还没有归档的项目。</p>
            <p className="mt-1 text-xs text-neutral-400">
              在项目编辑页点「归档」即可把完成或搁置的课题收纳到这里。
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
            <Logo size={48} className="mx-auto" />
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              开始追踪你的研究项目
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              为每个课题记录投稿目标、研究阶段、待办与合作者。「本周重点」会自动汇总最近到期的事项。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Button variant="primary" onClick={onNew}>
                <Plus size={16} /> 新建第一个项目
              </Button>
              <Button variant="secondary" onClick={onLoadDemo}>
                <Sparkles size={15} /> 加载示例数据
              </Button>
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              数据只保存在此浏览器，可随时导出 JSON 备份。
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={() => onEdit(p)} />
          ))}
        </div>
      )}
    </Container>
  )
}
