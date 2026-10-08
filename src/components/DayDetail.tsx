import { format } from 'date-fns'
import { Clock3, Trash2 } from 'lucide-react'
import { fmtHM, fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { ResolvedSession } from '@/lib/focus'
import { Widget } from './Widget'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

interface Props {
  date: Date
  iso: string
  todayIso: string
  /** That day's sessions, earliest first. */
  rows: ResolvedSession[]
  onRemove: (r: ResolvedSession) => void
  className?: string
}

/** 选中那天：日期、当日合计，下面是逐条专注记录（时间、时长、任务）。 */
export function DayDetail({ date, iso, todayIso, rows, onRemove, className }: Props) {
  const isToday = iso === todayIso
  const minutes = rows.reduce((acc, r) => acc + r.minutes, 0)

  const weekday = `周${WEEKDAY_CN[(date.getDay() + 6) % 7]}`

  return (
    <Widget
      title={`${format(date, 'M月d日')} ${weekday}${isToday ? ' · 今天' : ''}`}
      icon={Clock3}
      tint={isToday ? 'text-today' : 'text-secondary-foreground'}
      aria-label="当日详情"
      className={className}
      aside={
        rows.length > 0 ? (
          <span className="text-[13px] text-muted-foreground">
            <span className="mono font-semibold text-foreground">{fmtMinutes(minutes)}</span> ·{' '}
            {rows.length} 次
          </span>
        ) : null
      }
    >
      {rows.length > 0 ? (
          <ul className="-mx-2 mt-3 space-y-0.5">
            {rows.map((r) => (
              // Narrow screens wrap the title onto its own line rather than
              // truncating it to two characters next to the fixed time columns.
              <li
                key={r.session.id}
                className="group flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl px-2 py-1.5 text-[14px] hover:bg-hover"
              >
                <span className="w-24 shrink-0 mono text-[13px] text-faint">
                  {fmtHM(r.session.startedAt)}–{fmtHM(r.session.endedAt)}
                </span>
                <span className="w-24 shrink-0 whitespace-nowrap mono text-[13px] text-faint">
                  {fmtMinutes(r.minutes)}
                  {r.session.completed ? '' : ' · 提前'}
                </span>
                <span className="order-last min-w-0 basis-full truncate text-secondary-foreground sm:order-none sm:basis-0 sm:flex-1">
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                    style={{ background: r.color || 'var(--faint)' }}
                  />
                  {r.label}
                  {r.session.todoTitle && r.projectTitle !== '自由专注' ? (
                    <span className="text-faint"> · {r.projectTitle}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label="删除这条专注记录"
                  title="删除记录"
                  className={cn(
                    'ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition sm:ml-0',
                    '[@media(hover:hover)]:sm:opacity-0 [@media(hover:hover)]:sm:group-hover:opacity-100',
                    'hover:text-destructive focus-visible:opacity-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
      ) : (
        <p className="mt-3 text-[13px] text-faint">这一天没有专注记录。</p>
      )}
    </Widget>
  )
}
