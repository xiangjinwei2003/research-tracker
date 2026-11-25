import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { timerLabel } from '@/lib/timer'
import { primeChime } from '@/lib/reminder'
import { trayMenu, trayTitle, type TrayActions } from '@/lib/trayMenu'
import { trayIconPng } from './icons'
import { requestQuickNote } from './quickNote'

let unsubscribe: (() => void) | null = null
let ticker: ReturnType<typeof setInterval> | null = null

function actions(desktop: ClaudeDesktop): TrayActions {
  return {
    start: (plannedMin) => {
      primeChime()
      useStore.getState().startTimer({ plannedMin })
    },
    finish: () => {
      const s = useStore.getState().completeTimer({ early: true })
      toast({
        message: s ? `已记录 ${Math.max(1, Math.round((s.endedAt - s.startedAt) / 60_000))} 分钟专注` : '不足 1 分钟，未记录',
      })
    },
    cancel: () => {
      useStore.getState().cancelTimer()
      toast({ message: '已取消专注' })
    },
    quickNote: () => {
      void desktop.window.show().finally(requestQuickNote)
    },
    open: () => {
      void desktop.window.show()
    },
  }
}

function stopFollowing(): void {
  unsubscribe?.()
  unsubscribe = null
  if (ticker) clearInterval(ticker)
  ticker = null
}

/**
 * 打开菜单栏项并跟随计时状态：计时中每秒刷新标题，计时开始或结束时重建菜单。
 * 需要 menu-bar 权限，由调用方先确认。窗口关闭或页面重载时菜单栏项随之消失，每次打开都要重新设置。
 * 第一次设置失败时报错。
 */
export async function enableTray(desktop: ClaudeDesktop): Promise<void> {
  stopFollowing()
  const icon = trayIconPng()
  const act = actions(desktop)
  let lastKey = ''
  const options = (): ClaudeDesktop.TrayOptions => {
    const timer = useStore.getState().activeTimer
    const key = timer ? `${timer.startedAt}` : 'idle'
    const title = trayTitle(timer, Date.now())
    const next: ClaudeDesktop.TrayOptions = {
      icon,
      toolTip: timer ? `专注中：${timerLabel(timer)}` : '没有进行中的专注',
      ...(title ? { title } : {}),
    }
    // 菜单只在计时开始或结束时变化，每秒只换标题。
    if (key !== lastKey) next.menu = trayMenu(timer, act)
    lastKey = key
    return next
  }
  const render = () => {
    desktop.tray.set(options()).catch((err) => console.warn('[research-tracker] 菜单栏项更新失败。', err))
  }
  const restartTicker = () => {
    if (ticker) clearInterval(ticker)
    ticker = useStore.getState().activeTimer ? setInterval(render, 1000) : null
  }
  await desktop.tray.set(options())
  restartTicker()
  unsubscribe = useStore.subscribe((state, prev) => {
    if (state.activeTimer === prev.activeTimer) return
    render()
    restartTicker()
  })
}

export async function disableTray(desktop: ClaudeDesktop): Promise<void> {
  stopFollowing()
  await desktop.tray.remove()
}
