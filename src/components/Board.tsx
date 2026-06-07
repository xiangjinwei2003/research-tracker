import { useMemo, useRef, useState, type DragEvent } from 'react'
import { CalendarRange, ChevronDown, Pin } from 'lucide-react'
import { useStore, weekItems, type WeekItem } from '@/lib/store'
import {
  findStage,
  todoPriority,
  PRIORITY_META,
  PRIORITY_ORDER,
  type Priority,
  type Project,
} from '@/lib/types'
import { dateFromToday, fmtMD, daysUntil, today } from '@/lib/date'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { StageChip } from './StageChip'
import { PriorityButton } from './PriorityButton'
import { Container } from './ui/Container'
import { Dashboard } from './Dashboard'

interface Props {
  onNew: () => void
  onEdit: (p: Project) => void
}

/** Number of days ahead the board covers (today + this many days). */
const WINDOW_DAYS = 7

const COLLAPSE_KEY = 'rt-week-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Home view, split into two clearly separated zones:
 *   1. 本周重点 — a drag-to-prioritise board of everything due in the next 7 days
 *      (plus overdue carry-over) and anything manually pinned from the overview.
 *      Collapsible, so it can be folded away when browsing projects.
 *   2. 项目总览 — the full project grid, whose todos can be dragged up into (1).
 * Priority is set by dragging a card between columns or with the priority button.
 */
