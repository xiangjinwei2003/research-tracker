import { useMemo, useRef, useEffect, useState } from 'react'
import { addDays, addMonths, differenceInCalendarDays, format, startOfMonth } from 'date-fns'
import { nextDeadline, stageProgress, useStore } from '@/lib/store'
import { countdownLabel, daysUntil, monthGrid, parse, today } from '@/lib/date'
import { findStage, type Project, type Todo } from '@/lib/types'
import { Card } from './ui/Card'
import { Container } from './ui/Container'
import { cn } from '@/lib/cn'

const DAY_WIDTH = 6
const ROW_HEIGHT = 76
const LEFT_COL_WIDTH = 240

interface Props {
  onEdit: (p: Project) => void
}

interface DragState {
  projectId: string
  todoId: string
  startX: number
  /** ISO endDate at drag start. */
  initialEnd: string
}

export function Timeline({ onEdit }: Props) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived)
  const updateTodo = useStore((s) => s.updateTodo)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingEndRef = useRef<string | null>(null)
  // True once a drag actually moved the pointer, so the trailing synthetic
  // click (which would otherwise open the editor) can be swallowed.
  const movedRef = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const grid = useMemo(() => {
    const dates: string[] = []
    for (const p of projects) {
      dates.push(p.startDate)
      if (p.venue?.deadline) dates.push(p.venue.deadline)
      if (p.venue?.rebuttalAt) dates.push(p.venue.rebuttalAt)
      for (const t of p.todos) dates.push(t.endDate)
    }
    return monthGrid(dates)
  }, [projects])

  const totalDays = useMemo(() => {
    const last = addMonths(grid.start, grid.months.length)
    return differenceInCalendarDays(last, grid.start)
  }, [grid])

  const totalWidth = totalDays * DAY_WIDTH

  const dayOffset = (iso: string): number | null => {
    const d = parse(iso)
    if (!d) return null
    return differenceInCalendarDays(d, grid.start)
  }

  const todayOffset = differenceInCalendarDays(new Date(), grid.start)

  // Scroll so "today" is ~1/4 from the left when first mounted.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = todayOffset * DAY_WIDTH - el.clientWidth * 0.25
    el.scrollLeft = Math.max(0, target)
  }, [todayOffset])

  // Global drag listeners (drag a todo marker to reschedule its endDate)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (Math.abs(e.clientX - drag.startX) > 3) movedRef.current = true
      const deltaDays = Math.round((e.clientX - drag.startX) / DAY_WIDTH)
      const baseEnd = parse(drag.initialEnd)
      if (!baseEnd) return
      pendingEndRef.current = format(addDays(baseEnd, deltaDays), 'yyyy-MM-dd')
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          const drag2 = dragRef.current
          const end = pendingEndRef.current
          if (drag2 && end) {
            updateTodo(drag2.projectId, drag2.todoId, { endDate: end })
          }
        })
      }
    }
    const onUp = () => {
      dragRef.current = null
      pendingEndRef.current = null
      setDraggingId(null)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      document.body.classList.remove('is-dragging')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Unmount mid-drag: drop the queued frame and clear the global drag flag
      // so the cursor/interaction styles don't get stuck app-wide.
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      document.body.classList.remove('is-dragging')
    }
  }, [updateTodo])

  const startDrag = (e: React.MouseEvent, project: Project, todo: Todo) => {
    e.stopPropagation()
    e.preventDefault()
    movedRef.current = false
    dragRef.current = {
      projectId: project.id,
      todoId: todo.id,
      startX: e.clientX,
      initialEnd: todo.endDate,
    }
    setDraggingId(todo.id)
    document.body.classList.add('is-dragging')
  }

  if (projects.length === 0) {
    return (
      <Container className="py-6">
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/50">
          还没有项目，去「项目总览」新建一个吧。
        </div>
      </Container>
    )
  }

  return (
    <Container className="py-6">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">时间线</h2>
        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          灰色背景 = 已过去；圆点 = 待办（按所属阶段着色，可拖动改截止日期）；红线 = 今天；▲ 投稿截止；◆ Rebuttal。
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex">
          {/* Left frozen column: project labels + mini stats */}
          <div
            className="shrink-0 border-r border-neutral-200 dark:border-neutral-800"
            style={{ width: LEFT_COL_WIDTH }}
          >
            <div className="h-10 border-b border-neutral-200 bg-neutral-50 px-3 text-xs font-medium leading-10 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              项目
            </div>
            {projects.map((p) => (
              <LeftRow key={p.id} project={p} onClick={() => onEdit(p)} />
            ))}
          </div>

          {/* Scrollable timeline area */}
          <div ref={scrollRef} className="relative flex-1 overflow-x-auto">
            <div style={{ width: totalWidth }} className="relative">
              {/* Month header */}
              <div className="sticky top-0 z-10 flex h-10 border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                {grid.months.map((m, i) => {
                  const next = addMonths(m, 1)
                  const w = differenceInCalendarDays(next, m) * DAY_WIDTH
                  return (
                    <div
                      key={i}
                      style={{ width: w }}
                      className="border-r border-neutral-200 px-2 text-xs font-medium leading-10 text-neutral-500 dark:border-neutral-800"
                    >
                      {format(m, 'yyyy.MM')}
                    </div>
                  )
                })}
              </div>

              {/* Body */}
              <div className="relative">
                {/* Past region shading: 0 → todayOffset */}
                {todayOffset > 0 ? (
                  <div
                    className="pointer-events-none absolute top-0 left-0 z-0 bg-neutral-100/60 dark:bg-neutral-900/50"
                    style={{
                      width: Math.min(todayOffset, totalDays) * DAY_WIDTH,
                      height: ROW_HEIGHT * projects.length,
                    }}
                  />
                ) : null}

                {/* Month gridlines */}
                {grid.months.map((m, i) => {
                  const offset = differenceInCalendarDays(startOfMonth(m), grid.start) * DAY_WIDTH
                  return (
                    <div
                      key={`gl-${i}`}
                      className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-neutral-200 dark:bg-neutral-800"
                      style={{ left: offset }}
                    />
                  )
                })}

                {/* Today line */}
                {todayOffset >= 0 && todayOffset <= totalDays ? (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
                    style={{ left: todayOffset * DAY_WIDTH }}
                  >
                    <div className="absolute -top-0 -translate-y-full rounded bg-red-500 px-1 py-0.5 text-[10px] text-white">
                      {format(new Date(), 'MM-dd')}
                    </div>
                  </div>
                ) : null}

                {/* Project rows */}
                {projects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    dayOffset={dayOffset}
                    draggingId={draggingId}
                    onEdit={() => onEdit(p)}
                    onDotClick={() => {
                      // Swallow the click synthesized at the end of a drag.
                      if (movedRef.current) {
                        movedRef.current = false
                        return
                      }
                      onEdit(p)
                    }}
                    onStartDrag={(e, t) => startDrag(e, p, t)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Legend />
    </Container>
  )
}

