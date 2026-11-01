import { useMemo, useRef, useState } from 'react'
import { Archive, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/cn'
import { PROJECT_COLOR_PRESETS, type Project } from '@/lib/types'
import { emptyProjectDraft } from '@/lib/project'
import { isSubmitEnter } from '@/lib/keyboard'
import { PageHeader } from './PageHeader'
import { PROJECT_DRAG_TYPE, ProjectRow, type ProjectDragHandlers } from './ProjectRow'

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
    // Keep the store's array order (newest created first, or the order set by
    // dragging): rows hold a fixed position instead of reshuffling as deadlines
    // shift or todos change.
    () => projects.filter((p) => p.archived === showArchived),
    [projects, showArchived],
  )

  // 拖动排序：松手时被拖的项目占据目标行的位置，与阶段排序的规则一致。
  const reorderProjects = useStore((s) => s.reorderProjects)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const drag = useMemo<ProjectDragHandlers>(
    () => ({
      onDragStart: (id) => {
        dragIdRef.current = id
        setDragId(id)
      },
      onDragOver: (e, id) => {
        if (!e.dataTransfer.types.includes(PROJECT_DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOverId(id === dragIdRef.current ? null : id)
      },
      onDrop: (e, targetId) => {
        const draggedId = dragIdRef.current
        if (!draggedId) return
        e.preventDefault()
        const ids = useStore
          .getState()
          .projects.filter((p) => !p.archived)
          .map((p) => p.id)
        const from = ids.indexOf(draggedId)
        const to = ids.indexOf(targetId)
        if (from < 0 || to < 0 || from === to) return
        ids.splice(from, 1)
        ids.splice(to, 0, draggedId)
        reorderProjects(ids)
      },
      onDragEnd: () => {
        dragIdRef.current = null
        setDragId(null)
        setOverId(null)
      },
    }),
    [reorderProjects],
  )

  if (showArchived) {
    return (
      <main className="mx-auto w-full max-w-[66rem] px-4 pb-24 pt-2 sm:px-6 lg:pt-4">
        <PageHeader
          icon={Archive}
          tint="text-muted-foreground"
          title="归档"
          subtitle={visible.length ? `${visible.length} 个项目` : undefined}
        />
        {visible.length ? (
          <ul className="mt-8 border-t-[0.5px] border-border pt-2">
            {visible.map((p) => (
              <ProjectRow key={p.id} project={p} onEdit={onEdit} dimmed />
            ))}
          </ul>
        ) : (
          <p className="mt-8 max-w-sm pl-9 text-sm leading-6 text-muted-foreground">
            在项目详情里选择归档，项目就会从任务列表移到这里，数据保留。
          </p>
        )}
      </main>
    )
  }

  return (
    <section aria-label="项目">
      <div className="flex h-10 items-center gap-2 border-b-[0.5px] border-border">
        {collapsible ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="overview-list"
            className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              size={14}
              strokeWidth={2.4}
              className={cn(
                'text-muted-foreground transition-transform',
                !collapsed && 'rotate-90',
              )}
            />
            项目
          </button>
        ) : (
          <h2 className="text-base font-semibold">项目</h2>
        )}
        <span className="text-sm tabular-nums text-muted-foreground">{visible.length}</span>
        <button
          type="button"
          onClick={openAdd}
          aria-label="新建项目"
          title="新建项目"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="h-9 min-w-0 flex-1 rounded-md bg-muted px-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
              drag={drag}
              dragging={dragId === p.id}
              dropTarget={overId === p.id}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
