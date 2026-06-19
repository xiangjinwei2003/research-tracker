import { useMemo, useState } from 'react'
import { Plus, Archive, Sparkles, ChevronDown } from 'lucide-react'
import { useStore, nextDeadline } from '@/lib/store'
import { daysUntil } from '@/lib/date'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'
import { Logo } from './Logo'
import { Button } from './ui/Button'
import { Container } from './ui/Container'

const COLLAPSE_KEY = 'rt-overview-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

interface Props {
  showArchived: boolean
  onNew: () => void
  onEdit: (p: Project) => void
  /** Forwarded to each card so its todos can be dragged into 本周重点. */
  draggableTodos?: boolean
  /** Show a fold/unfold toggle for the project grid (home overview only). */
  collapsible?: boolean
}

export function Dashboard({
  showArchived,
  onNew,
  onEdit,
  draggableTodos = false,
  collapsible = false,
}: Props) {
  const projects = useStore((s) => s.projects)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const undo = useStore((s) => s.undo)

  const [collapsed, setCollapsed] = useState(() => collapsible && readCollapsed())
  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore persistence failures (e.g. private mode) */
    }
  }

  const visible = useMemo(
    // Keep the store's array order (newest created first): cards hold a fixed
    // position instead of reshuffling as deadlines shift or todos change.
    () => projects.filter((p) => p.archived === showArchived),
    [projects, showArchived],
  )

  const urgentCount = useMemo(
    () =>
      visible.filter((p) => {
        const nd = nextDeadline(p)
        if (!nd) return false
        const d = daysUntil(nd.date)
        return d != null && d <= 14
      }).length,
    [visible],
  )

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
        <div className="flex shrink-0 items-center gap-2">
          {!showArchived && visible.length > 0 ? (
            <Button variant="primary" onClick={onNew}>
              <Plus size={16} /> 新建项目
            </Button>
          ) : null}
          {collapsible && visible.length > 0 ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls="overview-grid"
              title={collapsed ? '展开项目总览' : '折叠项目总览'}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <ChevronDown
                size={18}
                className={cn('transition-transform', collapsed && '-rotate-90')}
              />
            </button>
          ) : null}
        </div>
      </div>

      {collapsed ? null : visible.length === 0 ? (
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
        <div
          id="overview-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={onEdit}
              draggableTodos={draggableTodos}
            />
          ))}
        </div>
      )}
    </Container>
  )
}
