import { useMemo, useState } from 'react'
import { addDays, addMonths, addWeeks, format, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react'
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
      }),
    // The ms bounds pin `start`/`end`/`prevStart`; those Date objects are new
    // every render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, projectById, startMs, endMs, prevStartMs],
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

  const pct =
    stats.prevMinutes > 0
      ? Math.round(((stats.minutes - stats.prevMinutes) / stats.prevMinutes) * 100)
      : 0
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
    <main className="mx-auto w-full max-w-[60rem] px-4 pb-24 pt-6 sm:px-8 lg:pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.01em]">
            <Timer size={26} strokeWidth={2.2} className="text-success" aria-hidden />
            专注回顾
          </h1>
          <p className="mt-1.5 pl-[36px] text-[13px] text-muted-foreground">
            {stats.count > 0
              ? [
                  `${periodWord}专注 ${fmtMinutes(stats.minutes)} · ${stats.count} 次`,
                  stats.prevMinutes > 0
                    ? `${isWeek ? '较上周' : '较上月'} ${pct > 0 ? '+' : ''}${pct}%`
                    : null,
                  streak.current > 0 ? `连续 ${streak.current} 天` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `${periodWord}还没有专注记录`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div
            className="inline-flex h-8 rounded-md bg-muted p-0.5"
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
                  'rounded-[5px] px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  scope === s
                    ? 'bg-input font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.3)]'
                    : 'text-muted-foreground hover:text-foreground',
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[9.5rem] text-center mono text-[13px] text-secondary-foreground">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => setAnchor((a) => (isWeek ? addWeeks(a, 1) : addMonths(a, 1)))}
              aria-label={isWeek ? '下一周' : '下个月'}
              title={isWeek ? '下一周' : '下个月'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="mt-12 flex flex-col items-center py-6 text-center">
          <Timer size={40} strokeWidth={1.5} className="text-input" aria-hidden />
          <p className="mt-4 text-[15px] font-medium">还没有专注记录</p>
          <p className="mt-1 max-w-sm text-[13px] leading-6 text-muted-foreground">
            把鼠标移到任务上，点计时图标开始一段专注；也可以从右上角开始不挂任务的专注。
          </p>
          <Button className="mt-5" onClick={onGoBoard}>
            去任务列表
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
            centerLabel={periodWord}
            heat={heat}
            allTime={allTime}
          />
        </>
      )}
    </main>
  )
}