function LeftRow({ project, onClick }: { project: Project; onClick: () => void }) {
  const nd = nextDeadline(project)
  const days = nd ? daysUntil(nd.date) : null
  const cd = days == null ? null : countdownLabel(days)
  const sp = stageProgress(project)
  const currentStage = findStage(project.stages, project.stage)

  return (
    <button
      onClick={onClick}
      style={{ height: ROW_HEIGHT }}
      className="flex w-full flex-col justify-center gap-1 border-b border-neutral-100 px-3 py-1.5 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {project.title}
        </div>
        {cd ? (
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
              cd.tone === 'past' && 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
              cd.tone === 'urgent' && 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
              cd.tone === 'soon' && 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
              cd.tone === 'far' && 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
            )}
            title={nd ? `${nd.label} · ${nd.date}` : ''}
          >
            {cd.text}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full"
            style={{ width: `${sp.percent}%`, background: currentStage.color }}
          />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-neutral-500">
          {sp.current}/{sp.total}
        </span>
      </div>
      <div className="truncate text-[11px] text-neutral-500">
        {currentStage.name}
        {project.venue ? ` · ${project.venue.name}` : ''}
      </div>
    </button>
  )
}

interface RowProps {
  project: Project
  dayOffset: (iso: string) => number | null
  draggingId: string | null
  onEdit: () => void
  /** Click handler for a todo dot; suppresses the post-drag synthetic click. */
  onDotClick: () => void
  onStartDrag: (e: React.MouseEvent, t: Todo) => void
}

