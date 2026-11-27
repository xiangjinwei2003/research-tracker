import { useMemo, useState } from 'react'
import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react'
import { useStore } from '@/lib/store'
import { fmtMinutes, weekStart, parse, splitMinutes, today } from '@/lib/date'
import {
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
import { AllocationCard, HourCard, RhythmCard } from './FocusStats'
import { Widget, WidgetNumber } from './Widget'
import { PageHeader } from './PageHeader'
import { ManualSessionDialog } from './ManualSessionDialog'

/** Trailing window of the contribution heatmap, in weeks (~4 months). */
const HEATMAP_WEEKS = 16

type Scope = 'week' | 'month'

/**
 * 专注回顾。顶部是本期总时长和按项目堆叠的逐日柱状图（点柱子选日），
 * 下面左侧是按项目和任务的时间分配，右侧是选中那天的记录，再往下是时段分布、
 * 连续天数与热力图。一周从周一开始；周和月的切换作用于除连续天数外的所有卡片。
 */
export function Review({ onGoBoard }: { onGoBoard: () => void }) {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const removeSession = useStore((s) => s.removeSession)
  const undo = useStore((s) => s.undo)

  const [scope, setScope] = useState<Scope>('week')
  // Any day inside the period being viewed; nav moves it by week or month.
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [manualDate, setManualDate] = useState<string | null>(null)

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
  // 本期还没过完时，与上一期相同天数比较（本周已过 2 天就比上周一、周二），整期对整期会偏低。
  const prevEnd = isCurrentPeriod
    ? addDays(prevStart, differenceInCalendarDays(now, start) + 1)
    : start
  const prevEndMs = prevEnd.getTime()

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
        prevEnd,
        now,
      }),
    // The ms bounds pin `start`/`end`/`prevStart`/`prevEnd`; those Date objects are new
    // every render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, projectById, startMs, endMs, prevStartMs, prevEndMs, todayIso],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streak = useMemo(() => streakDays(sessions, now), [sessions, todayIso])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heat = useMemo(() => heatmapWeeks(sessions, HEATMAP_WEEKS, now), [sessions, todayIso])

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
  const total = splitMinutes(stats.minutes)
  const prevWord = (isWeek ? '较上周' : '较上月') + (isCurrentPeriod ? '同期' : '')
  const summary = [
    stats.prevMinutes > 0 ? `${prevWord} ${pct > 0 ? '+' : ''}${pct}%` : null,
    stats.elapsedDays > 0 ? `日均 ${fmtMinutes(Math.round(stats.minutes / stats.elapsedDays))}` : null,
    `${stats.count} 次`,
  ].filter(Boolean)
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
    <main className="mx-auto w-full max-w-[66rem] px-4 pb-24 pt-2 sm:px-6 lg:pt-4">
      <div className="mb-6">
        <PageHeader
          icon={Timer}
          tint="text-success"
          title="专注回顾"
          actions={
            sessions.length === 0 ? undefined : (
            <>
              <div
                className="inline-flex h-8 rounded-md bg-muted p-0.5"
                role="group"
                aria-label="统计范围"
              >
                {(['week', 'month'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={scope === s}
                    onClick={() => setScope(s)}
                    className={cn(
                      'rounded-[5px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      scope === s
                        ? 'bg-input font-medium text-foreground'
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
                <span className="min-w-[9.5rem] text-center mono text-sm text-secondary-foreground">
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
            </>
            )
          }
        />
      </div>

      {sessions.length === 0 ? (
        <div className="mt-12 flex flex-col items-center py-6 text-center">
          <p className="text-base font-medium">还没有专注记录</p>
          <p className="mt-1 max-w-sm text-balance text-sm leading-6 text-muted-foreground">
            在任务行点计时图标开始一段专注，或从右上角开始不挂任务的专注。
          </p>
          <Button className="mt-5" onClick={onGoBoard}>
            去任务列表
          </Button>
        </div>
      ) : (
        // 宽屏两列：时间分配在左，当日记录在右，紧挨柱状图便于点选后查看；
        // 窄屏单列时当日记录排在柱状图正下方。
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <Widget title={`${periodWord}专注`} icon={Timer} tint="text-success" className="lg:col-span-2">
            <WidgetNumber className="mt-4" value={total.value} unit={total.unit} />
            <p className="mt-2 text-sm text-muted-foreground">{summary.join('，')}</p>
            <div className="mt-5">
              <FocusBars
                days={stats.days}
                selectedIso={selectedIso}
                onSelect={setSelectedIso}
                todayIso={todayIso}
                scope={scope}
              />
            </div>
          </Widget>

          <DayDetail
            className="lg:col-start-2 lg:row-start-2"
            date={selectedDate}
            iso={selectedIso}
            todayIso={todayIso}
            rows={selectedRows}
            onRemove={onRemove}
            onAdd={() => setManualDate(selectedIso)}
          />
          <AllocationCard className="lg:col-start-1 lg:row-start-2" stats={stats} />
          <HourCard stats={stats} />
          <RhythmCard streak={streak} heat={heat} />
        </div>
      )}
      <ManualSessionDialog date={manualDate} onClose={() => setManualDate(null)} />
    </main>
  )
}
