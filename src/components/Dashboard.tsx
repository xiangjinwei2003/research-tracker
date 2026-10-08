import { useMemo, useRef, useState } from 'react'
import { Archive, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/cn'
import { PROJECT_COLOR_PRESETS, type Project } from '@/lib/types'
import { emptyProjectDraft } from '@/lib/project'
import { isSubmitEnter } from '@/lib/keyboard'
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
  const addProject = useStore((s) => s.addProject)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  // 回车提交后输入框卸载会触发 blur，这个标记防止同一标题被提交两次。
  const committedRef = useRef(false)

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

  const openAdd = () => {
    committedRef.current = false
    setDraft('')
    setAdding(true)
    if (collapsed) toggleCollapsed()
  }
  const commitProject = () => {
    if (committedRef.current) return
    committedRef.current = true
    const title = draft.trim()
    setDraft('')
    setAdding(false)
    if (!title) return
    const color = PROJECT_COLOR_PRESETS[projects.length % PROJECT_COLOR_PRESETS.length]
    addProject(emptyProjectDraft(color, title))
  }

  const visible = useMemo(
    // Keep the store's array order (newest created first): rows hold a fixed
    // position instead of reshuffling as deadlines shift or todos change.
    () => projects.filter((p) => p.archived === showArchived),
    [projects, showArchived],
  )

  if (showArchived) {
    return (
      <main className="mx-auto w-full max-w-[66rem] px-4 pb-24 pt-2 sm:px-6 lg:pt-4">
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
      <div className="flex h-10 items-center gap-2 border-b border-border">
        {collapsible ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="overview-list"
            className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-[15px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <h2 className="text-[15px] font-semibold">项目</h2>
        )}
        <span className="text-[13px] tabular-nums text-faint">{visible.length}</span>
        <button
          type="button"
          onClick={openAdd}
          aria-label="新建项目"
          title="新建项目"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={15} />
          新建项目
        </button>
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-2.5 px-1.5">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full border-2"
            style={{
              borderColor: PROJECT_COLOR_PRESETS[projects.length % PROJECT_COLOR_PRESETS.length],
            }}
          />
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (isSubmitEnter(e)) commitProject()
              else if (e.key === 'Escape') {
                committedRef.current = true
                setAdding(false)
              }
            }}
            onBlur={commitProject}
            placeholder="项目名称，回车创建，Esc 取消"
            aria-label="新项目名称"
            className="h-9 min-w-0 flex-1 rounded-md bg-muted px-2.5 text-[15px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : null}

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
