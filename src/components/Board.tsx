import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { CalendarRange, Check, Pin } from 'lucide-react'
import { useStore, weekItems, type WeekItem } from '@/lib/store'
import {
  findStage,
  todoPriority,
  PRIORITY_META,
  PRIORITY_ORDER,
  type Priority,
  type Project,
} from '@/lib/types'
import { dateFromToday, daysUntil, weekdayLabel, today } from '@/lib/date'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { StageChip } from './StageChip'
import { Container } from './ui/Container'
import { Dashboard } from './Dashboard'

interface Props {
  onNew: () => void
  onEdit: (p: Project) => void
}

/** Number of days ahead the board covers (today + this many days). */
const WINDOW_DAYS = 7

/**
 * Home view, split into two clearly separated zones:
 *   1. 本周重点 — a drag-to-prioritise board of everything due in the next 7 days
 *      (plus overdue carry-over) and anything manually pinned from the overview.
 *   2. 项目总览 — the full project grid (collapsible) whose todos can be dragged
 *      up into (1). Priority is set by dragging a card between columns.
 */
export function Board({ onNew, onEdit }: Props) {
  const projects = useStore((s) => s.projects)
  const updateTodo = useStore((s) => s.updateTodo)
  const toggleTodoDone = useStore((s) => s.toggleTodoDone)

  const t = today()
  const end = dateFromToday(WINDOW_DAYS)
  const items = useMemo(() => weekItems(projects, end), [projects, end])

  const columns = useMemo(() => {
    const byPri: Record<Priority, WeekItem[]> = { high: [], normal: [], low: [] }
    for (const it of items) byPri[todoPriority(it.todo)].push(it)
    return PRIORITY_ORDER.map((pri) => ({ pri, rows: byPri[pri] }))
  }, [items])

  // How this week's items split across projects — drives the proportion bar.
  const byProject = useMemo(() => {
    const map = new Map<string, { project: Project; count: number }>()
    for (const it of items) {
      const e = map.get(it.project.id)
      if (e) e.count += 1
      else map.set(it.project.id, { project: it.project, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [items])

  const hasActiveProjects = useMemo(() => projects.some((p) => !p.archived), [projects])

  const dragRef = useRef<{ projectId: string; todoId: string; from: Priority } | null>(null)
  const [overCol, setOverCol] = useState<Priority | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleDrop = (pri: Priority, e: DragEvent) => {
    const d = dragRef.current
    setOverCol(null)
    setDraggingId(null)
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

  return (
    <>
      {hasActiveProjects ? (
        <Container className="pt-6 pb-14">
          <section aria-label="本周重点">
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
            </div>

            {items.length > 0 ? (
              /* Per-project horizontal bars: each project's share of this week. */
              <ul className="mt-4 max-w-xl space-y-2">
                {byProject.map(({ project, count }) => {
                  const pct = Math.round((count / items.length) * 100)
                  return (
                    <li key={project.id} className="flex items-center gap-3">
                      <span
                        title={project.title || '未命名项目'}
                        className="w-28 shrink-0 truncate text-xs text-neutral-600 dark:text-neutral-300"
                      >
                        {project.title || '未命名项目'}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/70">
                        {/* One consistent accent for the chart (project colors
                            stay on the cards); saturated so it doesn't read faint. */}
                        <div
                          className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        title={`${count} 项`}
                        className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500"
                      >
                        {pct}%
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                          onToggleDone={() => {
                            toggleTodoDone(it.project.id, it.todo.id)
                            toast({
                              message: `已完成「${it.todo.title || '未命名待办'}」`,
                              action: {
                                label: '撤销',
                                onClick: () => toggleTodoDone(it.project.id, it.todo.id),
                              },
                            })
                          }}
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
          </section>
        </Container>
      ) : null}

      <Dashboard
        showArchived={false}
        onNew={onNew}
        onEdit={onEdit}
        collapsible
        draggableTodos
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
  onToggleDone,
  onUnpin,
}: {
  item: WeekItem
  todayIso: string
  pinnedExtra: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: () => void
  onToggleDone: () => void
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
          : weekdayLabel(todo.endDate, todayIso)

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
      style={{ '--proj': project.color } as CSSProperties}
      className={cn(
        // Border/bg + hover border come from .proj-card (project-hue tint).
        'proj-card cursor-grab rounded-lg border p-2.5 shadow-sm transition hover:shadow active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone()
          }}
          title="标记完成"
          aria-label={`标记「${todo.title || '未命名待办'}」为已完成`}
          className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-neutral-300 text-transparent transition hover:border-brand-500 hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-neutral-600 dark:hover:border-brand-500 dark:hover:text-brand-400"
        >
          <Check size={12} />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="line-clamp-2 block w-full rounded text-left text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-200"
          >
            {todo.title || <span className="italic text-neutral-400">未命名待办</span>}
          </button>
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
            {rel}
          </div>
        </div>
      </div>
    </article>
  )
}
