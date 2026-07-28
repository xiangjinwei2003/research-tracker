import { format } from 'date-fns'
import { fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { HeatWeek, PeriodStats } from '@/lib/focus'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

interface Props {
  stats: PeriodStats
  /** 本周专注 / 7月专注 — matches the period the page is showing. */
  totalLabel: string
  /** 较上周 / 较上月. */
  deltaLabel: string
  /** Centre caption of the donut, e.g. 本周. */
  centerLabel: string
  streak: { current: number; longest: number }
  heat: HeatWeek[]
  allTime: { minutes: number; count: number; days: number }
}

/** Big-number split for KPI tiles: 45 → (45, 分钟); 96 → (1.6, 小时). */
function bigDuration(min: number): { value: string; unit: string } {
  if (min < 60) return { value: `${min}`, unit: '分钟' }
  const h = Math.round((min / 60) * 10) / 10
  return { value: Number.isInteger(h) ? h.toFixed(0) : `${h}`, unit: '小时' }
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3.5">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="mono text-[22px] font-semibold leading-none text-foreground">{value}</span>
        <span className="text-xs text-faint">{unit}</span>
      </div>
      <div className="mt-1.5 truncate text-[11px] text-faint">{sub}</div>
    </div>
  )
}

/** Period-over-period change, in the reference dashboards' ±% chip style. */
function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  if (prev === 0) return <>{cur > 0 ? `${label} · 上期无记录` : '—'}</>
  const pct = Math.round(((cur - prev) / prev) * 100)
  return (
    <span
      className={cn(pct > 0 && 'text-success', pct < 0 && 'text-warn')}
    >
      {label} {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

/** KPI tiles, per-project donut and the long-run heatmap for one period. */
export function FocusStats({
  stats,
  totalLabel,
  deltaLabel,
  centerLabel,
  streak,
  heat,
  allTime,
}: Props) {
  const total = bigDuration(stats.minutes)
  const avg = bigDuration(stats.avgMinutes)
  const best = bigDuration(stats.best?.minutes ?? 0)

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
    <section aria-label="专注统计" className="mt-8">
      <h3 className="kicker">专注统计</h3>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={totalLabel}
          value={total.value}
          unit={total.unit}
          sub={<Delta cur={stats.minutes} prev={stats.prevMinutes} label={deltaLabel} />}
        />
        <Tile
          label="日均专注"
          value={avg.value}
          unit={avg.unit}
          sub={`按已过 ${stats.avgDays} 天计`}
        />
        <Tile
          label="单日最高"
          value={best.value}
          unit={best.unit}
          sub={
            stats.best
              ? `${format(stats.best.date, 'M月d日')} 周${WEEKDAY_CN[(stats.best.date.getDay() + 6) % 7]}`
              : '—'
          }
        />
        <Tile
          label="连续专注"
          value={`${streak.current}`}
          unit="天"
          sub={`最长 ${streak.longest} 天`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
        <div>
          <h4 className="kicker">项目占比</h4>
          {stats.minutes > 0 ? (
            <div className="mt-3 flex items-center gap-5">
              <div className="relative shrink-0">
                <svg width={128} height={128} viewBox="0 0 128 128" className="-rotate-90">
                  {segments.map((s) => (
                    <circle
                      key={s.key}
                      cx={64}
                      cy={64}
                      r={R}
                      fill="none"
                      stroke={s.color || 'var(--color-neutral-400)'}
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
                      style={{ background: s.color || 'var(--color-neutral-400)' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
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
          <h4 className="kicker">专注热力图</h4>
          <div className="mt-3 overflow-x-auto">
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
                            ? 'bg-white/[0.05]'
                            : d.minutes < 30
                              ? 'bg-brand-950'
                              : d.minutes < 60
                                ? 'bg-brand-800'
                                : d.minutes < 120
                                  ? 'bg-brand-600'
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
