import { format } from 'date-fns'
import { CalendarDays, PieChart } from 'lucide-react'
import { fmtMinutes, splitMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { HeatWeek, PeriodStats } from '@/lib/focus'
import { Widget } from './Widget'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

/** 项目占比：环图加图例。 */
export function ProjectShareCard({
  stats,
  centerLabel,
  className,
}: {
  stats: PeriodStats
  /** 环图中心的说明，例如「本周」。 */
  centerLabel: string
  className?: string
}) {
  const total = splitMinutes(stats.minutes)

  /* 环图几何：每段记录占比和累计起点。 */
  const R = 52
  const C = 2 * Math.PI * R
  const gap = stats.share.length > 1 ? C * 0.02 : 0
  const segments: {
    key: string
    name: string
    color?: string
    minutes: number
    frac: number
    offset: number
  }[] = []
  let acc = 0
  for (const s of stats.share) {
    const frac = stats.minutes > 0 ? s.minutes / stats.minutes : 0
    segments.push({ ...s, frac, offset: acc })
    acc += frac
  }

  return (
    <Widget title="项目占比" icon={PieChart} tint="text-[oklch(0.75_0.13_300)]" className={className}>
      {stats.minutes > 0 ? (
        <div className="mt-4 flex flex-1 items-center gap-5">
          <div className="relative shrink-0">
            <svg width={128} height={128} viewBox="0 0 128 128" className="-rotate-90">
              {segments.map((s) => (
                <circle
                  key={s.key}
                  cx={64}
                  cy={64}
                  r={R}
                  fill="none"
                  stroke={s.color || 'var(--faint)'}
                  strokeWidth={12}
                  strokeLinecap={segments.length > 1 ? 'butt' : 'round'}
                  strokeDasharray={`${Math.max(0, C * s.frac - gap)} ${C}`}
                  strokeDashoffset={-C * s.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num-rounded text-[22px] font-semibold leading-none text-foreground">
                {total.value}
                <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">
                  {total.unit}
                </span>
              </span>
              <span className="mt-1 text-[11px] text-faint">{centerLabel}</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-[13px]">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: s.color || 'var(--faint)' }}
                />
                <span className="min-w-0 flex-1 truncate text-secondary-foreground">{s.name}</span>
                <span className="shrink-0 mono text-muted-foreground">{fmtMinutes(s.minutes)}</span>
                <span className="w-9 shrink-0 text-right mono text-faint">
                  {Math.round(s.frac * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-faint">该时段没有专注记录</p>
      )}
    </Widget>
  )
}

/** 近 16 周热力图，下方是累计数据。 */
export function HeatmapCard({
  heat,
  allTime,
  className,
}: {
  heat: HeatWeek[]
  allTime: { minutes: number; count: number; days: number }
  className?: string
}) {
  return (
    <Widget title="近 16 周" icon={CalendarDays} tint="text-ring" className={className}>
      <div className="mt-4 max-w-full overflow-x-auto">
        <div className="inline-flex gap-1">
          <div className="mr-1 flex flex-col gap-1 pt-4.5">
            {WEEKDAY_CN.map((w, i) => (
              <span
                key={w}
                className="flex h-3 w-4 items-center text-[9px] leading-none text-faint"
              >
                {i % 2 === 0 ? w : ''}
              </span>
            ))}
          </div>
          {heat.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              <span className="h-3.5 overflow-visible whitespace-nowrap text-[9px] leading-none text-faint">
                {week.monthLabel}
              </span>
              {week.days.map((d) => (
                <span
                  key={d.iso}
                  title={
                    d.future
                      ? undefined
                      : `${format(d.date, 'M月d日')} · ${d.minutes > 0 ? fmtMinutes(d.minutes) : '无记录'}`
                  }
                  className={cn(
                    'h-3 w-3 rounded-[3px]',
                    d.future
                      ? 'opacity-0'
                      : d.minutes === 0
                        ? 'bg-white/[.06]'
                        : d.minutes < 30
                          ? 'bg-brand-900'
                          : d.minutes < 60
                            ? 'bg-brand-700'
                            : d.minutes < 120
                              ? 'bg-brand-500'
                              : 'bg-brand-400',
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-auto pt-4 text-[13px] text-muted-foreground">
        累计专注 <span className="mono text-foreground">{fmtMinutes(allTime.minutes)}</span> ·{' '}
        {allTime.count} 次 · 覆盖 {allTime.days} 天
      </p>
    </Widget>
  )
}
