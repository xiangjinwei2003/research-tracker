import { useMemo, useRef, useState } from 'react'
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
import { cn } from '@/lib/cn'
import { StageChip } from './StageChip'
import { Dashboard } from './Dashboard'

interface Props {
  onNew: () => void
  onEdit: (p: Project) => void
}

/** Number of days ahead the board covers (today + this many days). */
const WINDOW_DAYS = 7

/**
 * Merged home view: a drag-to-prioritise board of everything due in the next
 * 7 days (plus overdue carry-over), followed by the full project overview.
 * Drag a card between columns to change that todo's importance.
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

  const dragRef = useRef<{ projectId: string; todoId: string; from: Priority } | null>(null)
  const [overCol, setOverCol] = useState<Priority | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleDrop = (pri: Priority) => {
    const d = dragRef.current
    setOverCol(null)
    setDraggingId(null)
    dragRef.current = null
    if (d && d.from !== pri) updateTodo(d.projectId, d.todoId, { priority: pri })
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            本周重点
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            今天起 {WINDOW_DAYS} 天内到期 · 拖动卡片调整重要程度 · 共 {items.length} 项
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {columns.map(({ pri, rows }) => {
            const meta = PRIORITY_META[pri]
            const isOver = overCol === pri
            return (
              <section
                key={pri}
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
                  handleDrop(pri)
                }}
                className={cn(
                  'rounded-xl border p-2 transition',
                  isOver
                    ? 'border-neutral-400 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800/60'
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
                    />
                  ))}
                  {rows.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
                      拖到这里
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <Dashboard showArchived={false} onNew={onNew} onEdit={onEdit} />
    </>
  )
}

function BoardCard({
  item,
  todayIso,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  item: WeekItem
  todayIso: string
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: () => void
}) {
  const { project, todo } = item
  const stage = findStage(project.stages, todo.stage)
  const overdue = todo.endDate < todayIso
  const dleft = daysUntil(todo.endDate) ?? 0
  const rel = overdue
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
      title="点击打开项目 · 拖动调整重要程度"
      className={cn(
        'cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm transition hover:border-neutral-300 hover:shadow active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700',
        dragging && 'opacity-40',
      )}
    >
      <div className="line-clamp-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {todo.title || <span className="italic text-neutral-400">未命名待办</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <StageChip stage={stage} />
        <span className="min-w-0 truncate">{project.title}</span>
      </div>
      <div
        className={cn(
          'mt-1.5 text-xs tabular-nums',
          overdue
            ? 'font-medium text-red-600 dark:text-red-400'
            : dleft === 0
              ? 'font-medium text-orange-600 dark:text-orange-400'
              : 'text-neutral-500 dark:text-neutral-500',
        )}
      >
        {rel} · {fmtMD(todo.endDate)}
      </div>
    </article>
  )
}
