import { useMemo, useState } from 'react'
import { Archive, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/cn'
import type { Project } from '@/lib/types'
import { ProjectRow } from './ProjectRow'

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
  /** Forwarded to each row so its todos can be dragged into the task list. */
  draggableTodos?: boolean
  /** Show a fold/unfold toggle for the project list (home only). */
  collapsible?: boolean
}

/**
 * 项目列表。首页任务列表下方是进行中项目（可折叠）；归档页是整页的已归档项目。
 */
export function Dashboard({
  showArchived,
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
    // Keep the store's array order (newest created first): rows hold a fixed
    // position instead of reshuffling as deadlines shift or todos change.
    () => projects.filter((p) => p.archived === showArchived),
    [projects, showArchived],
  )

  if (showArchived) {
    return (
      <main className="mx-auto w-full max-w-[52rem] px-4 pb-24 pt-6 sm:px-8 lg:pt-10">
        <h1 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.01em]">
          <Archive size={26} strokeWidth={2.2} className="text-faint" aria-hidden />
          归档
        </h1>
        <p className="mt-1.5 pl-[36px] text-[13px] text-muted-foreground">
          {visible.length ? `${visible.length} 个项目` : '已完成或搁置的项目会放在这里'}
        </p>
        {visible.length ? (
          <ul className="mt-8 border-t border-border pt-2">
            {visible.map((p) => (
              <ProjectRow key={p.id} project={p} onEdit={onEdit} dimmed />
            ))}
          </ul>
        ) : (
          <p className="mt-8 max-w-sm pl-[36px] text-[13px] leading-6 text-faint">
            在项目详情里选择归档，项目就会从任务列表移到这里，数据保留。
          </p>
        )}
      </main>
    )
  }

  return (
    <section aria-label="项目">
      <div className="flex h-9 items-center gap-2 border-b border-border">
        {collapsible ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="overview-list"
            className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-[13px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              size={14}
              strokeWidth={2.4}
              className={cn(
                'text-faint transition-transform duration-200',
                !collapsed && 'rotate-90',
              )}
            />
            项目
          </button>
        ) : (
          <h2 className="text-[13px] font-semibold">项目</h2>
        )}
        <span className="text-xs tabular-nums text-faint">{visible.length}</span>
      </div>

      {collapsed ? null : (
        <ul id="overview-list" className="mt-1">
          {visible.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              onEdit={onEdit}
              draggableTodos={draggableTodos}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
