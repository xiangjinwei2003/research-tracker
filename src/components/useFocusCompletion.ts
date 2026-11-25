import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { fmtCountdown, timerEnd, timerRemaining } from '@/lib/timer'
import { notifyFocusDone, playChime, reminderEnabled } from '@/lib/reminder'

/**
 * 计时结束的处理与窗口标题里的倒计时。挂在应用根部，完整窗口和置顶小窗两种模式都生效，
 * 所以不依赖顶栏的计时组件是否渲染。结束时间由持久化的开始时刻推出，重新打开或休眠后不会漂移。
 */
export function useFocusCompletion(): void {
  const activeTimer = useStore((s) => s.activeTimer)
  const completeTimer = useStore((s) => s.completeTimer)
  const [now, setNow] = useState(() => Date.now())
  // 每段计时只处理一次结束。
  const fired = useRef<number | null>(null)

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

  // 结束：也补上窗口关着时已经到点的计时（completeTimer 把结束时刻记为计划的终点）。
  useEffect(() => {
    if (!activeTimer || now < timerEnd(activeTimer) || fired.current === activeTimer.startedAt) return
    fired.current = activeTimer.startedAt
    const s = completeTimer()
    if (!s) return
    if (reminderEnabled()) {
      playChime()
      notifyFocusDone(`${s.todoTitle || s.projectTitle || s.label || '自由专注'}，${s.plannedMin} 分钟已完成`)
    }
    toast({ message: `专注完成，已记录 ${s.plannedMin} 分钟` })
  }, [now, activeTimer, completeTimer])

  // 计时期间窗口标题显示倒计时，结束后恢复。
  useEffect(() => {
    if (!activeTimer) return
    const original = document.title
    return () => {
      document.title = original
    }
  }, [activeTimer])
  useEffect(() => {
    if (activeTimer) document.title = `${fmtCountdown(timerRemaining(activeTimer, now))} 专注中`
  }, [activeTimer, now])
}
