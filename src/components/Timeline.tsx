import { useMemo, useRef, useEffect } from 'react'
import { addMonths, differenceInCalendarDays, format, startOfMonth } from 'date-fns'
import { useStore } from '@/lib/store'
import { monthGrid, parse, today } from '@/lib/date'
import { STAGE_BY_VALUE, type Project } from '@/lib/types'
import { Card } from './ui/Card'
import { cn } from '@/lib/cn'

const DAY_WIDTH = 6 // px per day
const ROW_HEIGHT = 56 // px per project row

interface Props {
  onEdit: (p: Project) => void
}

export function Timeline({ onEdit }: Props) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived)
  const scrollRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => {
    const dates: string[] = []
    for (const p of projects) {
      dates.push(p.startDate)
      if (p.venue?.deadline) dates.push(p.venue.deadline)
      if (p.venue?.rebuttalAt) dates.push(p.venue.rebuttalAt)
      for (const m of p.milestones) {
        dates.push(m.startDate, m.endDate)
      }
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

  if (projects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
          还没有项目，去「项目总览」新建一个吧。
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">时间线</h2>
        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          每行一个项目；色块是里程碑，红线是今天，▲ 是投稿截止，◆ 是 rebuttal。
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex">
          {/* Left frozen column: project labels */}
          <div className="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800">
            <div className="h-10 border-b border-neutral-200 bg-neutral-50 px-3 text-xs font-medium leading-10 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              项目
            </div>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onEdit(p)}
                style={{ height: ROW_HEIGHT }}
                className="flex w-full flex-col justify-center border-b border-neutral-100 px-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {p.title}
                </div>
                <div className="truncate text-[11px] text-neutral-500">
                  {STAGE_BY_VALUE[p.stage].label}
                  {p.venue ? ` · ${p.venue.name}` : ''}
                </div>
              </button>
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
                {/* Month gridlines */}
                {grid.months.map((m, i) => {
                  const offset = differenceInCalendarDays(startOfMonth(m), grid.start) * DAY_WIDTH
                  return (
                    <div
                      key={`gl-${i}`}
                      className="absolute top-0 bottom-0 w-px bg-neutral-100 dark:bg-neutral-800"
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
                    onEdit={() => onEdit(p)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Legend />
    </div>
  )
}

interface RowProps {
  project: Project
  dayOffset: (iso: string) => number | null
  onEdit: () => void
}

function ProjectRow({ project, dayOffset, onEdit }: RowProps) {
  const todayIso = today()

  return (
    <div
      className="relative border-b border-neutral-100 dark:border-neutral-800"
      style={{ height: ROW_HEIGHT }}
    >
      {project.milestones.map((m) => {
        const startOff = dayOffset(m.startDate)
        const endOff = dayOffset(m.endDate)
        if (startOff == null || endOff == null) return null
        const width = Math.max(1, (endOff - startOff + 1) * DAY_WIDTH)
        const isPastNotDone = !m.done && m.endDate < todayIso
        const milestoneStage = STAGE_BY_VALUE[m.stage ?? project.stage]
        return (
          <div
            key={m.id}
            onClick={onEdit}
            title={`${m.title} · ${m.startDate} → ${m.endDate}${m.done ? ' (已完成)' : ''}`}
            className={cn(
              'absolute flex h-7 cursor-pointer items-center overflow-hidden rounded px-1.5 text-[11px] font-medium text-white shadow-sm transition hover:opacity-90',
              m.done && 'opacity-60',
              isPastNotDone && 'ring-2 ring-red-500',
            )}
            style={{
              left: startOff * DAY_WIDTH,
              width,
              top: 14,
              background: `var(${milestoneStage.colorVar})`,
            }}
          >
            <span className="truncate">{m.title}</span>
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
                className="absolute z-10 -translate-x-1/2 cursor-pointer text-red-600"
                style={{ left: off * DAY_WIDTH, top: 4 }}
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
                className="absolute z-10 -translate-x-1/2 cursor-pointer text-amber-600"
                style={{ left: off * DAY_WIDTH, top: 4 }}
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
        <span className="inline-block h-3 w-5 rounded" style={{ background: 'var(--color-stage-data)' }} />
        里程碑色块（按阶段着色）
      </span>
      <span className="inline-flex items-center gap-1 text-red-600">▲ 投稿截止</span>
      <span className="inline-flex items-center gap-1 text-amber-600">◆ Rebuttal</span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-0.5 bg-red-500" /> 今天
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded ring-2 ring-red-500" />
        逾期未完成
      </span>
    </div>
  )
}
