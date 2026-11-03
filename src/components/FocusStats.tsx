import { format } from 'date-fns'
import { Clock, Flame, ListTree } from 'lucide-react'
import { fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { HeatWeek, PeriodStats } from '@/lib/focus'
import { Widget, WidgetNumber } from './Widget'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const
/** 时段分布下方保留标注的整点。 */
const HOUR_TICKS = [0, 6, 12, 18]

/** 时间分配：每个项目或事项的时长与占比，项目下按任务汇总。 */
export function AllocationCard({ stats, className }: { stats: PeriodStats; className?: string }) {
  return (
    <Widget title="时间分配" icon={ListTree} tint="text-purple-11" className={className}>
      {stats.minutes > 0 ? (
        <ul className="mt-4 space-y-5">
          {stats.share.map((g) => {
            const frac = g.minutes / stats.minutes
            const color = g.color || 'var(--muted-foreground)'
            return (
              <li key={g.key}>
                <div className="flex items-center gap-2.5 text-sm">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{g.name}</span>
                  <span className="shrink-0 mono text-foreground">{fmtMinutes(g.minutes)}</span>
                  <span className="w-9 shrink-0 text-right mono text-muted-foreground">
                    {Math.round(frac * 100)}%
                  </span>
                </div>
                <div className="ml-[18px] mt-2 h-1 overflow-hidden rounded-full bg-selected">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(1, frac * 100)}%`, background: color }}
                  />
                </div>
                {g.tasks.length > 0 ? (
                  <ul className="ml-[18px] mt-2 space-y-1">
                    {g.tasks.map((t) => (
                      <li key={t.key} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="shrink-0 mono">{fmtMinutes(t.minutes)}</span>
                        <span aria-hidden className="w-9 shrink-0" />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">该时段没有专注记录</p>
      )}
    </Widget>
  )
}

/** 时段分布：一天 24 小时里每个小时的专注分钟数，补记不计入。 */
export function HourCard({ stats, className }: { stats: PeriodStats; className?: string }) {
  const max = Math.max(...stats.hours)
  return (
    <Widget title="时段分布" icon={Clock} tint="text-ring" className={className}>
      {max > 0 ? (
        <div className="mt-4">
          <div
            role="img"
            aria-label="每小时专注时长"
            className="flex h-24 items-end gap-[3px]"
          >
            {stats.hours.map((m, h) => (
              <span
                key={h}
                title={`${h} 点到 ${h + 1} 点：${m > 0 ? fmtMinutes(m) : '无记录'}`}
                className={cn('min-w-0 flex-1 rounded-[3px]', m > 0 ? 'bg-indigo-9' : 'bg-selected')}
                style={{ height: m > 0 ? `${Math.max(6, (m / max) * 100)}%` : '2px' }}
              />
            ))}
          </div>
          <div className="mt-2 flex text-xs leading-none text-muted-foreground">
            {stats.hours.map((_, h) => (
              <span key={h} className="min-w-0 flex-1 whitespace-nowrap">
                {HOUR_TICKS.includes(h) ? `${h}:00` : ''}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {stats.count > 0 ? '该时段只有补记，没有开始时刻' : '该时段没有专注记录'}
        </p>
      )}
    </Widget>
  )
}

/** 连续专注天数，下方是近 16 周热力图。两者都按全部记录计算，不随周月切换。 */
export function RhythmCard({
  streak,
  heat,
  className,
}: {
  streak: { current: number; longest: number }
  heat: HeatWeek[]
  className?: string
}) {
  return (
    <Widget
      title="连续专注"
      icon={Flame}
      tint="text-warn"
      className={className}
      aside={<span className="text-sm text-muted-foreground">最长 {streak.longest} 天</span>}
    >
      <WidgetNumber className="mt-4" value={streak.current} unit="天" />
      <div className="mt-5 max-w-full overflow-x-auto overflow-y-hidden">
        <div className="inline-flex gap-1">
          <div className="mr-1 flex flex-col gap-1 pt-4.5">
            {WEEKDAY_CN.map((w, i) => (
              <span
                key={w}
                className="flex h-3 w-4 items-center text-xs leading-none text-muted-foreground"
              >
                {i % 2 === 0 ? w : ''}
              </span>
            ))}
          </div>
          {heat.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              <span className="h-3.5 overflow-visible whitespace-nowrap text-xs leading-none text-muted-foreground">
                {week.monthLabel}
              </span>
              {week.days.map((d) => (
                <span
                  key={d.iso}
                  title={
                    d.future
                      ? undefined
                      : `${format(d.date, 'M月d日')}：${d.minutes > 0 ? fmtMinutes(d.minutes) : '无记录'}`
                  }
                  className={cn(
                    'h-3 w-3 rounded-[3px]',
                    d.future
                      ? 'opacity-0'
                      : d.minutes === 0
                        ? 'bg-selected'
                        : d.minutes < 30
                          ? 'bg-indigo-4'
                          : d.minutes < 60
                            ? 'bg-indigo-6'
                            : d.minutes < 120
                              ? 'bg-indigo-8'
                              : 'bg-indigo-10',
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Widget>
  )
}
