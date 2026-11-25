import { useEffect, useRef, useState, type ReactNode } from 'react'
import App from '../App'
import { Button } from '@/components/ui/Button'
import { importJSON } from '@/lib/store'
import { LOGO_URL } from '@/lib/logo'
import { DATA_DIR, DATA_FILE } from './fileStore'
import {
  checkFileAccess,
  createData,
  openData,
  reasonOf,
  requestFileAccess,
  setAsideUnreadable,
  startBoot,
  type BootPhase,
} from './boot'

let firstBoot: Promise<BootPhase> | null = null

/** StrictMode 下 effect 会跑两次，启动流程只跑一次。 */
function bootOnce(): Promise<BootPhase> {
  firstBoot ??= startBoot().catch((err) => ({ kind: 'failed' as const, reason: reasonOf(err) }))
  return firstBoot
}

/** 桌面版入口：数据文件打开并水合之后才渲染应用。 */
export function ArtifactBoot() {
  const [phase, setPhase] = useState<BootPhase>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    void bootOnce().then((next) => {
      if (alive) setPhase(next)
    })
    return () => {
      alive = false
    }
  }, [])

  if (phase.kind === 'ready') return <App />
  return <BootScreen phase={phase} onPhase={setPhase} />
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <img src={LOGO_URL} alt="" className="size-7 rounded-md" />
          <h1 className="text-base font-semibold">Research Tracker</h1>
        </div>
        <div className="mt-4 grid gap-5">{children}</div>
      </div>
    </main>
  )
}

function Line({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-stretch gap-2">{children}</div>
}

function BootScreen({ phase, onPhase }: { phase: BootPhase; onPhase: (p: BootPhase) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installNote, setInstallNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /** 依次执行，失败时停在当前页并显示原因。 */
  const run = (step: () => Promise<BootPhase>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    // 放进 then 里执行：step 同步抛出的错误也变成拒绝，下面的 catch 与 finally 照常执行。
    Promise.resolve()
      .then(step)
      .then(onPhase)
      .catch((err) => setError(reasonOf(err)))
      .finally(() => setBusy(false))
  }

  const errorLine = error ? <p className="text-xs text-destructive">{error}</p> : null

  switch (phase.kind) {
    case 'loading':
      return <main className="min-h-dvh bg-background" />

    case 'install': {
      const desktop = phase.desktop
      if (phase.state === 'installed') {
        return (
          <Shell>
            <Line>已安装在这台电脑上，请从程序坞或启动台打开 Research Tracker。</Line>
          </Shell>
        )
      }
      if (phase.state === 'unavailable' || !desktop) {
        return (
          <Shell>
            <Line>这个页面只能在桌面应用里使用，可以在 Claude 桌面应用中安装为应用。</Line>
          </Shell>
        )
      }
      return (
        <Shell>
          <Line>{installNote ?? '安装为桌面应用后使用。'}</Line>
          <Actions>
            <Button
              variant="primary"
              onClick={() => {
                // install.request() 必须在点击里直接调用，前面不能有 await。
                desktop.install
                  .request()
                  .then((result) => {
                    if (result === 'installed') setInstallNote('已开始安装，完成后从程序坞打开。')
                    else if (result === 'unavailable' || result === 'failed')
                      setInstallNote('暂时无法安装，请在 Claude 桌面应用的 Artifact 菜单里选择 Install as app。')
                  })
                  .catch((err) => setError(reasonOf(err)))
              }}
            >
              安装为桌面应用
            </Button>
          </Actions>
          {errorLine}
        </Shell>
      )
    }

    case 'permission': {
      const { desktop } = phase
      if (phase.state === 'denied') {
        return (
          <Shell>
            <Line>读写本机文件的权限已被拒绝，数据无法保存。</Line>
            <Actions>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => run(() => desktop.permissions.manage().then(() => checkFileAccess(desktop)))}
              >
                打开权限设置
              </Button>
            </Actions>
            {errorLine}
          </Shell>
        )
      }
      if (phase.state === 'unavailable') {
        // desktop.d.ts：读写本机文件（full-access）只授予同一组织里发布的 Artifact；
        // 别的组织的账号打开分享来的应用时这项权限被拒绝，状态一直是 unavailable。
        // 另一种情况是 Claude 桌面应用当前选中的组织不是打开这个窗口时的组织，切回去就好。
        return (
          <Shell>
            <Line>
              这个窗口拿不到读写本机文件的权限。Claude 只把这项权限给同一组织里发布的应用：从别的账号分享来的应用，要用当前账号重新发布一份再安装；Claude 桌面应用切换到了别的组织时，切回原来的组织再打开。
            </Line>
            <Actions>
              <Button variant="primary" disabled={busy} onClick={() => run(() => requestFileAccess(desktop))}>
                {busy ? '正在检查' : '请求权限'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run(() => checkFileAccess(desktop))}>
                重新检查
              </Button>
            </Actions>
            {errorLine}
          </Shell>
        )
      }
      return (
        <Shell>
          <Line>数据保存在 {DATA_DIR}，需要允许读写本机文件。</Line>
          <Actions>
            <Button variant="primary" disabled={busy} onClick={() => run(() => requestFileAccess(desktop))}>
              允许读写文件
            </Button>
          </Actions>
          {errorLine}
        </Shell>
      )
    }

    case 'first-run': {
      const { desktop, backups } = phase
      const importText = (text: string) => run(() => createData(desktop, importJSON(text)))
      return (
        <Shell>
          <Line>数据文件将保存在 {DATA_DIR}。</Line>
          <Actions>
            {backups.map((b, i) => (
              <Button
                key={b.path}
                variant={i === 0 ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => run(async () => createData(desktop, importJSON(await desktop.fs.readFile(b.path, 'utf8'))))}
              >
                <span className="truncate">导入 {b.name}</span>
              </Button>
            ))}
            <Button
              variant={backups.length ? 'secondary' : 'primary'}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              选择备份文件
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => run(() => createData(desktop, null))}>
              从空白开始
            </Button>
          </Actions>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void file.text().then(importText, (err) => setError(reasonOf(err)))
            }}
          />
          {errorLine}
        </Shell>
      )
    }

    case 'unreadable': {
      const { desktop } = phase
      return (
        <Shell>
          <Line>数据文件无法读取：{phase.reason}。文件没有被改动。</Line>
          <p className="select-text break-all text-xs text-muted-foreground">{DATA_FILE}</p>
          <Actions>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                desktop.shell.showItemInFolder(DATA_FILE).catch((err) => setError(reasonOf(err)))
              }}
            >
              在访达中显示
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => run(() => openData(desktop))}>
              重新读取
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => run(() => setAsideUnreadable(desktop))}>
              改名保留原文件，重新开始
            </Button>
          </Actions>
          {errorLine}
        </Shell>
      )
    }

    case 'failed':
      return (
        <Shell>
          <Line>{phase.reason}</Line>
          <Actions>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => startBoot().catch((err) => ({ kind: 'failed' as const, reason: reasonOf(err) })))}
            >
              重试
            </Button>
          </Actions>
          {errorLine}
        </Shell>
      )

    case 'ready':
      return null
  }
}
