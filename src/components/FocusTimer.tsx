import { useEffect, useRef, useState } from 'react'
import { Check, Timer, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { Button } from './ui/Button'

/** Ring geometry — a single instance app-wide, so fixed ids/sizes are safe. */
const RING_SIZE = 104
const RING_R = 46
const RING_C = 2 * Math.PI * RING_R
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
  const remainingPct = Math.min(100, Math.max(0, (remaining / durationMs) * 100))
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

  const sub = [
    activeTimer.todoTitle ? activeTimer.projectTitle : null,
    `${activeTimer.plannedMin} 分钟`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    // The header's whole right side is the countdown stage: task context +
    // labelled controls stacked left of a large progress ring (digits inside,
    // canonical pomodoro pattern). Wraps to its own row on phones.
    <div
      className="flex shrink-0 items-center gap-4 max-sm:w-full max-sm:justify-end"
      role="timer"
      aria-label="专注倒计时"
    >
      <div className="min-w-0 text-right">
        <div className="max-w-[220px] truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
        </div>
        <div className="mt-0.5 max-w-[220px] truncate text-xs text-neutral-500 dark:text-neutral-400">
          {sub}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onFinishEarly} title="提前结束并记录本次专注">
            <Check size={14} /> 提前结束
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            title="取消（不记录）"
            className="text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            <X size={14} /> 取消
          </Button>
        </div>
      </div>

      <div
        className={cn('relative shrink-0', remaining <= 60_000 && 'animate-pulse')}
        aria-hidden
      >
        {/* Ambient glow in the project hue — same design DNA as .proj-card. */}
        <div
          className="absolute -inset-3 rounded-full opacity-25 blur-md dark:opacity-40"
          style={{ background: `radial-gradient(closest-side, ${accent}, transparent 74%)` }}
        />
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="relative -rotate-90"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            strokeWidth={7}
            className="stroke-neutral-200/80 dark:stroke-neutral-800"
          />
          {/* The arc IS the time left: full at start, unwinding toward 12
              o'clock as it burns. Offset animates so ticks glide, not jump. */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke={accent}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - remainingPct / 100)}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none tabular-nums text-neutral-900 dark:text-neutral-100">
            {fmtCountdown(remaining)}
          </span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.25em] text-neutral-400 dark:text-neutral-500">
            专注中
          </span>
        </div>
      </div>
    </div>
  )
}
