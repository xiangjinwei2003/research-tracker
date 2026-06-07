import { CalendarClock, Users, Check } from 'lucide-react'
import type { Project } from '@/lib/types'
import { findStage } from '@/lib/types'
import { nextDeadline, stageProgress, upcomingTodos, useStore } from '@/lib/store'
import { countdownLabel, daysUntil, fmtShort, today } from '@/lib/date'
import { Card } from './ui/Card'
import { StageBadge } from './StageBadge'
import { StageChip } from './StageChip'
import { cn } from '@/lib/cn'

interface Props {
  project: Project
  onEdit: () => void
}

export function ProjectCard({ project, onEdit }: Props) {
  const toggleTodoDone = useStore((s) => s.toggleTodoDone)
  const nd = nextDeadline(project)
  const days = nd ? daysUntil(nd.date) : null
  const cd = days == null ? null : countdownLabel(days)
  const waiting = project.collaborators.filter((c) => c.waitingFor.trim())
  const sp = stageProgress(project)
  const currentStage = findStage(project.stages, project.stage)
  const upcoming = upcomingTodos(project, 3)
  const t = today()

  return (
    <Card
      onClick={onEdit}
      className="group flex cursor-pointer flex-col p-4 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="block w-full truncate rounded text-left text-base font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-100"
            >
              {project.title || <span className="italic text-neutral-400">未命名项目</span>}
            </button>
          </h3>
          {project.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
              {project.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StageBadge stage={currentStage} />
        {project.venue ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {project.venue.name}
          </span>
        ) : null}
      </div>

      {nd && cd ? (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
            cd.tone === 'past' &&
              'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
            cd.tone === 'urgent' &&
              'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300',
            cd.tone === 'soon' &&
              'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
            cd.tone === 'far' &&
              'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
          )}
        >
          <CalendarClock size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{cd.text}</span>
            <span className="ml-1.5 text-neutral-500 dark:text-neutral-500">
              · {nd.label} · {fmtShort(nd.date)}
            </span>
          </span>
        </div>
      ) : null}

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
          <span>研究阶段</span>
          <span>
            <span className="text-neutral-700 dark:text-neutral-300">{currentStage.shortLabel || currentStage.name}</span>
            <span className="ml-1.5 tabular-nums text-neutral-400">
              {sp.current}/{sp.total}
            </span>
          </span>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${sp.percent}%`, background: currentStage.color }}
          />
        </div>

        <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
          <span>待办</span>
          <span className="tabular-nums">
            {project.todos.filter((x) => x.done).length}/{project.todos.length}
          </span>
        </div>
        {upcoming.length > 0 ? (
          <ul className="space-y-1">
            {upcoming.map((todo) => {
              const overdue = todo.endDate < t
              const stage = findStage(project.stages, todo.stage)
              return (
                <li
                  key={todo.id}
                  className="flex items-center gap-2 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => toggleTodoDone(project.id, todo.id)}
                    className={cn(
                      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      'border-neutral-300 text-transparent hover:border-brand-500 hover:text-brand-500',
                      'dark:border-neutral-600 dark:hover:border-brand-500 dark:hover:text-brand-400',
                    )}
                    aria-label={`标记「${todo.title}」为已完成`}
                  >
                    <Check size={10} />
                  </button>
                  <StageChip stage={stage} />
                  <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                    {todo.title || <span className="italic text-neutral-400">未命名</span>}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      overdue
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'text-neutral-500 dark:text-neutral-500',
                    )}
                  >
                    {fmtShort(todo.endDate)}
                  </span>
                </li>
              )
            })}
            {project.todos.filter((x) => !x.done).length > upcoming.length ? (
              <li className="text-[11px] text-neutral-400">
                还有 {project.todos.filter((x) => !x.done).length - upcoming.length} 个未完成…
              </li>
            ) : null}
          </ul>
        ) : project.todos.length > 0 ? (
          <p className="text-[11px] text-neutral-400">所有待办已完成 🎉</p>
        ) : (
          <p className="text-[11px] text-neutral-400">还没有待办</p>
        )}
      </div>

      {waiting.length > 0 ? (
        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <Users size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            {waiting.map((c, i) => (
              <div key={c.id} className={i > 0 ? 'mt-0.5' : undefined}>
                <span className="font-medium">{c.name}</span>
                <span className="text-amber-700/70 dark:text-amber-300/70">
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
}
