import { useRef } from 'react'
import { format } from 'date-fns'
import { fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { DayTotal } from '@/lib/focus'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const
/** Dates that keep a label in the (dense) month view. */
const MONTH_TICKS = [1, 5, 10, 15, 20, 25, 30]

interface Props {
  days: DayTotal[]
  selectedIso: string
  onSelect: (iso: string) => void
  todayIso: string
  scope: 'week' | 'month'
}

/**
 * Per-day focus totals as a bar chart that doubles as the day picker: clicking
 * (or arrowing to) a bar drives the day detail below it. Empty days stay
 * clickable — "nothing here" is an answer too.
 */
export function FocusBars({ days, selectedIso, onSelect, todayIso, scope }: Props) {
  const groupRef = useRef<HTMLDivElement>(null)
  const isWeek = scope === 'week'
  const max = Math.max(30, ...days.map((d) => d.minutes))

  // Roving selection: ←/→ moves to the adjacent day and takes focus with it.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const i = days.findIndex((d) => d.iso === selectedIso)
    if (i < 0) return
    const next = e.key === 'ArrowLeft' ? Math.max(0, i - 1) : Math.min(days.length - 1, i + 1)
    if (next === i) return
    e.preventDefault()
    onSelect(days[next].iso)
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-iso="${days[next].iso}"]`)
      ?.focus()
  }

  return (
    <div
      ref={groupRef}
      onKeyDown={onKeyDown}
      role="group"
      aria-label="每日专注时长，选择某天查看当日详情"
      className="flex h-[168px] items-stretch gap-1 sm:gap-1.5"
    >
      {days.map((d, i) => {
        const selected = d.iso === selectedIso
        const isToday = d.iso === todayIso
        const pct = d.minutes > 0 ? Math.max(4, (d.minutes / max) * 100) : 0
        const label = isWeek
          ? `周${WEEKDAY_CN[i]}`
          : MONTH_TICKS.includes(d.date.getDate())
            ? `${d.date.getDate()}`
            : ''
        return (
          <button
            key={d.iso}
            type="button"
            data-iso={d.iso}
            aria-pressed={selected}
            title={`${format(d.date, 'M月d日')} · ${d.minutes > 0 ? `${fmtMinutes(d.minutes)} · ${d.count} 次` : '无记录'}`}
            aria-label={`${format(d.date, 'M月d日')}，${d.minutes > 0 ? fmtMinutes(d.minutes) : '无记录'}`}
            onClick={() => onSelect(d.iso)}
            className={cn(
              'group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-lg px-0.5 pb-1.5 pt-1 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              selected ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025]',
            )}
          >
            <span
              className={cn(
                'h-3 text-[10px] leading-none tabular-nums transition-colors',
                isWeek && d.minutes > 0 ? '' : 'opacity-0',
                selected ? 'font-medium text-foreground/90' : 'text-faint',
              )}
            >
              {isWeek && d.minutes > 0 ? fmtMinutes(d.minutes) : '·'}
            </span>
            <span className="flex w-full flex-1 items-end justify-center">
              {d.minutes > 0 ? (
                <span
                  style={{ height: `${pct}%` }}
                  className={cn(
                    'w-full transition-colors',
                    isWeek ? 'max-w-14 rounded-md' : 'max-w-[9px] rounded-sm',
                    selected ? 'bg-brand-400' : 'bg-brand-500/40 group-hover:bg-brand-400/60',
                  )}
                />
              ) : (
                <span
                  className={cn(
                    'h-1 w-full rounded-sm',
                    isWeek ? 'max-w-14' : 'max-w-[9px]',
                    selected ? 'bg-brand-700' : 'bg-white/[0.08]',
                  )}
                />
              )}
            </span>
            <span
              className={cn(
                'flex h-4 items-center gap-1 text-[10px] leading-none transition-colors',
                selected
                  ? 'text-brand-300 font-semibold'
                  : isToday
                    ? 'text-muted-foreground'
                    : 'text-faint',
              )}
            >
              {label}
              {isToday ? (
                <span aria-hidden className="h-1 w-1 rounded-full bg-brand-400" />
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
