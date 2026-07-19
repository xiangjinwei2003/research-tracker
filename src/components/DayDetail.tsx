import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { fmtHM, fmtMinutes } from '@/lib/date'
import { cn } from '@/lib/cn'
import { taskShare, type ResolvedSession } from '@/lib/focus'

const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] as const
/** Earliest hour the day track shows before it stretches for an early session. */
const BASE_FROM_H = 6

interface Props {
  date: Date
  iso: string
  todayIso: string
  /** That day's sessions, earliest first. */
  rows: ResolvedSession[]
  onRemove: (r: ResolvedSession) => void
}

/**
 * The selected day, in full: total on the right of the date, a proportional
 * 24-hour track showing WHEN the day was spent, then the records themselves.
 */
export function DayDetail({ date, iso, todayIso, rows, onRemove }: Props) {
  const isToday = iso === todayIso
  const minutes = rows.reduce((acc, r) => acc + r.minutes, 0)
  const shares = taskShare(rows)

  // Window: 06:00–24:00 by default, stretched to cover an earlier session so a
  // 2am block never falls off the track.
  const fromH = rows.reduce(
    (lo, r) => Math.min(lo, new Date(r.session.startedAt).getHours()),
    BASE_FROM_H,
  )
  const span = 24 - fromH
  const ticks: number[] = []
  for (let h = Math.ceil(fromH / 3) * 3; h < 24; h += 3) ticks.push(h)

  const now = new Date()
  const nowPct = ((now.getHours() + now.getMinutes() / 60 - fromH) / span) * 100

  return (
    <section aria-label="当日详情" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {format(date, 'M月d日')}
          <span className="ml-1.5 text-sm font-normal text-neutral-500 dark:text-neutral-400">
            周{WEEKDAY_CN[(date.getDay() + 6) % 7]}
          </span>
          {isToday ? (
            <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 align-middle text-[10px] font-medium text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
              今天
            </span>
          ) : null}
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {rows.length > 0 ? (
            <>
              当日专注{' '}
              <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                {fmtMinutes(minutes)}
              </span>{' '}
              · {rows.length} 次
            </>
          ) : (
            '这一天没有专注记录'
          )}
        </p>
      </div>

      {rows.length > 0 ? (
        <>
          {/* How the day split across tasks — the track below answers "when",
              this answers "on what". Repeat sittings on a task are merged.
              Kept narrow so it reads as a legend, not a second timeline. */}
          <div className="mt-3 max-w-2xl">
            <div className="flex h-2 gap-0.5" role="img" aria-label="当日任务占比">
              {shares.map((s) => (
                <div
                  key={s.key}
                  // Proportional via flex-grow so the gaps don't overflow 100%.
                  style={{ flexGrow: s.minutes, background: s.color || 'var(--color-neutral-400)' }}
                  className="basis-0 rounded-full"
                  title={`${s.label} · ${fmtMinutes(s.minutes)} · ${Math.round((s.minutes / minutes) * 100)}%`}
                />
              ))}
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {shares.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color || 'var(--color-neutral-400)' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                    {s.label}
                    {s.label !== s.projectTitle ? (
                      <span className="text-neutral-400 dark:text-neutral-500"> · {s.projectTitle}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                    {fmtMinutes(s.minutes)}
                  </span>
                  <span className="w-9 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                    {Math.round((s.minutes / minutes) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Proportional day track: where the blocks sit IS when they happened. */}
          <div className="mt-5">
            <div className="relative h-8 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
              {ticks.map((h) => (
                <span
                  key={h}
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-neutral-200 dark:bg-neutral-800"
                  style={{ left: `${((h - fromH) / span) * 100}%` }}
                />
              ))}
              {rows.map((r) => {
                const s = new Date(r.session.startedAt)
                const startH = s.getHours() + s.getMinutes() / 60
                const left = ((startH - fromH) / span) * 100
                const width = (r.minutes / 60 / span) * 100
                const accent = r.color || 'var(--color-neutral-400)'
                return (
                  <span
                    key={r.session.id}
                    title={`${fmtHM(r.session.startedAt)}–${fmtHM(r.session.endedAt)} · ${r.label} · ${fmtMinutes(r.minutes)}`}
                    className="absolute inset-y-1 rounded-md"
                    style={{
                      left: `${Math.max(0, left)}%`,
                      width: `${Math.max(0.8, Math.min(width, 100 - left))}%`,
                      background: accent,
                    }}
                  />
                )
              })}
              {isToday && nowPct >= 0 && nowPct <= 100 ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-brand-500"
                  style={{ left: `${nowPct}%` }}
                />
              ) : null}
            </div>
            <div className="relative mt-1 h-3">
              {ticks.map((h) => (
                <span
                  key={h}
                  className="absolute -translate-x-1/2 text-[10px] leading-none tabular-nums text-neutral-400 dark:text-neutral-500"
                  style={{ left: `${((h - fromH) / span) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            {rows.map((r) => (
              // Narrow screens wrap the title onto its own line rather than
              // truncating it to two characters next to the fixed time columns.
              <li
                key={r.session.id}
                className="group flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-1 py-1.5 text-sm hover:bg-neutral-100/70 dark:hover:bg-neutral-900/60"
              >
                <span className="w-24 shrink-0 tabular-nums text-xs text-neutral-500 dark:text-neutral-400">
                  {fmtHM(r.session.startedAt)}–{fmtHM(r.session.endedAt)}
                </span>
                <span className="w-24 shrink-0 whitespace-nowrap text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {fmtMinutes(r.minutes)}
                  {r.session.completed ? '' : ' · 提前'}
                </span>
                <span className="order-last min-w-0 basis-full truncate text-neutral-700 sm:order-none sm:basis-0 sm:flex-1 dark:text-neutral-300">
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                    style={{ background: r.color || 'var(--color-neutral-400)' }}
                  />
                  {r.label}
                  {r.session.todoTitle && r.projectTitle !== '自由专注' ? (
                    <span className="text-neutral-400 dark:text-neutral-500"> · {r.projectTitle}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label="删除这条专注记录"
                  title="删除记录"
                  className={cn(
                    'ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition sm:ml-0',
                    // Always reachable on touch, hover-revealed on pointer devices.
                    'sm:opacity-0 sm:group-hover:opacity-100',
                    'hover:bg-neutral-200/70 hover:text-red-600 focus-visible:opacity-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-neutral-800 dark:hover:text-red-400',
                  )}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          在「总览」的任务卡片上右键即可开始专注；这一天的记录会出现在这里。
        </p>
      )}
    </section>
  )
}
