import { toast } from '@/lib/toast'
import { appIconPng } from './icons'
import { enableQuickNoteShortcut, QUICK_NOTE_KEYS, requestQuickNote } from './quickNote'
import { currentSettings } from './settings'
import { enableTray } from './tray'
import { switchWindowMode } from './windowMode'

/** 启动过程中要告诉用户的事（例如设置文件读不出、窗口选项没生效），应用渲染后用通知显示。 */
const notices: string[] = []

export function pushNotice(message: string): void {
  notices.push(message)
}

export function takeNotices(): string[] {
  return notices.splice(0, notices.length)
}

/** 应用菜单（窗口在前台时的 macOS 菜单栏）。保留 editMenu，否则 ⌘C、⌘V、⌘X 不起作用。 */
function applicationMenu(desktop: ClaudeDesktop): ClaudeDesktop.MenuItem[] {
  const compact = currentSettings().windowMode === 'compact'
  return [
    { role: 'editMenu' },
    {
      label: '笔记',
      submenu: [{ label: '记一条笔记', accelerator: 'CmdOrCtrl+Shift+N', click: () => requestQuickNote() }],
    },
    {
      label: '窗口',
      submenu: [
        {
          label: compact ? '回到完整窗口' : '置顶笔记小窗',
          click: () => {
            switchWindowMode(desktop, compact ? 'full' : 'compact').catch((err: unknown) =>
              toast({ message: err instanceof Error ? err.message : String(err) }),
            )
          },
        },
      ],
    },
  ]
}

let started = false

/**
 * 每次打开桌面版时运行一次：设置应用图标与应用菜单；用户开启过、且权限仍是允许的
 * 全局快捷键与菜单栏项重新打开（它们随窗口关闭或页面重载消失）。
 * 返回没能完成的项，由调用方显示。权限是「询问」状态的不在这里请求，只在设置里由点击请求。
 */
export async function startDesktopIntegration(desktop: ClaudeDesktop): Promise<string[]> {
  if (started) return []
  started = true
  const problems: string[] = []
  const reason = (err: unknown) => (err instanceof Error ? err.message : String(err))
  /** 每一步单独执行，同步抛出的错误也归到这一步，不影响其余步骤。 */
  const step = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action()
    } catch (err) {
      problems.push(`${label}：${reason(err)}`)
    }
  }

  await step('应用图标没有设置成功', async () => desktop.app.dock.setIcon(await appIconPng()))
  await step('应用菜单没有设置成功', () => desktop.Menu.setApplicationMenu(applicationMenu(desktop)))

  const settings = currentSettings()
  let perms: Record<ClaudeDesktop.Permission, ClaudeDesktop.PermissionState> | null = null
  await step('没有读到权限状态', async () => {
    perms = await desktop.permissions.state()
  })
  const granted = (name: ClaudeDesktop.Permission) =>
    (perms as Record<ClaudeDesktop.Permission, ClaudeDesktop.PermissionState> | null)?.[name] === 'granted'
  if (settings.quickNote && granted('shortcuts')) {
    await step('全局快捷键没有注册', async () => {
      if (!(await enableQuickNoteShortcut(desktop))) throw new Error(`${QUICK_NOTE_KEYS} 被其他应用占用`)
    })
  }
  if (settings.menuBar && granted('menu-bar')) {
    await step('菜单栏项没有打开', () => enableTray(desktop))
  }
  return problems
}
