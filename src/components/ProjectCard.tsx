import { memo, useRef, useState, type CSSProperties } from 'react'
import { CalendarClock, Users, Check, GripVertical, Plus, ChevronDown } from 'lucide-react'
import type { Project } from '@/lib/types'
import { findStage } from '@/lib/types'
import { nextDeadline, stageProgress, upcomingTodos, useStore } from '@/lib/store'
import { countdownLabel, daysUntil, fmtShort, today } from '@/lib/date'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { StageBadge } from './StageBadge'
import { StageChip } from './StageChip'
import { cn } from '@/lib/cn'

/** How many upcoming todos a collapsed card shows before the expand toggle. */
const VISIBLE_TODOS = 3

interface Props {
  project: Project
  /** Receives the project so Dashboard can pass one stable callback to all cards. */
  onEdit: (p: Project) => void
  /** When true, upcoming todos can be dragged into 本周重点. */
  draggableTodos?: boolean
  /** Desaturate the whole card — used for the archived projects grid. */
  dimmed?: boolean
}

export const ProjectCard = memo(function ProjectCard({
  project,
  onEdit,
  draggableTodos = false,
  dimmed = false,
}: Props) {
  const toggleTodoDone = useStore((s) => s.toggleTodoDone)
  const updateTodo = useStore((s) => s.updateTodo)
  const addTodo = useStore((s) => s.addTodo)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  // Reveal every incomplete todo (not just the nearest 3) so further-out ones
  // can also be dragged into 本周重点.
  const [expanded, setExpanded] = useState(false)
  // Hidden date input used to pop the native picker right after a quick-add,
  // and the id of the todo that picker should write its chosen date back to.
  const newDateRef = useRef<HTMLInputElement>(null)
  const pendingDateIdRef = useRef<string | null>(null)
  // Guards against a double insert: pressing Enter commits and then unmounts the
  // <Input>, whose blur would otherwise fire commitDraft again from the stale
  // `draft` closure. Reset each time the quick-add input is (re)opened.
  const committedRef = useRef(false)

  const openAdd = () => {
    committedRef.current = false
    setAdding(true)
  }

  /**
   * Create the drafted todo (store default: due today, current stage). Returns
   * the new todo's id, or null when the draft was blank or already committed.
   * Idempotent within one open→commit cycle.
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

  /**
   * Commit the draft, then immediately pop the date picker so the user sets a
   * real deadline instead of silently keeping the default (today).
   */
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
  const nd = nextDeadline(project)
  const days = nd ? daysUntil(nd.date) : null
  const cd = days == null ? null : countdownLabel(days)
  const toneCls =
    cd?.tone === 'past'
      ? 'text-destructive'
      : cd?.tone === 'urgent'
        ? 'text-warn'
        : cd?.tone === 'soon'
          ? 'text-warn/80'
          : 'text-muted-foreground'
  const waiting = project.collaborators.filter((c) => c.waitingFor.trim())
  const sp = stageProgress(project)
  const currentStage = findStage(project.stages, project.stage)
  const t = today()
  const doneCount = project.todos.filter((x) => x.done).length
  const totalCount = project.todos.length
  const remainingCount = totalCount - doneCount
  const upcoming = upcomingTodos(project, expanded ? remainingCount : VISIBLE_TODOS)

  return (
    // Border/bg + hover border come from .proj-card (project-hue tint).
    <Card
      onClick={() => onEdit(project)}
      style={{ '--proj': project.color } as CSSProperties}
      className={cn(
        'proj-card group flex cursor-pointer flex-col p-3.5 transition',
        dimmed && 'opacity-60 saturate-50 hover:opacity-90 transition',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(project)
              }}
              className="block w-full truncate rounded text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {project.title || <span className="italic text-faint">未命名项目</span>}
            </button>
          </h3>
          {project.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StageBadge stage={currentStage} />
        {project.venue ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {project.venue.name}
          </span>
        ) : null}
      </div>

      {nd && cd ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
          <CalendarClock size={13} className={toneCls} />
          <span className={cn('mono', toneCls)}>{cd.text}</span>
          <span className="text-faint">· {nd.label} · {fmtShort(nd.date)}</span>
        </div>
      ) : null}

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-faint">
          <span>研究阶段</span>
          <span>
            <span className="text-secondary-foreground">{currentStage.shortLabel || currentStage.name}</span>
            <span className="ml-1.5 tabular-nums text-faint">
              {sp.current}/{sp.total}
            </span>
          </span>
        </div>
        {/* Translucent track so it reads correctly on the project-tinted card. */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${sp.percent}%`, background: currentStage.color }}
          />
        </div>

        <div className="mb-1 flex items-center justify-between text-[11px] text-faint">
          <span>待办</span>
          <span className="tabular-nums">
            {doneCount}/{totalCount}
          </span>
        </div>
        {upcoming.length > 0 ? (
          <ul className="space-y-1">
            {upcoming.map((todo) => {
              const overdue = !!todo.endDate && todo.endDate < t
              const stage = findStage(project.stages, todo.stage)
              return (
                <li
                  key={todo.id}
                  draggable={draggableTodos || undefined}
                  onDragStart={
                    draggableTodos
                      ? (e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData(
                            'application/x-rt-todo',
                            JSON.stringify({ projectId: project.id, todoId: todo.id }),
                          )
                        }
                      : undefined
                  }
                  title={draggableTodos ? '拖到「本周重点」即可本周处理' : undefined}
                  className={cn(
                    'group/todo flex items-center gap-2 text-xs',
                    draggableTodos && 'cursor-grab active:cursor-grabbing',
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {draggableTodos ? (
                    <GripVertical
                      size={11}
                      aria-hidden
                      className="shrink-0 text-faint opacity-0 transition group-hover/todo:opacity-100"
                    />
                  ) : null}
                  <button
                    onClick={() => toggleTodoDone(project.id, todo.id)}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3.5px] border border-[#3a3e4d] text-transparent hover:border-brand-400 hover:text-brand-400"
                    aria-label={`标记「${todo.title}」为已完成`}
                  >
                    <Check size={10} />
                  </button>
                  <StageChip stage={stage} />
                  <span className="min-w-0 flex-1 truncate text-secondary-foreground">
                    {todo.title || <span className="italic text-faint">未命名</span>}
                  </span>
                  <TodoDateButton
                    value={todo.endDate}
                    overdue={overdue}
                    onChange={(d) => updateTodo(project.id, todo.id, { endDate: d })}
                  />
                </li>
              )
            })}
            {remainingCount > VISIBLE_TODOS ? (
              <li>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded((v) => !v)
                  }}
                  aria-expanded={expanded}
                  className="inline-flex items-center gap-0.5 rounded text-[11px] text-faint transition hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {expanded ? '收起' : `还有 ${remainingCount - upcoming.length} 个未完成…`}
                  <ChevronDown
                    size={11}
                    className={cn('transition-transform', expanded && 'rotate-180')}
                  />
                </button>
              </li>
            ) : null}
          </ul>
        ) : project.todos.length > 0 ? (
          <p className="text-[11px] text-faint">所有待办已完成 🎉</p>
        ) : (
          <p className="text-[11px] text-faint">还没有待办</p>
        )}

        <div className="relative mt-1.5" onClick={(e) => e.stopPropagation()}>
          {adding ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Add the todo, then pop the date picker to set its deadline.
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
              placeholder="待办标题 · 回车添加并选日期，Esc 取消"
              aria-label={`为「${project.title || '未命名项目'}」添加待办`}
              className="h-7 px-2 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1 rounded text-xs text-faint transition hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Plus size={12} /> 添加待办
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

      {waiting.length > 0 ? (
        <div className="mt-3 flex items-start gap-1.5 rounded-md border border-warn/25 bg-warn/[0.07] px-2.5 py-2 text-[11px] text-warn">
          <Users size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            {waiting.map((c, i) => (
              <div key={c.id} className={i > 0 ? 'mt-0.5' : undefined}>
                <span className="font-medium">{c.name}</span>
                <span className="text-warn/70">
                  {' '}
                  · 等 {c.waitingFor}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  )
})

/**
 * The todo's due date, editable inline from the overview card. Shows the
 * formatted date; clicking it opens the native date picker so the deadline can
 * be changed without opening the project dialog.
 */
function TodoDateButton({
  value,
  overdue,
  onChange,
}: {
  value: string
  overdue: boolean
  onChange: (date: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = ref.current
    if (el?.showPicker) el.showPicker()
    else el?.focus()
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={openPicker}
        title="点击修改截止日期"
        aria-label={`修改截止日期，当前 ${fmtShort(value) || '未设置'}`}
        className={cn(
          'mono cursor-pointer rounded text-[11px] underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          overdue
            ? 'text-destructive'
            : 'text-muted-foreground hover:text-brand-300',
        )}
      >
        {fmtShort(value) || '设置日期'}
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        // Native picker reports '' on clear; ignore so a todo always keeps a date.
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </span>
  )
}
