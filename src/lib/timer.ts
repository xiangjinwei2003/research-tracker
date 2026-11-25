import type { ActiveTimer } from './types'

/** 倒计时文字，如 05:09。 */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 计时结束的时刻（epoch ms）。 */
export function timerEnd(timer: ActiveTimer): number {
  return timer.startedAt + timer.plannedMin * 60_000
}

/** 剩余毫秒，夹在 0 与计划时长之间（刚开始时 now 可能比 startedAt 略早）。 */
export function timerRemaining(timer: ActiveTimer, now: number): number {
  return Math.min(timer.plannedMin * 60_000, Math.max(0, timerEnd(timer) - now))
}

/** 计时对应的名称：任务，否则项目，否则自由专注。 */
export function timerLabel(timer: ActiveTimer): string {
  return (
    timer.todoTitle?.trim() ||
    timer.projectTitle?.trim() ||
    (timer.projectId ? '未命名项目' : '自由专注')
  )
}
