import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Dialog } from './ui/Dialog'
import { Button, buttonVariants } from './ui/Button'
import { Input, Label } from './ui/Input'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import {
  disableSync,
  enableSync,
  regenerate,
  syncNow,
  webcalUrl,
  useCalendarSync,
} from '@/lib/calendarSync'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CalendarSubscribeDialog({ open, onOpenChange }: Props) {
  const { settings, phase, error } = useCalendarSync()
  const [busy, setBusy] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const enabled = settings?.enabled === true
  const url = settings?.icsUrl ? webcalUrl(settings.icsUrl) : ''

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ message: '已复制订阅地址' })
    } catch (err) {
      toast({ message: `复制失败：${err instanceof Error ? err.message : String(err)}` })
    }
  }

  let status: string
  if (!enabled) status = '同步未开启'
  else if (phase === 'syncing') status = '正在同步'
  else if (phase === 'unconfigured') status = `未配置：服务端没有连接存储（${error}）。需要在 Vercel 项目里创建 Upstash Redis 并连接。`
  else if (phase === 'error') status = `同步失败：${error}`
  else status = settings?.lastSyncAt ? `上次同步 ${fmtTime(settings.lastSyncAt)}` : '尚未同步'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setConfirmRegen(false)
        onOpenChange(o)
      }}
      title="订阅到苹果日历"
      description="苹果日历订阅一个地址，定时拉取这里有到期日、未完成的待办。日历里只读，不能回写。"
      size="md"
    >
      <div className="grid gap-5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <p
            className={cn(
              'min-w-0 text-[13px]',
              enabled && (phase === 'error' || phase === 'unconfigured')
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
            role="status"
          >
            {status}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {enabled && phase !== 'syncing' ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => syncNow(true))}>
                立即同步
              </Button>
            ) : null}
            <Button
              variant={enabled ? 'secondary' : 'primary'}
              size="sm"
              disabled={busy}
              onClick={() => void run(enabled ? disableSync : enableSync)}
            >
              {enabled ? '关闭同步' : '开启同步'}
            </Button>
          </div>
        </div>

        {settings && url ? (
          <div>
            <Label htmlFor="cal-sub-url">订阅地址</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="cal-sub-url"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button variant="ghost" size="icon" aria-label="复制订阅地址" onClick={() => void copy()}>
                <Copy />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {enabled ? (
                <a href={url} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2.5')}>
                  在日历中打开
                </a>
              ) : (
                <span />
              )}
              {confirmRegen ? (
                <span className="flex items-center gap-1">
                  <span className="text-[13px] text-muted-foreground">旧地址会失效</span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await regenerate()
                        setConfirmRegen(false)
                      })
                    }
                  >
                    确认重新生成
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(false)}>
                    取消
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRegen(true)}>
                  重新生成地址
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            改动会在几分钟内出现在日历里，不是即时的：苹果日历按自己的周期拉取。Mac 上可把自动刷新设为每 5 分钟；iPhone 的刷新时间由系统决定，可能更久。
          </p>
          <p>
            <span className="text-foreground">Mac</span>：点「在日历中打开」，或在日历 App 菜单选 文件 › 新建日历订阅 并粘贴地址。位置选「我的 Mac」时可以每 5 分钟刷新；选 iCloud 会同步到 iPhone，刷新时间由 iCloud 决定。
          </p>
          <p>
            <span className="text-foreground">iPhone</span>：设置 › 日历 › 日历账户 › 添加账户 › 其他 › 添加已订阅的日历，粘贴地址。不同 iOS 版本的入口名称可能略有不同。
          </p>
          <p>
            开启后，待办标题、到期日和项目名会存到本应用在 Vercel 上的存储里。知道这个地址的人都能读取，地址泄露时请重新生成。关闭同步会删除服务端数据。
          </p>
        </div>
      </div>
    </Dialog>
  )
}
