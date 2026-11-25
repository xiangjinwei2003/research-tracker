import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { getDesktop } from '@/platform/desktop'
import { DATA_FILE } from '@/platform/fileStore'
import { currentSettings, updateSettings, type DesktopSettings } from '@/platform/settings'
import { disableQuickNoteShortcut, enableQuickNoteShortcut, QUICK_NOTE_KEYS } from '@/platform/quickNote'
import { disableTray, enableTray } from '@/platform/tray'
import { applyWindowOptions, switchWindowMode } from '@/platform/windowMode'

type Perms = Record<ClaudeDesktop.Permission, ClaudeDesktop.PermissionState>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-t-[0.5px] border-border py-2 first:border-t-0">
      <span className="min-w-0 text-sm text-foreground">{label}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/**
 * 桌面应用设置。每个需要权限的功能都由这里的点击请求权限；被拒绝的显示「权限设置」，
 * 打开应用自己的权限对话框。
 */
export function DesktopSettingsDialog({ open, onOpenChange }: Props) {
  const desktop = getDesktop()
  const [perms, setPerms] = useState<Perms | null>(null)
  const [settings, setSettings] = useState<DesktopSettings>(currentSettings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !desktop) return
    let alive = true
    desktop.permissions.state().then((p) => {
      if (alive) setPerms(p)
    })
    return () => {
      alive = false
    }
  }, [open, desktop])

  if (!desktop) return null

  const run = (step: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    step()
      .catch((err) => setError(reasonOf(err)))
      .finally(() => {
        setSettings(currentSettings())
        void desktop.permissions.state().then(setPerms)
        setBusy(false)
      })
  }

  const manage = (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => desktop.permissions.manage())}>
      权限设置
    </Button>
  )

  const toggle = (
    on: boolean,
    permission: ClaudeDesktop.Permission,
    enable: () => Promise<void>,
    disable: () => Promise<void>,
  ) => {
    if (perms?.[permission] === 'denied') {
      return (
        <>
          <span className="text-xs text-muted-foreground">权限已拒绝</span>
          {manage}
        </>
      )
    }
    return on && perms?.[permission] === 'granted' ? (
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(disable)}>
        关闭
      </Button>
    ) : (
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(enable)}>
        开启
      </Button>
    )
  }

  const enableShortcut = async () => {
    const state = (await desktop.permissions.request(['shortcuts'])).shortcuts
    if (state !== 'granted') throw new Error('没有允许全局快捷键')
    if (!(await enableQuickNoteShortcut(desktop))) throw new Error(`${QUICK_NOTE_KEYS} 被其他应用占用`)
    await updateSettings({ quickNote: true })
  }
  const disableShortcut = async () => {
    await disableQuickNoteShortcut(desktop)
    await updateSettings({ quickNote: undefined })
  }
  const enableMenuBar = async () => {
    const state = (await desktop.permissions.request(['menu-bar']))['menu-bar']
    if (state !== 'granted') throw new Error('没有允许菜单栏项')
    await enableTray(desktop)
    await updateSettings({ menuBar: true })
  }
  const disableMenuBar = async () => {
    await disableTray(desktop)
    await updateSettings({ menuBar: undefined })
  }
  const setTitleBar = async (system: boolean) => {
    const next = await updateSettings({ systemTitleBar: system ? true : undefined })
    // 窗口会重建并重新加载页面。
    await applyWindowOptions(desktop, next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="桌面应用设置" size="md">
      <div className="grid">
        <Row label={`全局快捷键 ${QUICK_NOTE_KEYS} 记一条笔记`}>
          {toggle(!!settings.quickNote, 'shortcuts', enableShortcut, disableShortcut)}
        </Row>
        <Row label="菜单栏显示专注倒计时">
          {toggle(!!settings.menuBar, 'menu-bar', enableMenuBar, disableMenuBar)}
        </Row>
        <Row label="置顶笔记小窗">
          {perms?.overlay === 'denied' ? (
            <>
              <span className="text-xs text-muted-foreground">权限已拒绝</span>
              {manage}
            </>
          ) : (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => switchWindowMode(desktop, 'compact'))}>
              切换
            </Button>
          )}
        </Row>
        <Row label="系统标题栏">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setTitleBar(!settings.systemTitleBar))}>
            {settings.systemTitleBar ? '改为隐藏' : '改为显示'}
          </Button>
        </Row>
        <Row label="数据文件">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => desktop.shell.showItemInFolder(DATA_FILE).catch((err) => setError(reasonOf(err)))}
          >
            在访达中显示
          </Button>
        </Row>
        {error ? <p className="pt-2 text-xs text-destructive">{error}</p> : null}
      </div>
    </Dialog>
  )
}
