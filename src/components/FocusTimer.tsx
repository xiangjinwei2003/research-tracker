import { useEffect, useRef, useState } from 'react'
import { Check, Timer, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from './ui/DropdownMenu'

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * The focus-countdown slot in the 本周重点 header. Idle → a quiet 「专注」button
 * (touch-friendly fallback for the right-click menu on cards). Running → a
 * frameless countdown chip. Remaining time is always DERIVED from the persisted
 * start timestamp, so reloads and long sleeps can't drift the clock.
 */
export function FocusTimer() {
  const activeTimer = useStore((s) => s.activeTimer)
  const startTimer = useStore((s) => s.startTimer)
  const completeTimer = useStore((s) => s.completeTimer)
  const cancelTimer = useStore((s) => s.cancelTimer)

  const [now, setNow] = useState(() => Date.now())
  // One completion per countdown, even though the tick effect fires often.
  const firedRef = useRef(false)

  const end = activeTimer ? activeTimer.startedAt + activeTimer.plannedMin * 60_000 : 0

  useEffect(() => {
    firedRef.current = false
  }, [activeTimer?.startedAt])

  // `now` may lag up to one interval right after a start; the clamps below make
  // that invisible (a fresh countdown legitimately shows its full duration).
  useEffect(() => {
    if (!activeTimer) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [activeTimer])

  // Completion — also heals a countdown that expired while the tab was closed
  // (completeTimer clamps endedAt to the planned end, not "now").
  useEffect(() => {
    if (!activeTimer || firedRef.current || now < end) return
    firedRef.current = true
    const s = completeTimer()
    if (s) toast({ message: `专注完成 · 已记录 ${s.plannedMin} 分钟` })
  }, [now, end, activeTimer, completeTimer])

  // Show the countdown in the tab title while running; restore on stop.
  useEffect(() => {
    if (!activeTimer) return
    const original = document.title
    return () => {
      document.title = original
    }
  }, [activeTimer])
  useEffect(() => {
    if (!activeTimer) return
    const clamped = Math.min(activeTimer.plannedMin * 60_000, end - now)
    document.title = `${fmtCountdown(clamped)} · 专注中`
  }, [activeTimer, end, now])

  if (!activeTimer) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          aria-label="开始专注倒计时"
          title="开始专注倒计时（也可右键任务卡片）"
        >
          <Timer size={15} /> 专注
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>自由专注</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => startTimer({ plannedMin: 30 })}>
            <Timer size={15} /> 倒计时 30 分钟
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startTimer({ plannedMin: 60 })}>
            <Timer size={15} /> 倒计时 1 小时
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const durationMs = end - activeTimer.startedAt
  const remaining = Math.min(durationMs, Math.max(0, end - now))
  const pct = Math.min(100, Math.max(0, ((now - activeTimer.startedAt) / durationMs) * 100))
  const accent = activeTimer.color || 'var(--color-brand-500)'
  const label = activeTimer.todoTitle || activeTimer.projectTitle || '自由专注'

  const onFinishEarly = () => {
    const s = completeTimer({ early: true })
    toast({
      message: s
        ? `已记录 ${Math.max(1, Math.round((s.endedAt - s.startedAt) / 60_000))} 分钟专注`
        : '不足 1 分钟，未记录',
    })
  }

  const onCancel = () => {
    cancelTimer()
    toast({ message: '已取消专注' })
  }

  return (
    // On phones the chip takes its own header row (right-aligned) instead of
    // crushing the section title into a one-character-per-line column.
    <div
      className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end"
      role="timer"
      aria-label="专注倒计时"
    >
      <div className="w-[172px]">
        <div className="flex items-center justify-end gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {label}
          </span>
          <span className="text-xl font-semibold leading-none tabular-nums text-neutral-900 dark:text-neutral-100">
            {fmtCountdown(remaining)}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200/70 dark:bg-neutral-800">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onFinishEarly}
          title="提前结束并记录"
          aria-label="提前结束并记录本次专注"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="取消（不记录）"
          aria-label="取消本次专注，不记录"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
