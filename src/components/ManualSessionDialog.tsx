import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '@/lib/store'
import { manualSpan, recentLabels } from '@/lib/focus'
import { today } from '@/lib/date'
import { toast } from '@/lib/toast'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input, Label, Textarea } from './ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select'

const FREE = 'free'
const NEW = 'new'
const HOURS = Array.from({ length: 13 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

/**
 * 事项选择编码成 Select 的值：free 自由专注，new 新事项，l:名称 用过的自定义事项，
 * p:项目，t:项目:任务。
 */
function decode(value: string): { projectId?: string; todoId?: string; label?: string } {
  if (value.startsWith('l:')) return { label: value.slice(2) }
  if (value.startsWith('p:')) return { projectId: value.slice(2) }
  if (value.startsWith('t:')) {
    const [projectId, todoId] = value.slice(2).split(':')
    return { projectId, todoId }
  }
  return {}
}

/** 补记时长按填写的值原样显示，例如 1 小时 15 分钟。 */
function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h} 小时` : '', m ? `${m} 分钟` : ''].filter(Boolean).join(' ')
}

interface Props {
  /** 打开时预填的日期（yyyy-MM-dd）；null 表示关闭。 */
  date: string | null
  onClose: () => void
}

/** 补记专注：计时器没开或忘了点时，事后填写日期、时长、事项和备注。 */
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
  const addManualSession = useStore((s) => s.addManualSession)

  const todayIso = today()
  const [iso, setIso] = useState(initialDate)
  const [hours, setHours] = useState('0')
  const [mins, setMins] = useState('30')
  const [target, setTarget] = useState(FREE)
  const [newLabel, setNewLabel] = useState('')
  const [note, setNote] = useState('')
  // 今天的补记以现在为结束时刻；弹窗开着时每 15 秒刷新一次，提交时取当前时刻。
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const minutes = Number(hours) * 60 + Number(mins)
  const span = manualSpan({ iso, minutes, now })
  const labelMissing = target === NEW && !newLabel.trim()
  const error = 'error' in span ? span.error : null

  const labels = recentLabels(sessions)
  const active = projects.filter((p) => !p.archived)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const at = Date.now()
    const latest = manualSpan({ iso, minutes, now: at })
    if ('error' in latest || labelMissing) {
      setNow(at)
      return
    }
    const binding = target === NEW ? { label: newLabel } : decode(target)
    addManualSession({ ...latest, ...binding, note })
    onClose()
    toast({ message: `已补记 ${fmtDuration(minutes)}专注` })
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
          <Label>小时</Label>
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="w-full mono" aria-label="小时">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)} className="mono">
                  {String(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>分钟</Label>
          <Select value={mins} onValueChange={setMins}>
            <SelectTrigger className="w-full mono" aria-label="分钟">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)} className="mono">
                  {String(m).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>事项</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-full" aria-label="事项">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-80">
            <SelectItem value={FREE}>自由专注</SelectItem>
            {labels.map((l) => (
              <SelectItem key={l} value={`l:${l}`}>
                {l}
              </SelectItem>
            ))}
            <SelectItem value={NEW}>新事项</SelectItem>
            {active.length > 0 ? <SelectSeparator /> : null}
            {active.map((p) => [
              <SelectItem key={p.id} value={`p:${p.id}`} className="font-medium">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: p.color }} />
                {p.title || '未命名项目'}
              </SelectItem>,
              ...p.todos
                .filter((t) => !t.done && t.title.trim())
                .map((t) => (
                  <SelectItem key={t.id} value={`t:${p.id}:${t.id}`} className="pl-[22px]">
                    {t.title}
                  </SelectItem>
                )),
            ])}
          </SelectContent>
        </Select>
        {target === NEW ? (
          <Input
            autoFocus
            aria-label="新事项名称"
            placeholder="例如：英语"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="mt-2"
          />
        ) : null}
      </div>

      <div>
        <Label htmlFor="manual-note">备注</Label>
        <Textarea id="manual-note" value={note} onChange={(e) => setNote(e.target.value)} />
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
        <Button type="submit" variant="primary" disabled={!!error || labelMissing}>
          {error || minutes < 1 ? '记录' : `记录 ${fmtDuration(minutes)}`}
        </Button>
      </div>
    </form>
  )
}
