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

/** Ring geometry — a single instance app-wide, so fixed size/viewBox are safe
    (pure strokeDashoffset animation, no cross-element references). */
const RING_SIZE = 28
const RING_R = 10.5
const RING_C = 2 * Math.PI * RING_R
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/DropdownMenu'

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * App-wide focus countdown. Remaining time is derived from the persisted start
 * timestamp so reloads and long sleeps cannot drift the clock.
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
    const tick = () => setNow(Date.now())
    const t = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
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

  const bellButton = (
    <button
      type="button"
      onClick={() => void toggleRemind()}
      aria-pressed={remindOn}
      aria-label={remindOn ? '关闭结束提醒' : '开启结束提醒'}
      title={remindOn ? '结束提醒：响铃与系统通知' : '结束提醒已关闭'}
      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {remindOn ? <Bell size={14} /> : <BellOff size={14} className="text-faint" />}
    </button>
  )

  if (!activeTimer) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover data-[state=open]:text-foreground"
          aria-label="开始专注倒计时"
        >
          <Timer size={15} /> 专注
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>自由专注</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => begin(30)}>
            <Timer /> 30 分钟
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => begin(60)}>
            <Timer /> 1 小时
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void toggleRemind()}>
            {remindOn ? <Bell /> : <BellOff />}
            {remindOn ? '结束时提醒：开' : '结束时提醒：关'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const durationMs = end - activeTimer.startedAt
  const remaining = Math.min(durationMs, Math.max(0, end - now))
  const remainingPct = Math.min(100, Math.max(0, (remaining / durationMs) * 100))
  const accent = activeTimer.color || 'var(--ring)'
  const label =
    activeTimer.todoTitle?.trim() ||
    activeTimer.projectTitle?.trim() ||
    (activeTimer.projectId ? '未命名项目' : '自由专注')

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
    // 顶栏胶囊：进度环、倒计时与任务名、提醒/完成/取消三个图标按钮。
    // 计划时长与项目名放在 title 提示里。
    <div
      className={cn(
        'flex h-9 max-w-full min-w-0 items-center gap-2 rounded-full bg-muted pl-1.5 pr-1',
      )}
      role="timer"
      aria-label="专注倒计时"
      title={`${sub} · ${fmtCountdown(remaining)}`}
    >
      <div className="relative size-7 shrink-0" aria-hidden>
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
            className="stroke-input"
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
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            'mono text-[14px] font-semibold leading-none text-foreground',
            remaining <= 60_000 && 'text-today',
          )}
        >
          {fmtCountdown(remaining)}
        </span>
        <span className="hidden max-w-[11rem] truncate text-xs leading-none text-muted-foreground sm:block">
          {label}
        </span>
      </div>
      <div className="flex items-center">
        {bellButton}
        <button
          type="button"
          onClick={onFinishEarly}
          title="提前结束并记录本次专注"
          aria-label="提前结束并记录本次专注"
          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-hover hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="取消（不记录）"
          aria-label="取消（不记录）"
          className="inline-flex size-7 items-center justify-center rounded-full text-faint transition-colors hover:bg-hover hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
