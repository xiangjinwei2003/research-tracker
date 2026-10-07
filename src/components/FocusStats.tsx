import { format } from 'date-fns'
import { fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { HeatWeek, PeriodStats } from '@/lib/focus'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

interface Props {
  stats: PeriodStats
  /** Centre caption of the donut, e.g. 本周. */
  centerLabel: string
  heat: HeatWeek[]
  allTime: { minutes: number; count: number; days: number }
}

/** Big-number split for the donut centre: 45 → (45, 分钟); 96 → (1.6, 小时). */
function bigDuration(min: number): { value: string; unit: string } {
  if (min < 60) return { value: `${min}`, unit: '分钟' }
  const h = Math.round((min / 60) * 10) / 10
  return { value: Number.isInteger(h) ? h.toFixed(0) : `${h}`, unit: '小时' }
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border pb-2 text-[13px] font-semibold text-foreground">
      {children}
    </h2>
  )
}

/** 项目占比环图与近 16 周热力图。 */
export function FocusStats({
  stats,
  centerLabel,
  heat,
  allTime,
}: Props) {
  const total = bigDuration(stats.minutes)

  /* Donut geometry: each slice carries its fraction + accumulated offset. */
  const R = 52
  const C = 2 * Math.PI * R
  const gap = stats.share.length > 1 ? C * 0.02 : 0
  const segments: { key: string; name: string; color?: string; minutes: number; frac: number; offset: number }[] = []
  let acc = 0
  for (const s of stats.share) {
    const frac = stats.minutes > 0 ? s.minutes / stats.minutes : 0
    segments.push({ ...s, frac, offset: acc })
    acc += frac
  }

  return (
    <section aria-label="专注统计" className="mt-12">
      <div className="review-split">
        <div>
          <SectionHead>项目占比</SectionHead>
          {stats.minutes > 0 ? (
            <div className="mt-4 flex items-center gap-5">
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
                      strokeWidth={11}
                      strokeDasharray={`${Math.max(0, C * s.frac - gap)} ${C}`}
                      strokeDashoffset={-C * s.offset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="mono text-lg font-semibold leading-none text-foreground">
                    {total.value}
                    <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                      {total.unit}
                    </span>
                  </span>
                  <span className="mt-1 text-[10px] text-faint">{centerLabel}</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {segments.map((s) => (
                  <li key={s.key} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: s.color || 'var(--faint)' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-secondary-foreground">
                      {s.name}
                    </span>
                    <span className="shrink-0 mono text-muted-foreground">
                      {fmtMinutes(s.minutes)}
                    </span>
                    <span className="w-9 shrink-0 text-right mono text-faint">
                      {Math.round(s.frac * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-faint">该时段没有专注记录</p>
          )}
        </div>

        <div>
          <SectionHead>近 16 周</SectionHead>
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
                            ? 'bg-muted'
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
          <p className="mt-3 text-[11px] text-faint">
            累计专注 {fmtMinutes(allTime.minutes)} · {allTime.count} 次 · 覆盖 {allTime.days} 天
          </p>
        </div>
      </div>
    </section>
  )
}
