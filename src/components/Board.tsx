import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Check, Pin, Timer } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { useStore, weekItems, type WeekItem } from '@/lib/store'
import {
  findStage,
  todoPriority,
  PRIORITY_META,
  PRIORITY_ORDER,
  type Priority,
  type Project,
} from '@/lib/types'
import { dateFromToday, daysUntil, weekdayLabel, today, weekStart } from '@/lib/date'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { primeChime, reminderEnabled, requestNotifyPermission } from '@/lib/reminder'
import { StageChip } from './StageChip'
import { Container } from './ui/Container'
import { Dashboard } from './Dashboard'
import { FocusTimer } from './FocusTimer'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
} from './ui/ContextMenu'

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
  const startTimer = useStore((s) => s.startTimer)

  const t = today()
  const end = dateFromToday(WINDOW_DAYS)
  // Hero kicker label — ISO week + the Mon–Sun range, e.g. `WEEK 31 · 07.27 – 08.02`.
  const ws = weekStart(new Date())
  const kickerLabel = `WEEK ${format(ws, 'ww')} · ${format(ws, 'MM.dd')} – ${format(addDays(ws, 6), 'MM.dd')}`
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

  // What the last right-click landed on: a task card → the countdown binds to
  // that todo; anywhere else in the section → 自由专注.
  const [ctxTarget, setCtxTarget] = useState<{
    projectId: string
    todoId: string
    title: string
  } | null>(null)

  const onSectionContextMenu = (e: ReactMouseEvent) => {
    const hit = (e.target as HTMLElement).closest?.('[data-todo-id]') as HTMLElement | null
    setCtxTarget(
      hit && hit.dataset.projectId && hit.dataset.todoId
        ? {
            projectId: hit.dataset.projectId,
            todoId: hit.dataset.todoId,
            title: hit.dataset.todoTitle ?? '',
          }
        : null,
    )
  }

  const startFocus = (plannedMin: number) => {
    // Unlock audio (and ask for notifications) inside this click — the autoplay
    // policy would block a chime scheduled an hour from now.
    if (reminderEnabled()) {
      primeChime()
      void requestNotifyPermission()
    }
    startTimer({
      plannedMin,
      projectId: ctxTarget?.projectId,
      todoId: ctxTarget?.todoId,
    })
  }

  const ctxLabel = ctxTarget
    ? `专注 · ${(ctxTarget.title || '未命名待办').length > 14 ? `${(ctxTarget.title || '未命名待办').slice(0, 14)}…` : ctxTarget.title || '未命名待办'}`
    : '自由专注'

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
          <ContextMenu>
            <ContextMenuTrigger asChild>
          <section aria-label="本周重点" onContextMenu={onSectionContextMenu}>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
              <div className="min-w-0 flex-1">
                <div className="kicker">{kickerLabel}</div>
                <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  本周重点
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {items.length > 0
                    ? `${WINDOW_DAYS} 天内到期 · 共 ${items.length} 项 · 右键任务开始专注`
                    : `${WINDOW_DAYS} 天内到期会自动出现，也可从下方项目总览拖入`}
                </p>
              </div>
              {/* The focus countdown lives top-right of the section header. */}
              <FocusTimer />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
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
                      'rounded-lg border p-2 transition-colors',
                      isOver
                        ? 'border-dashed border-brand-500/70 bg-brand-500/[0.06]'
                        : 'border-white/5 bg-white/[0.015]',
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2 px-1 pt-1">
                      <span className={cn('inline-block h-2.5 w-2.5 rounded-full', meta.dot)} />
                      <h3 className="text-[13px] font-semibold text-foreground/90">{meta.label}</h3>
                      <span className="mono text-faint">{rows.length}</span>
                      {isOver ? (
                        <span className="ml-auto text-[10.5px] text-brand-300">
                          松开设为 {meta.short}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-h-[88px] space-y-2.5">
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
                        <p className="px-1 py-6 text-center text-xs text-faint">
                          暂无 · 拖动卡片到此
                        </p>
                      ) : null}
                    </div>
                  </section>
                )
              })}
            </div>

            {items.length > 0 ? (
              /* Per-project share of the week — a quiet footnote under the board
                 (the header slot above belongs to the focus countdown). */
              <div className="mt-6">
                <h3 className="kicker">本周分布</h3>
                <ul className="mt-2 max-w-xl space-y-2">
                  {byProject.map(({ project, count }) => {
                    const pct = Math.round((count / items.length) * 100)
                    return (
                      <li key={project.id} className="flex items-center gap-3">
                        <span
                          title={project.title || '未命名项目'}
                          className="w-28 shrink-0 truncate text-xs text-muted-foreground"
                        >
                          {project.title || '未命名项目'}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          {/* Each bar takes its project's colour — share of the week
                              read straight off the palette. */}
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: project.color }}
                          />
                        </div>
                        <span
                          title={`${count} 项`}
                          className="w-9 shrink-0 text-right mono text-faint"
                        >
                          {pct}%
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </section>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel>{ctxLabel}</ContextMenuLabel>
              <ContextMenuItem onSelect={() => startFocus(30)}>
                <Timer size={15} /> 倒计时 30 分钟
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => startFocus(60)}>
                <Timer size={15} /> 倒计时 1 小时
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
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
      data-todo-id={todo.id}
      data-project-id={project.id}
      data-todo-title={todo.title}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', todo.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      title="拖动调整重要程度 · 右键开始专注"
      className={cn(
        // Flat card with a hairline drop; hover only lifts the border.
        'group cursor-grab rounded-md border border-border bg-card p-2.5 pl-3 shadow-[0_1px_2px_rgba(0,0,0,.35)] transition hover:border-white/15 active:cursor-grabbing',
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
          className="mt-0.5 inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3.5px] border border-[#3a3e4d] text-transparent transition hover:border-brand-400 hover:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Check size={10} />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="line-clamp-2 block w-full rounded text-left text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {todo.title || <span className="italic text-faint">未命名待办</span>}
          </button>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: project.color }}
            />
            <span className="min-w-0 truncate">{project.title}</span>
            <StageChip stage={stage} />
            {pinnedExtra ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnpin()
                }}
                title="已手动加入本周 · 点击移出"
                aria-label="移出本周重点"
                className="inline-flex shrink-0 items-center gap-0.5 rounded border border-brand-500/40 bg-brand-500/10 px-1 text-[10px] text-brand-300 transition-colors hover:bg-brand-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Pin size={10} /> 本周
              </button>
            ) : null}
            <span
              className={cn(
                'mono ml-auto',
                overdue
                  ? 'text-destructive'
                  : hasDate && dleft === 0
                    ? 'text-warn'
                    : 'text-muted-foreground',
              )}
            >
              {rel}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
