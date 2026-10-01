import { useMemo, useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/cn'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'
import { Button } from './ui/Button'
import { Container } from './ui/Container'

const COLLAPSE_KEY = 'rt-overview-collapsed'

function readCollapsed(): boolean {
  try {
    const value = localStorage.getItem(COLLAPSE_KEY)
    if (value === '0') return false
    if (value === '1') return true
  } catch {
    /* private mode */
  }
  return true
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

  return (
    <Container className="py-5">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">
            {showArchived ? '已归档项目' : '项目'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showArchived
              ? `${visible.length} 个已归档`
              : `${visible.length} 个进行中`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!showArchived && !collapsible && visible.length > 0 ? (
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
              aria-label={collapsed ? '展开项目' : '折叠项目'}
              title={collapsed ? '展开项目' : '折叠项目'}
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
          <div className="rounded-xl border border-dashed border-border bg-panel px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">还没有归档的项目。</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-panel px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">还没有项目。</p>
            <div className="mt-4 flex justify-center">
              <Button variant="primary" onClick={onNew}>
                <Plus size={16} /> 新建项目
              </Button>
            </div>
          </div>
        )
      ) : (
        <div
          id="overview-grid"
          className="pane-grid cols-2 cols-3 gap-3"
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
