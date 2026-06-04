import { useMemo } from 'react'
import { CalendarRange, Check, CheckCircle2 } from 'lucide-react'
import {
  useStore,
  weekItems,
  weekDoneItems,
  type WeekItem,
} from '@/lib/store'
import {
  findStage,
  todoPriority,
  PRIORITY_META,
  PRIORITY_ORDER,
  type Priority,
  type Project,
} from '@/lib/types'
import { thisWeek, fmtMD, weekdayLabel, daysUntil, today } from '@/lib/date'
import { cn } from '@/lib/cn'
import { PriorityButton } from './PriorityButton'
import { StageChip } from './StageChip'

interface Props {
  onEdit: (p: Project) => void
}

export function ThisWeek({ onEdit }: Props) {
  const projects = useStore((s) => s.projects)
  const updateTodo = useStore((s) => s.updateTodo)
  const toggleTodoDone = useStore((s) => s.toggleTodoDone)

  const t = today()
  // Computed every render (two cheap date-fns calls) so a tab left open across
  // a week boundary always filters by the current Mon–Sun window. The string
  // bounds are stable within a day, so the memos below stay cached.
  const week = thisWeek()

  const items = useMemo(() => weekItems(projects, week.end), [projects, week.end])
  const doneItems = useMemo(
    () => weekDoneItems(projects, week.start, week.end),
    [projects, week.start, week.end],
  )

  // One pass over the (already priority-sorted) items: bucket by priority and
  // tally high / overdue counts together instead of re-scanning three times.
  const { groups, highCount, overdueCount } = useMemo(() => {
    const byPri: Record<Priority, WeekItem[]> = { high: [], normal: [], low: [] }
    let overdue = 0
    for (const it of items) {
      byPri[todoPriority(it.todo)].push(it)
      if (it.todo.endDate < t) overdue++
    }
    return {
      groups: PRIORITY_ORDER.map((pri) => ({ pri, rows: byPri[pri] })).filter(
        (g) => g.rows.length > 0,
      ),
      highCount: byPri.high.length,
      overdueCount: overdue,
    }
  }, [items, t])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            <CalendarRange size={20} className="text-neutral-400" /> 本周聚焦
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {fmtMD(week.start)} – {fmtMD(week.end)}
            <span className="mx-2 text-neutral-300 dark:text-neutral-700">·</span>
            {items.length} 项待办
            {highCount > 0 ? (
              <>
                <span className="mx-1.5 text-neutral-300 dark:text-neutral-700">·</span>
                <span className={cn('font-medium', PRIORITY_META.high.text)}>
                  {highCount} 项主攻
                </span>
              </>
            ) : null}
            {overdueCount > 0 ? (
              <>
                <span className="mx-1.5 text-neutral-300 dark:text-neutral-700">·</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {overdueCount} 项逾期
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {items.length === 0 && doneItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <CalendarRange size={28} className="mx-auto mb-2 text-neutral-400" />
          <p className="text-sm text-neutral-500">本周没有到期的待办。</p>
          <p className="mt-1 text-xs text-neutral-400">
            在项目里给待办设置本周内的截止日期，就会出现在这里。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.pri}>
              <GroupHeader pri={g.pri} count={g.rows.length} />
              <ul className="mt-2 space-y-1.5">
                {g.rows.map((it) => (
                  <WeekRow
                    key={it.todo.id}
                    item={it}
                    todayIso={t}
                    onToggle={() => toggleTodoDone(it.project.id, it.todo.id)}
                    onPriority={(p) => updateTodo(it.project.id, it.todo.id, { priority: p })}
                    onOpen={() => onEdit(it.project)}
                  />
                ))}
              </ul>
            </section>
          ))}

          {doneItems.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <CheckCircle2 size={14} className="text-green-500" />
                本周到期 · 已完成
                <span className="tabular-nums text-neutral-400">{doneItems.length}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {doneItems.map((it) => {
                  const stage = findStage(it.project.stages, it.todo.stage)
                  return (
                    <li
                      key={it.todo.id}
                      className="flex items-center gap-2 px-2.5 py-1 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTodoDone(it.project.id, it.todo.id)}
                        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-green-500 bg-green-500 text-white"
                        aria-label={`将「${it.todo.title || '未命名'}」标记为未完成`}
                      >
                        <Check size={12} />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-neutral-400 line-through dark:text-neutral-500">
                        {it.todo.title || '未命名待办'}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                        {it.project.title} · {stage.shortLabel || stage.name}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

function GroupHeader({ pri, count }: { pri: Priority; count: number }) {
  const meta = PRIORITY_META[pri]
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-block h-2.5 w-2.5 rounded-full', meta.dot)} />
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        {meta.label}
      </h3>
      <span className="tabular-nums text-xs text-neutral-400">{count}</span>
    </div>
  )
}

function WeekRow({
  item,
  todayIso,
  onToggle,
  onPriority,
  onOpen,
}: {
  item: WeekItem
  todayIso: string
  onToggle: () => void
  onPriority: (p: Priority) => void
  onOpen: () => void
}) {
  const { project, todo } = item
  const stage = findStage(project.stages, todo.stage)
  const overdue = todo.endDate < todayIso
  const isToday = todo.endDate === todayIso
  const overdueDays = overdue ? -(daysUntil(todo.endDate) ?? 0) : 0

  return (
    // The whole row opens the project (like ProjectCard); the priority chip and
    // checkbox stop propagation so they act without also opening the editor.
    <li
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <PriorityButton priority={todoPriority(todo)} onChange={onPriority} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-neutral-300 text-transparent transition hover:border-neutral-500 hover:text-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-400"
        aria-label={`将「${todo.title || '未命名'}」标记为已完成`}
      >
        <Check size={12} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {todo.title || <span className="italic text-neutral-400">未命名待办</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="truncate">{project.title}</span>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            <StageChip stage={stage} />
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap text-xs tabular-nums',
            overdue
              ? 'font-medium text-red-600 dark:text-red-400'
              : isToday
                ? 'font-medium text-orange-600 dark:text-orange-400'
                : 'text-neutral-500 dark:text-neutral-500',
          )}
        >
          {overdue ? `逾期 ${overdueDays} 天` : isToday ? '今天' : weekdayLabel(todo.endDate)}
          <span className="ml-1.5 text-neutral-400 dark:text-neutral-600">
            {fmtMD(todo.endDate)}
          </span>
        </span>
      </div>
    </li>
  )
}
