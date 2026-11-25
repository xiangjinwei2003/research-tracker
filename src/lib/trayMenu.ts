import { fmtCountdown, timerLabel, timerRemaining } from './timer'
import type { ActiveTimer } from './types'

export interface TrayActions {
  start: (plannedMin: number) => void
  finish: () => void
  cancel: () => void
  quickNote: () => void
  open: () => void
}

/** 菜单栏的菜单。计时中显示任务名、提前结束与取消；空闲时显示开始专注。 */
export function trayMenu(timer: ActiveTimer | null, act: TrayActions): ClaudeDesktop.TrayMenuItem[] {
  const common: ClaudeDesktop.TrayMenuItem[] = [
    { type: 'separator' },
    { label: '记一条笔记', click: act.quickNote },
    { label: '打开 Research Tracker', click: act.open },
  ]
  if (timer) {
    return [
      { label: timerLabel(timer), enabled: false },
      { label: '提前结束并记录', click: act.finish },
      { label: '取消（不记录）', click: act.cancel },
      ...common,
    ]
  }
  return [
    { label: '专注 30 分钟', click: () => act.start(30) },
    { label: '专注 1 小时', click: () => act.start(60) },
    ...common,
  ]
}

/** 菜单栏标题：计时中为剩余时间，空闲时不显示文字只显示图标。 */
export function trayTitle(timer: ActiveTimer | null, now: number): string | undefined {
  return timer ? fmtCountdown(timerRemaining(timer, now)) : undefined
}
