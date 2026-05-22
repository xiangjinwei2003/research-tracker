import { useMemo } from 'react'
import { Plus, Inbox, Archive } from 'lucide-react'
import { useStore, nextDeadline } from '@/lib/store'
import { daysUntil } from '@/lib/date'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'
import { Button } from './ui/Button'

interface Props {
  showArchived: boolean
  onNew: () => void
  onEdit: (p: Project) => void
}

export function Dashboard({ showArchived, onNew, onEdit }: Props) {
  const projects = useStore((s) => s.projects)

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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {showArchived ? '已归档项目' : '项目总览'}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {showArchived
              ? `${visible.length} 个已归档项目`
              : `${visible.length} 个进行中 · 其中 ${urgentCount} 个有 14 天内的截止`}
          </p>
        </div>
        {!showArchived ? (
          <Button variant="primary" onClick={onNew}>
            <Plus size={16} /> 新建项目
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
          {showArchived ? (
            <>
              <Archive size={28} className="mx-auto mb-2 text-neutral-400" />
              <p className="text-sm text-neutral-500">还没有归档的项目。</p>
            </>
          ) : (
            <>
              <Inbox size={28} className="mx-auto mb-2 text-neutral-400" />
              <p className="text-sm text-neutral-500">还没有项目。</p>
              <Button variant="primary" onClick={onNew} className="mt-4">
                <Plus size={16} /> 新建第一个项目
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={() => onEdit(p)} />
          ))}
        </div>
      )}
    </div>
  )
}
