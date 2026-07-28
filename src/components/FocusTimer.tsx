import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Check, Timer, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import {
  notifyFocusDone,
  playChime,
  primeChime,
  reminderEnabled,
  requestNotifyPermission,
  setReminderEnabled,
} from '@/lib/reminder'
import { Switch } from './ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/** Ring geometry — a single instance app-wide, so fixed ids/sizes are safe. */
const RING_SIZE = 28
const RING_R = 10.5
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
  const [remindOn, setRemindOn] = useState(reminderEnabled)
  // One completion per countdown, even though the tick effect fires often.
  const firedRef = useRef(false)

  const end = activeTimer ? activeTimer.startedAt + activeTimer.plannedMin * 60_000 : 0

  /** Start from a real click: unlock audio now so the chime isn't blocked later. */
  const begin = (plannedMin: number) => {
    if (remindOn) {
      primeChime()
      void requestNotifyPermission()
    }
    startTimer({ plannedMin })
  }

  const toggleRemind = async () => {
    const next = !remindOn
    setRemindOn(next)
    setReminderEnabled(next)
    if (!next) {
      toast({ message: '已关闭结束提醒' })
      return
    }
    primeChime()
    const state = await requestNotifyPermission()
    toast({
      message:
        state === 'granted'
          ? '结束时会响铃并弹出系统通知'
          : state === 'denied'
            ? '浏览器已拦截通知权限，结束时只会响铃'
            : '结束时会响铃提醒',
    })
  }

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
    if (!s) return
    if (remindOn) {
      // The chime + banner are what reach the user when this tab isn't in front.
      playChime()
      notifyFocusDone(
        `${s.todoTitle || s.projectTitle || '自由专注'} · ${s.plannedMin} 分钟已完成`,
      )
    }
    toast({ message: `专注完成 · 已记录 ${s.plannedMin} 分钟` })
  }, [now, end, activeTimer, completeTimer, remindOn])

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

  const bell = (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {remindOn ? (
        <Bell size={14} className="text-faint" />
      ) : (
        <BellOff size={14} className="text-faint/50" />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Switch
            size="sm"
            checked={remindOn}
            onCheckedChange={() => void toggleRemind()}
            aria-label={remindOn ? '关闭结束提醒' : '开启结束提醒'}
          />
        </TooltipTrigger>
        <TooltipContent>
          {remindOn ? '结束提醒：响铃 + 系统通知' : '结束提醒已关闭'}
        </TooltipContent>
      </Tooltip>
    </span>
  )

  if (!activeTimer) {
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        {bell}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            aria-label="开始专注倒计时"
            title="开始专注倒计时（也可右键任务卡片）"
          >
            <Timer size={15} /> 专注
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>自由专注</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => begin(30)}>
              <Timer size={15} /> 倒计时 30 分钟
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => begin(60)}>
              <Timer size={15} /> 倒计时 1 小时
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
    // Compact capsule in the hero header: a small 28px progress ring, the mono
    // countdown + task label, then a quiet icon-button column. The planned
    // duration / project context lives in the capsule's title tooltip.
    <div
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-lg border border-brand-500/40 bg-card px-3 py-1.5 shadow-[0_0_18px_rgba(107,124,255,.12)] max-sm:w-full',
        remaining <= 60_000 && 'animate-pulse',
      )}
      role="timer"
      aria-label="专注倒计时"
      title={`${sub} · ${fmtCountdown(remaining)}`}
    >
      <div className="relative h-7 w-7 shrink-0" aria-hidden>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            strokeWidth={3}
            className="stroke-white/10"
          />
          {/* The arc IS the time left: full at start, unwinding toward 12
              o'clock as it burns. Offset animates so ticks glide, not jump. */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            stroke={accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - remainingPct / 100)}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="mono text-[15px] font-semibold leading-none text-brand-200">
          {fmtCountdown(remaining)}
        </div>
        <div className="mt-0.5 max-w-[150px] truncate text-[10.5px] leading-tight text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {bell}
        <button
          type="button"
          onClick={onFinishEarly}
          title="提前结束并记录本次专注"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="取消（不记录）"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-accent/60 hover:text-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
