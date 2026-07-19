import { useMemo, useState } from 'react'
import { addDays, addMonths, addWeeks, format, startOfMonth } from 'date-fns'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { weekStart, fmtMinutes, parse, today } from '@/lib/date'
import {
  allTimeSummary,
  buildPeriodStats,
  dayKey,
  heatmapWeeks,
  streakDays,
  type ResolvedSession,
} from '@/lib/focus'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import type { Project } from '@/lib/types'
import { Container } from './ui/Container'
import { Button } from './ui/Button'
import { FocusBars } from './FocusBars'
import { DayDetail } from './DayDetail'
import { FocusStats } from './FocusStats'

/** Trailing window of the contribution heatmap, in weeks (~4 months). */
const HEATMAP_WEEKS = 16

type Scope = 'week' | 'month'

/**
 * 时间回顾 — per-day focus bars for the viewed period (click a bar to drill into
 * that day), the selected day's detail, then the aggregate stats. Weeks start
 * Monday app-wide; 周/月 switches every section at once.
 */
export function Review({ onGoBoard }: { onGoBoard: () => void }) {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const removeSession = useStore((s) => s.removeSession)
  const undo = useStore((s) => s.undo)

  const [scope, setScope] = useState<Scope>('week')
  // Any day inside the period being viewed; nav moves it by week or month.
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const now = new Date()
  const todayIso = today()
  const isWeek = scope === 'week'

  const start = isWeek ? weekStart(anchor) : startOfMonth(anchor)
  const end = isWeek ? addDays(start, 7) : addMonths(start, 1)
  const prevStart = isWeek ? addDays(start, -7) : addMonths(start, -1)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const prevStartMs = prevStart.getTime()
  const isCurrentPeriod = now >= start && now < end

  const projectById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  const stats = useMemo(
    () =>
      buildPeriodStats({
        sessions,
        projectById,
        start,
        end,
        prevStart,
        prevEnd: start,
        now,
      }),
    // The ms bounds pin `start`/`end`/`prevStart`, and `todayIso` pins `now` —
    // those Date objects are new every render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, projectById, startMs, endMs, prevStartMs, todayIso],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streak = useMemo(() => streakDays(sessions, now), [sessions, todayIso])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heat = useMemo(() => heatmapWeeks(sessions, HEATMAP_WEEKS, now), [sessions, todayIso])
  const allTime = useMemo(() => allTimeSummary(sessions), [sessions])

  /** Today when it's in view, else the period's best day, else its first day. */
  const defaultIso = () => {
    if (stats.days.some((d) => d.iso === todayIso)) return todayIso
    return stats.best?.iso ?? stats.days[0]?.iso ?? todayIso
  }

  // Re-pick the selected day whenever the period changes — done during render
  // (not in an effect) so the detail below never paints a stale day first.
  const rangeKey = `${scope}:${format(start, 'yyyy-MM-dd')}`
  const [selectedIso, setSelectedIso] = useState(defaultIso)
  const [prevRangeKey, setPrevRangeKey] = useState(rangeKey)
  if (rangeKey !== prevRangeKey) {
    setPrevRangeKey(rangeKey)
    setSelectedIso(defaultIso())
  }

  const selectedDay = stats.days.find((d) => d.iso === selectedIso)
  const selectedDate = selectedDay?.date ?? parse(selectedIso) ?? now
  const selectedRows: ResolvedSession[] = stats.resolved.filter(
    (r) => dayKey(r.session.startedAt) === selectedIso,
  )

  const periodLabel = isWeek
    ? `${format(start, 'M月d日')} – ${format(addDays(start, 6), 'M月d日')}`
    : format(start, 'yyyy年M月')
  const periodWord = isWeek ? (isCurrentPeriod ? '本周' : '当周') : format(start, 'M月')

  const onRemove = (r: ResolvedSession) => {
    const token = removeSession(r.session.id)
    toast({
      message: `已删除专注记录「${r.label}」`,
      action: { label: '撤销', onClick: () => undo(token) },
    })
  }

  return (
    <Container className="py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            时间回顾
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {stats.count > 0
              ? `${periodWord}专注 ${fmtMinutes(stats.minutes)} · ${stats.count} 次`
              : `${periodWord}还没有专注记录`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900"
            role="tablist"
            aria-label="统计范围"
          >
            {(['week', 'month'] as const).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  scope === s
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-neutral-800 dark:text-brand-300'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
                )}
              >
                {s === 'week' ? '周' : '月'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAnchor((a) => (isWeek ? addWeeks(a, -1) : addMonths(a, -1)))}
              aria-label={isWeek ? '上一周' : '上个月'}
              title={isWeek ? '上一周' : '上个月'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[9.5rem] text-center text-sm tabular-nums text-neutral-700 dark:text-neutral-300">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => setAnchor((a) => (isWeek ? addWeeks(a, 1) : addMonths(a, 1)))}
              aria-label={isWeek ? '下一周' : '下个月'}
              title={isWeek ? '下一周' : '下个月'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <ChevronRight size={16} />
            </button>
            {!isCurrentPeriod ? (
              <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
                {isWeek ? '本周' : '本月'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
          <CalendarClock size={28} className="mx-auto mb-3 text-neutral-400" />
          <p className="text-sm text-neutral-600 dark:text-neutral-300">还没有专注记录</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
            在「总览」的任务卡片上右键，即可开始 30 或 60 分钟倒计时；完成的专注会按天落在这里，点柱子就能回看那一天的时间去了哪里。
          </p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={onGoBoard}>
            去总览开始专注
          </Button>
        </div>
      ) : (
        <>
          <FocusBars
            days={stats.days}
            selectedIso={selectedIso}
            onSelect={setSelectedIso}
            todayIso={todayIso}
            scope={scope}
          />

          <DayDetail
            date={selectedDate}
            iso={selectedIso}
            todayIso={todayIso}
            rows={selectedRows}
            onRemove={onRemove}
          />

          <FocusStats
            stats={stats}
            totalLabel={`${periodWord}专注`}
            deltaLabel={isWeek ? '较上周' : '较上月'}
            centerLabel={periodWord}
            streak={streak}
            heat={heat}
            allTime={allTime}
          />
        </>
      )}
    </Container>
  )
}