export function Board({ onNew, onEdit }: Props) {
  const projects = useStore((s) => s.projects)
  const updateTodo = useStore((s) => s.updateTodo)

  const t = today()
  const end = dateFromToday(WINDOW_DAYS)
  const items = useMemo(() => weekItems(projects, end), [projects, end])

  const columns = useMemo(() => {
    const byPri: Record<Priority, WeekItem[]> = { high: [], normal: [], low: [] }
    for (const it of items) byPri[todoPriority(it.todo)].push(it)
    return PRIORITY_ORDER.map((pri) => ({ pri, rows: byPri[pri] }))
  }, [items])

  const hasActiveProjects = useMemo(() => projects.some((p) => !p.archived), [projects])

  const dragRef = useRef<{ projectId: string; todoId: string; from: Priority } | null>(null)
  const [overCol, setOverCol] = useState<Priority | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // A todo is being dragged in from the project overview (not reordered in-board).
  const [pulling, setPulling] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore persistence failures (e.g. private mode) */
    }
  }

  const handleDrop = (pri: Priority, e: DragEvent) => {
    const d = dragRef.current
    setOverCol(null)
    setDraggingId(null)
    setPulling(false)
    dragRef.current = null
    // In-board reprioritise: just move the card to the dropped column.
    if (d) {
      if (d.from !== pri) updateTodo(d.projectId, d.todoId, { priority: pri })
      return
    }
    // Pulled in from 项目总览: pin it into this week at the dropped priority.
    const raw = e.dataTransfer.getData('application/x-rt-todo')
    if (!raw) return
    try {
      const { projectId, todoId } = JSON.parse(raw) as {
        projectId?: string
        todoId?: string
      }
      if (!projectId || !todoId) return
      updateTodo(projectId, todoId, { inWeek: true, priority: pri })
      toast({ message: `已加入本周重点 · ${PRIORITY_META[pri].label}` })
    } catch {
      /* ignore malformed payloads */
    }
  }

  // While pulling a card in, force the board open so there's a drop target.
  const showGrid = !collapsed || pulling

  return (
    <>
      {hasActiveProjects ? (
        <Container className="pt-6 pb-2">
          <section
            aria-label="本周重点"
            className={cn(
              'rounded-2xl border bg-white/70 p-4 shadow-sm transition-colors dark:bg-neutral-900/40 sm:p-5',
              pulling
                ? 'border-brand-300 ring-2 ring-brand-200 dark:border-brand-800 dark:ring-brand-900/60'
                : 'border-neutral-200 dark:border-neutral-800',
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                <CalendarRange size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  本周重点
                </h2>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {items.length > 0
                    ? `${WINDOW_DAYS} 天内到期 · 可从项目总览拖入更长期的任务 · 共 ${items.length} 项`
                    : `${WINDOW_DAYS} 天内到期会自动出现，也可从下方项目总览拖入`}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                aria-controls="week-board-grid"
                title={collapsed ? '展开本周重点' : '折叠本周重点'}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                <ChevronDown
                  size={18}
                  className={cn('transition-transform', collapsed && '-rotate-90')}
                />
              </button>
            </div>

            {showGrid ? (
              <div
                id="week-board-grid"
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {columns.map(({ pri, rows }) => {
                  const meta = PRIORITY_META[pri]
                  const isOver = overCol === pri
                  return (
                    <section
                      key={pri}
                      aria-label={`${meta.label}（${rows.length} 项）`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (overCol !== pri) setOverCol(pri)
                      }}
                      onDragLeave={(e) => {
                        // Ignore leaves that are just moving onto a child card.
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setOverCol((c) => (c === pri ? null : c))
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleDrop(pri, e)
                      }}
                      className={cn(
                        'rounded-xl border p-2 transition-colors',
                        isOver
                          ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-300 dark:border-brand-700 dark:bg-brand-950/30 dark:ring-brand-800'
                          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40',
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2 px-1 pt-1">
                        <span className={cn('inline-block h-2.5 w-2.5 rounded-full', meta.dot)} />
                        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                          {meta.label}
                        </h3>
                        <span className="tabular-nums text-xs text-neutral-400">{rows.length}</span>
                      </div>
                      <div className="min-h-[88px] space-y-2">
                        {rows.map((it) => (
                          <BoardCard
                            key={it.todo.id}
                            item={it}
                            todayIso={t}
                            pinnedExtra={it.pinnedExtra}
                            dragging={draggingId === it.todo.id}
                            onDragStart={() => {
                              dragRef.current = {
                                projectId: it.project.id,
                                todoId: it.todo.id,
                                from: pri,
                              }
                              setDraggingId(it.todo.id)
                            }}
                            onDragEnd={() => {
                              setDraggingId(null)
                              setOverCol(null)
                              dragRef.current = null
                            }}
                            onOpen={() => onEdit(it.project)}
                            onChangePriority={(p) =>
                              updateTodo(it.project.id, it.todo.id, { priority: p })
                            }
                            onUnpin={() =>
                              updateTodo(it.project.id, it.todo.id, { inWeek: false })
                            }
                          />
                        ))}
                        {rows.length === 0 ? (
                          <p className="px-1 py-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
                            暂无 · 拖动卡片到此
                          </p>
                        ) : null}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : null}
          </section>
        </Container>
      ) : null}

      <Dashboard
        showArchived={false}
        onNew={onNew}
        onEdit={onEdit}
        draggableTodos
        onTodoDragStart={() => setPulling(true)}
        onTodoDragEnd={() => {
          setPulling(false)
          setOverCol(null)
        }}
      />
    </>
  )
}

function BoardCard({
  item,
  todayIso,
  pinnedExtra,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onChangePriority,
  onUnpin,
}: {
  item: WeekItem
  todayIso: string
  pinnedExtra: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: () => void
  onChangePriority: (p: Priority) => void
  onUnpin: () => void
}) {
  const { project, todo } = item
  const stage = findStage(project.stages, todo.stage)
  const hasDate = !!todo.endDate
  const overdue = hasDate && todo.endDate < todayIso
  const dleft = daysUntil(todo.endDate) ?? 0
  const rel = !hasDate
    ? '未排期'
    : overdue
      ? `逾期 ${-dleft} 天`
      : dleft === 0
        ? '今天'
        : dleft === 1
          ? '明天'
          : `${dleft} 天后`

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', todo.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      title="拖动调整重要程度"
      className={cn(
        'cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm transition hover:border-brand-300 hover:shadow active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-brand-800/70',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="line-clamp-2 rounded text-left text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-200"
        >
          {todo.title || <span className="italic text-neutral-400">未命名待办</span>}
        </button>
        <PriorityButton priority={todoPriority(todo)} onChange={onChangePriority} />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {pinnedExtra ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onUnpin()
            }}
            title="已手动加入本周 · 点击移出"
            aria-label="移出本周重点"
            className="inline-flex shrink-0 items-center gap-0.5 rounded bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-600 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-950/50 dark:text-brand-300 dark:hover:bg-brand-900/60"
          >
            <Pin size={10} /> 本周
          </button>
        ) : null}
        <StageChip stage={stage} />
        <span className="min-w-0 truncate">{project.title}</span>
      </div>
      <div
        className={cn(
          'mt-1.5 text-xs tabular-nums',
          overdue
            ? 'font-medium text-red-600 dark:text-red-400'
            : hasDate && dleft === 0
              ? 'font-medium text-orange-600 dark:text-orange-400'
              : 'text-neutral-500 dark:text-neutral-500',
        )}
      >
        {hasDate ? `${rel} · ${fmtMD(todo.endDate)}` : rel}
      </div>
    </article>
  )
}
