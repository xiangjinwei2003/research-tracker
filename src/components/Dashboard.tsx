import { useMemo, useState } from 'react'
import { Plus, Archive, ChevronDown } from 'lucide-react'
import { useStore, nextDeadline } from '@/lib/store'
import { daysUntil } from '@/lib/date'
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

  return (
    <Container className="py-5">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">
            {showArchived ? '已归档项目' : '项目总览'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showArchived ? (
              `${visible.length} 个已归档项目`
            ) : (
              <>
                {visible.length} 个进行中
                {urgentCount > 0 ? (
                  <>
                    {' · '}
                    <span className="font-medium text-warn">
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
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
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
          <div className="rounded-xl border border-dashed border-white/10 bg-panel p-12 text-center">
            <Archive size={28} className="mx-auto mb-2 text-faint" />
            <p className="text-sm text-muted-foreground">还没有归档的项目。</p>
            <p className="mt-1 text-xs text-faint">
              在项目编辑页点「归档」即可把完成或搁置的课题收纳到这里。
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-panel p-12 text-center">
            <Logo size={48} className="mx-auto" />
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
              开始追踪你的研究项目
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              为每个课题记录投稿目标、研究阶段、待办与合作者。「本周重点」会自动汇总最近到期的事项。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Button variant="primary" onClick={onNew}>
                <Plus size={16} /> 新建第一个项目
              </Button>
            </div>
            <p className="mt-4 text-xs text-faint">
              数据只保存在此浏览器，可随时导出 JSON 备份。
            </p>
          </div>
        )
      ) : (
        <div
          id="overview-grid"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={onEdit}
              draggableTodos={draggableTodos}
              dimmed={showArchived}
            />
          ))}
        </div>
      )}
    </Container>
  )
}