const DOT_SIZE = 12

function ProjectRow({ project, dayOffset, draggingId, onEdit, onDotClick, onStartDrag }: RowProps) {
  const todayIso = today()

  return (
    <div
      className="relative border-b border-neutral-100 dark:border-neutral-800"
      style={{ height: ROW_HEIGHT }}
    >
      {project.todos.map((todo) => {
        const off = dayOffset(todo.endDate)
        if (off == null) return null
        const isPastNotDone = !todo.done && todo.endDate < todayIso
        const stage = findStage(project.stages, todo.stage)
        const isDragging = draggingId === todo.id
        const top = (ROW_HEIGHT - DOT_SIZE) / 2 + 4
        return (
          <div
            key={todo.id}
            onClick={onDotClick}
            onMouseDown={(e) => onStartDrag(e, todo)}
            title={`${todo.title || '未命名'} · ${todo.endDate}${todo.done ? ' (已完成)' : ''}`}
            className={cn(
              'group absolute z-10 flex items-center gap-1.5 cursor-grab active:cursor-grabbing',
              isDragging && 'z-20',
            )}
            style={{ left: off * DAY_WIDTH - DOT_SIZE / 2, top }}
          >
            <span
              className={cn(
                'inline-block rounded-full ring-2 ring-white shadow-sm transition dark:ring-neutral-900',
                todo.done && 'opacity-50',
                isPastNotDone && 'ring-red-500 ring-offset-1 dark:ring-red-500',
                isDragging && 'scale-125 ring-brand-400',
              )}
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                background: stage.color,
              }}
            />
            <span
              className={cn(
                'pointer-events-none whitespace-nowrap rounded bg-white/85 px-1 text-[10px] font-medium text-neutral-800 shadow-sm dark:bg-neutral-800/85 dark:text-neutral-200',
                todo.done && 'opacity-50 line-through',
              )}
            >
              {todo.title || '未命名'}
            </span>
          </div>
        )
      })}

      {/* Deadline marker */}
      {project.venue?.deadline
        ? (() => {
            const off = dayOffset(project.venue.deadline)
            if (off == null) return null
            return (
              <div
                onClick={onEdit}
                title={`${project.venue.name} 投稿截止 · ${project.venue.deadline}`}
                className="absolute z-10 -translate-x-1/2 cursor-pointer text-red-600 drop-shadow"
                style={{ left: off * DAY_WIDTH, top: 8 }}
              >
                <span className="block text-[14px] leading-none">▲</span>
              </div>
            )
          })()
        : null}

      {/* Rebuttal marker */}
      {project.venue?.rebuttalAt
        ? (() => {
            const off = dayOffset(project.venue.rebuttalAt)
            if (off == null) return null
            return (
              <div
                onClick={onEdit}
                title={`${project.venue.name} rebuttal · ${project.venue.rebuttalAt}`}
                className="absolute z-10 -translate-x-1/2 cursor-pointer text-amber-600 drop-shadow"
                style={{ left: off * DAY_WIDTH, top: 8 }}
              >
                <span className="block text-[14px] leading-none">◆</span>
              </div>
            )
          })()
        : null}
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-5 rounded bg-neutral-200 dark:bg-neutral-800" />
        过去（已发生）
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block h-3 w-3 rounded-full ring-2 ring-white dark:ring-neutral-900"
          style={{
            background:
              'linear-gradient(135deg, oklch(0.78 0.10 250), oklch(0.78 0.10 150), oklch(0.80 0.10 100))',
          }}
        />
        待办（按所属阶段着色）
      </span>
      <span className="inline-flex items-center gap-1 text-red-600">▲ 投稿截止</span>
      <span className="inline-flex items-center gap-1 text-amber-600">◆ Rebuttal</span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-0.5 bg-red-500" /> 今天
      </span>
      <span className="inline-flex items-center gap-1 text-neutral-400">·  待办圆点可拖动调整截止日期</span>
    </div>
  )
}
