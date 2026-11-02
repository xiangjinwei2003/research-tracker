import { useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { useStore } from '@/lib/store'
import { manualSessionError } from '@/lib/focus'
import { fmtMinutes, today } from '@/lib/date'
import { toast } from '@/lib/toast'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input, Label } from './ui/Input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

const FREE = 'free'

/** 绑定目标编码成 Select 的值：free、p:项目、t:项目:任务。 */
function decode(value: string): { projectId?: string; todoId?: string } {
  if (value.startsWith('p:')) return { projectId: value.slice(2) }
  if (value.startsWith('t:')) {
    const [projectId, todoId] = value.slice(2).split(':')
    return { projectId, todoId }
  }
  return {}
}

/** yyyy-MM-dd + HH:mm → 本地时间的 epoch ms；格式不对返回 NaN。 */
function toMs(iso: string, hm: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^\d{2}:\d{2}$/.test(hm)) return NaN
  return new Date(`${iso}T${hm}:00`).getTime()
}

/** 今天默认「最近半小时」，结束取整到 5 分钟；其他日子默认 09:00 到 09:30。 */
function defaultRange(iso: string): { start: string; end: string } {
  if (iso !== today()) return { start: '09:00', end: '09:30' }
  const now = new Date()
  const end = new Date(now)
  end.setMinutes(Math.floor(now.getMinutes() / 5) * 5, 0, 0)
  const start = new Date(Math.max(end.getTime() - 30 * 60_000, new Date(now).setHours(0, 0, 0, 0)))
  return { start: format(start, 'HH:mm'), end: format(end, 'HH:mm') }
}

interface Props {
  /** 打开时预填的日期（yyyy-MM-dd）；null 表示关闭。 */
  date: string | null
  onClose: () => void
}

/** 补记专注：计时器没开或忘了停时，事后填写开始、结束时间和关联任务。 */
export function ManualSessionDialog({ date, onClose }: Props) {
  return (
    <Dialog open={date !== null} onOpenChange={(o) => !o && onClose()} title="补记专注" size="md">
      {date !== null ? <Form key={date} initialDate={date} onClose={onClose} /> : null}
    </Dialog>
  )
}

function Form({ initialDate, onClose }: { initialDate: string; onClose: () => void }) {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const activeTimer = useStore((s) => s.activeTimer)
  const addManualSession = useStore((s) => s.addManualSession)

  const todayIso = today()
  const [iso, setIso] = useState(initialDate)
  const [start, setStart] = useState(() => defaultRange(initialDate).start)
  const [end, setEnd] = useState(() => defaultRange(initialDate).end)
  const [target, setTarget] = useState(FREE)
  // 「晚于现在」的判断需要当前时刻；弹窗开着时每 15 秒刷新一次，提交时再复查。
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const startedAt = toMs(iso, start)
  const endedAt = toMs(iso, end)
  const check = (at: number) =>
    manualSessionError({
      startedAt,
      endedAt,
      sessions,
      activeStartedAt: activeTimer?.startedAt,
      now: at,
    })
  const error = check(now)
  const minutes = error ? 0 : Math.round((endedAt - startedAt) / 60_000)

  const active = projects.filter((p) => !p.archived)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const at = Date.now()
    if (check(at)) {
      setNow(at)
      return
    }
    const s = addManualSession({ startedAt, endedAt, ...decode(target) })
    onClose()
    toast({ message: `已补记 ${fmtMinutes(Math.round((s.endedAt - s.startedAt) / 60_000))}专注` })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
        <div>
          <Label htmlFor="manual-date">日期</Label>
          <Input
            id="manual-date"
            type="date"
            max={todayIso}
            value={iso}
            onChange={(e) => setIso(e.target.value)}
            className="mono"
          />
        </div>
        <div>
          <Label htmlFor="manual-start">开始</Label>
          <Input
            id="manual-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mono"
          />
        </div>
        <div>
          <Label htmlFor="manual-end">结束</Label>
          <Input
            id="manual-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mono"
          />
        </div>
      </div>

      <div>
        <Label>任务</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-full" aria-label="关联任务">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-80">
            <SelectItem value={FREE}>自由专注</SelectItem>
            {active.map((p) => (
              <SelectGroup key={p.id}>
                <SelectItem value={`p:${p.id}`} className="font-medium">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.title || '未命名项目'}
                </SelectItem>
                {p.todos
                  .filter((t) => !t.done && t.title.trim())
                  .map((t) => (
                    <SelectItem key={t.id} value={`t:${p.id}:${t.id}`} className="pl-[22px]">
                      {t.title}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {error ? (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="button" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={!!error}>
          {error ? '记录' : `记录 ${fmtMinutes(minutes)}`}
        </Button>
      </div>
    </form>
  )
}
