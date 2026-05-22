import { CalendarClock, Users, Check } from 'lucide-react'
import type { Project } from '@/lib/types'
import { STAGE_BY_VALUE } from '@/lib/types'
import { nextDeadline, upcomingMilestones, useStore } from '@/lib/store'
import { countdownLabel, daysUntil, fmtShort, today } from '@/lib/date'
import { Card } from './ui/Card'
import { StageBadge } from './StageBadge'
import { cn } from '@/lib/cn'

interface Props {
  project: Project
  onEdit: () => void
}

export function ProjectCard({ project, onEdit }: Props) {
  const toggleMilestoneDone = useStore((s) => s.toggleMilestoneDone)
  const nd = nextDeadline(project)
  const days = nd ? daysUntil(nd.date) : null
  const cd = days == null ? null : countdownLabel(days)
  const waiting = project.collaborators.filter((c) => c.waitingFor.trim())
  const total = project.milestones.length
  const done = project.milestones.filter((m) => m.done).length
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
  const upcoming = upcomingMilestones(project, 3)
  const t = today()

  return (
    <Card
      onClick={onEdit}
      className="group flex cursor-pointer flex-col p-4 transition hover:border-neutral-300 hover:shadow-md dark:hover:border-neutral-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {project.title}
          </h3>
          {project.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
              {project.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StageBadge stage={project.stage} />
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
          <span>里程碑</span>
          <span>
            {done}/{total}
          </span>
        </div>
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-neutral-900 transition-all dark:bg-neutral-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {upcoming.length > 0 ? (
          <ul className="space-y-1">
            {upcoming.map((m) => {
              const overdue = m.endDate < t
              const stage = STAGE_BY_VALUE[m.stage ?? project.stage]
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-2 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => toggleMilestoneDone(project.id, m.id)}
                    className={cn(
                      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      'border-neutral-300 text-transparent hover:border-neutral-500 hover:text-neutral-400',
                      'dark:border-neutral-600 dark:hover:border-neutral-400',
                    )}
                    aria-label={`标记「${m.title}」为已完成`}
                  >
                    <Check size={10} />
                  </button>
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `var(${stage.colorVar})` }}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300',
                    )}
                  >
                    {m.title || <span className="italic text-neutral-400">未命名</span>}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      overdue
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'text-neutral-500 dark:text-neutral-500',
                    )}
                  >
                    {fmtShort(m.endDate)}
                  </span>
                </li>
              )
            })}
            {project.milestones.filter((m) => !m.done).length > upcoming.length ? (
              <li className="text-[11px] text-neutral-400">
                还有 {project.milestones.filter((m) => !m.done).length - upcoming.length} 个未完成…
              </li>
            ) : null}
          </ul>
        ) : total > 0 ? (
          <p className="text-[11px] text-neutral-400">所有里程碑已完成 🎉</p>
        ) : (
          <p className="text-[11px] text-neutral-400">还没有里程碑</p>
        )}
      </div>

      {waiting.length > 0 ? (
        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-yellow-50 px-2.5 py-2 text-xs text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
          <Users size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            {waiting.map((c, i) => (
              <div key={c.id} className={i > 0 ? 'mt-0.5' : undefined}>
                <span className="font-medium">{c.name}</span>
                <span className="text-yellow-700/70 dark:text-yellow-300/70">
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
