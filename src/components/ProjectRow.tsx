import { memo, useRef, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Project } from '@/lib/types'
import { upcomingTodos, useStore } from '@/lib/store'
import { today } from '@/lib/date'
import { isSubmitEnter } from '@/lib/keyboard'
import { cn } from '@/lib/cn'
import { Checkbox } from './Checkbox'
import { DateButton } from './DateButton'
import { ProgressPie } from './ProgressPie'

interface Props {
  project: Project
  /** Receives the project so Dashboard can pass one stable callback to all rows. */
  onEdit: (p: Project) => void
  /** When true, todos can be dragged into the task list above. */
  draggableTodos?: boolean
  /** Archived list: quieter text, no expand. */
  dimmed?: boolean
}

/**
 * 项目列表的一行：进度饼、标题、未完成数；展开后列出未完成待办，
 * 可勾选、改日期、快速添加，也可拖到上方任务列表。
 */
export const ProjectRow = memo(function ProjectRow({
  project,
  onEdit,
  draggableTodos = false,
  dimmed = false,
}: Props) {
  const toggleTodoDone = useStore((s) => s.toggleTodoDone)
  const updateTodo = useStore((s) => s.updateTodo)
  const addTodo = useStore((s) => s.addTodo)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  // Hidden date input used to pop the native picker right after a quick-add,
  // and the id of the todo that picker should write its chosen date back to.
  const newDateRef = useRef<HTMLInputElement>(null)
  const pendingDateIdRef = useRef<string | null>(null)
  // Guards against a double insert: pressing Enter commits and then unmounts the
  // <input>, whose blur would otherwise fire commitDraft again from the stale
  // `draft` closure. Reset each time the quick-add input is (re)opened.
  const committedRef = useRef(false)

  const openAdd = () => {
    committedRef.current = false
    setAdding(true)
  }

  /**
   * Create the drafted todo (store default: due today, current stage). Returns
   * the new todo's id, or null when the draft was blank or already committed.
   */
  const commitDraft = (): string | null => {
    if (committedRef.current) return null
    const title = draft.trim()
    setDraft('')
    // Latch only when a real todo is actually inserted: a blank Enter must not
    // stick the guard, or the next real title would be silently dropped.
    if (!title) return null
    committedRef.current = true
    return addTodo(project.id, { title })
  }

  /** Commit the draft, then pop the date picker so a real deadline gets set. */
  const commitAndPickDate = () => {
    const id = commitDraft()
    if (!id) return
    pendingDateIdRef.current = id
    setAdding(false)
    const el = newDateRef.current
    if (!el) return
    el.value = today()
    try {
      if (el.showPicker) el.showPicker()
      else el.focus()
    } catch {
      el.focus()
    }
  }

  const t = today()
  const total = project.todos.length
  const done = project.todos.filter((x) => x.done).length
  const remaining = total - done
  const todos = open ? upcomingTodos(project, remaining) : []
  const title = project.title || '未命名项目'

  return (
    <li className={cn(dimmed && 'opacity-70')}>
      <div className="group flex items-center gap-1 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-hover">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? `收起「${title}」的待办` : `展开「${title}」的待办`}
          disabled={dimmed}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:invisible"
        >
          <ChevronRight
            size={14}
            strokeWidth={2.4}
            className={cn('transition-transform duration-200', open && 'rotate-90')}
          />
        </button>
        <button
          type="button"
          onClick={() => onEdit(project)}
          className="flex min-w-0 flex-1 cursor-default items-center gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ProgressPie color={project.color} value={total ? done / total : 0} />
          <span className="truncate text-[14px] leading-6 text-foreground">{title}</span>
        </button>
        {remaining > 0 ? (
          <span className="shrink-0 text-xs tabular-nums text-faint" title="未完成待办">
            {remaining}
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="pb-3 pl-[30px] pr-2">
          {todos.length ? (
            <ul>
              {todos.map((todo) => {
                return (
                  <li
                    key={todo.id}
                    draggable={draggableTodos || undefined}
                    onDragStart={
                      draggableTodos
                        ? (e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            const payload = JSON.stringify({
                              projectId: project.id,
                              todoId: todo.id,
                            })
                            e.dataTransfer.setData('application/x-rt-todo', payload)
                            e.dataTransfer.setData('text/plain', payload)
                          }
                        : undefined
                    }
                    title={draggableTodos ? '拖到上方任务列表，加入近期重点并设为该优先级' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-1.5 py-1 text-[13px] hover:bg-hover',
                      draggableTodos && 'cursor-grab active:cursor-grabbing',
                    )}
                  >
                    <Checkbox
                      checked={false}
                      onChange={() => toggleTodoDone(project.id, todo.id)}
                      label={`标记「${todo.title}」为已完成`}
                    />
                    <span className="min-w-0 flex-1 truncate text-secondary-foreground">
                      {todo.title || <span className="italic text-faint">未命名</span>}
                    </span>
                    <DateButton
                      value={todo.endDate}
                      todayIso={t}
                      onChange={(d) => updateTodo(project.id, todo.id, { endDate: d })}
                    />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-1.5 py-1 text-xs text-faint">
              {total ? '所有待办已完成' : '还没有待办'}
            </p>
          )}

          <div className="relative mt-0.5">
            {adding ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitEnter(e)) {
                    commitAndPickDate()
                  } else if (e.key === 'Escape') {
                    committedRef.current = true // discard: block a racing blur-commit
                    setDraft('')
                    setAdding(false)
                  }
                }}
                onBlur={() => {
                  commitDraft()
                  setAdding(false)
                }}
                placeholder="待办标题，回车添加并选日期，Esc 取消"
                aria-label={`为「${title}」添加待办`}
                className="h-7 w-full rounded-md bg-muted px-2 text-[13px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-7 items-center gap-2 rounded-md px-1.5 text-[13px] text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus size={14} /> 添加待办
              </button>
            )}
            {/* Anchors the picker popped by commitAndPickDate; never shown itself. */}
            <input
              ref={newDateRef}
              type="date"
              onChange={(e) => {
                const id = pendingDateIdRef.current
                pendingDateIdRef.current = null
                if (id && e.target.value) {
                  updateTodo(project.id, id, { endDate: e.target.value })
                }
              }}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-2 h-0 w-0 opacity-0"
            />
          </div>
        </div>
      ) : null}
    </li>
  )
})
