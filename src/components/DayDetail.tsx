import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { fmtHM, fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import type { ResolvedSession } from '@/lib/focus'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const

interface Props {
  date: Date
  iso: string
  todayIso: string
  /** That day's sessions, earliest first. */
  rows: ResolvedSession[]
  onRemove: (r: ResolvedSession) => void
}

/** 选中那天：日期、当日合计，下面是逐条专注记录（时间、时长、任务）。 */
export function DayDetail({ date, iso, todayIso, rows, onRemove }: Props) {
  const isToday = iso === todayIso
  const minutes = rows.reduce((acc, r) => acc + r.minutes, 0)

  return (
    <section aria-label="当日详情" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">
          {format(date, 'M月d日')}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            周{WEEKDAY_CN[(date.getDay() + 6) % 7]}
          </span>
          {isToday ? (
            <span className="ml-2 align-middle text-xs font-medium text-today">
              今天
            </span>
          ) : null}
        </h2>
        <p className="text-sm text-muted-foreground">
          {rows.length > 0 ? (
            <>
              当日专注{' '}
              <span className="font-semibold mono text-foreground">
                {fmtMinutes(minutes)}
              </span>{' '}
              · {rows.length} 次
            </>
          ) : null}
        </p>
      </div>

      {rows.length > 0 ? (
        <>
          <ul className="mt-3 space-y-1">
            {rows.map((r) => (
              // Narrow screens wrap the title onto its own line rather than
              // truncating it to two characters next to the fixed time columns.
              <li
                key={r.session.id}
                className="group flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-1 py-1.5 text-sm hover:bg-hover"
              >
                <span className="w-24 shrink-0 mono text-xs text-faint">
                  {fmtHM(r.session.startedAt)}–{fmtHM(r.session.endedAt)}
                </span>
                <span className="w-24 shrink-0 whitespace-nowrap mono text-xs text-faint">
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
        </>
      ) : (
        <p className="mt-2 text-xs text-faint">
          这一天没有专注记录。
        </p>
      )}
    </section>
  )
}
