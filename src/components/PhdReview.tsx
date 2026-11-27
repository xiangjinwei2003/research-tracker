import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays, format, isValid, parseISO } from 'date-fns'
import { ChevronDown, GraduationCap, Square } from 'lucide-react'
import { useStore } from '@/lib/store'
import { uid } from '@/lib/id'
import { cn } from '@/lib/cn'
import { today } from '@/lib/date'
import {
  buildAnalysisInput,
  dueDigest,
  extractJson,
  hoursOf,
  notesDigest,
  parseAnalysis,
  weekDigest,
  weekRange,
  type WeekDigest,
} from '@/lib/planAnalysis'
import { sampleErrorMessage } from '@/lib/promptDraft'
import { folderName } from '@/lib/claudeLink'
import type { AnalysisRecord } from '@/lib/types'
import { getDesktop } from '@/platform/desktop'
import { useSample } from '@/platform/sample'
import { expandHome } from '@/platform/folders'
import {
  PLAN_STATE_FILE,
  isPlanDir,
  readPlanSources,
  readProjectCommits,
} from '@/platform/planSources'
import { readSettings, updateSettings } from '@/platform/settings'
import { PageHeader } from './PageHeader'
import { Button } from './ui/Button'
import { FolderField } from './FolderField'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'

const STATUS_TONE: Record<string, string> = {
  完成: 'text-success',
  部分完成: 'text-today',
  未做: 'text-destructive',
}

/** 「11月23日至29日」；跨月时写全两端的月份。 */
function weekLabel(start: Date): string {
  const end = addDays(start, 6)
  const tail = end.getMonth() === start.getMonth() ? format(end, 'd日') : format(end, 'M月d日')
  return `${format(start, 'M月d日')}至${tail}`
}

/** 保存的时间可能被手工改过；不是合法日期时显示「时间未知」，不让 format 抛错。 */
function fmtTime(iso: string): string {
  const d = new Date(iso)
  return isValid(d) ? format(d, 'M月d日 HH:mm') : '时间未知'
}

const hoursText = (h: number | null) => (h === null ? '未知' : `${h} 小时`)

/**
 * 博士申请：本周各项目的专注、完成和笔记（不用 AI，随时可看），
 * 以及由内置的 Claude 结合申请计划目录、项目提交记录与本应用数据写的点评和建议（只在桌面版）。
 * 点评保存在数据里，之前的可以回看，不再花额度。
 */
export function PhdReview() {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const notes = useStore((s) => s.notes)
  const analyses = useStore((s) => s.analyses)
  const addAnalysis = useStore((s) => s.addAnalysis)

  const todayIso = today()
  const week = useMemo(() => weekRange(parseISO(todayIso)), [todayIso])
  const digest = useMemo(() => weekDigest(projects, sessions, notes, week), [projects, sessions, notes, week])
  const weekKey = format(week.start, 'yyyy-MM-dd')

  const [phase, setPhase] = useState<'idle' | 'reading' | 'thinking'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  /** undefined：还在读取设置；null：没有设置。 */
  const [planDir, setPlanDir] = useState<string | null | undefined>(undefined)
  const [editingDir, setEditingDir] = useState(false)
  const [dirDraft, setDirDraft] = useState('')
  const ctl = useRef<AbortController | null>(null)
  const sampleFn = useSample()
  const enabled = !!getDesktop() && !!sampleFn && !hidden

  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => {
    if (!getDesktop()) return
    let alive = true
    readSettings().then(
      (s) => {
        if (alive) setPlanDir(s.planDir ?? null)
      },
      (err) => {
        if (!alive) return
        setPlanDir(null)
        setError(err instanceof Error ? err.message : String(err))
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const shown = analyses.find((a) => a.id === viewId) ?? analyses[0]
  const choosing = enabled && (planDir === null || editingDir)
  const busy = phase !== 'idle'

  const saveDir = async () => {
    setError(null)
    try {
      const dir = await expandHome(dirDraft)
      if (!dir) throw new Error('先选择或填写申请计划所在的目录')
      if (!(await isPlanDir(dir))) throw new Error(`这个目录里没有 ${PLAN_STATE_FILE}`)
      await updateSettings({ planDir: dir })
      setPlanDir(dir)
      setEditingDir(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const run = async () => {
    const sample = sampleFn
    if (!planDir || !sample) return
    const controller = new AbortController()
    ctl.current = controller
    setError(null)
    setPhase('reading')
    try {
      const now = new Date()
      const range = weekRange(now)
      const st = useStore.getState()
      const current = weekDigest(st.projects, st.sessions, st.notes, range)
      const [sources, commits] = await Promise.all([
        readPlanSources(planDir),
        readProjectCommits(current.projects, range.start),
      ])
      if (controller.signal.aborted) return
      const input = buildAnalysisInput({
        ...sources,
        week: range,
        now,
        digest: current,
        commits,
        due: dueDigest(st.projects, now),
        notes: notesDigest(st.notes, range.start, range.end),
      })
      setPhase('thinking')
      const answer = await sample(input, { modelTier: 'default', cache: false, signal: controller.signal })
      const result = parseAnalysis(extractJson(answer.text))
      const record: AnalysisRecord = {
        id: uid(),
        createdAt: now.toISOString(),
        weekStart: format(range.start, 'yyyy-MM-dd'),
        tier: answer.modelTierApplied,
        sources: {
          review: sources.review?.name ?? null,
          scan: sources.scan.ok ? 'ok' : 'failed',
          ...(sources.scan.ok ? {} : { scanNote: sources.scan.reason }),
          commits: Object.values(commits).filter((c) => c.ok).length,
        },
        result,
      }
      addAnalysis(record)
      setViewId(record.id)
    } catch (err) {
      const { code, reason } = (err ?? {}) as { code?: string; reason?: string }
      if (code === 'cancelled') return
      if (code) {
        const shownError = sampleErrorMessage(code, reason)
        setError(shownError.message)
        if (shownError.hide) setHidden(true)
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (ctl.current === controller) ctl.current = null
      setPhase('idle')
    }
  }

  return (
    <main className="mx-auto w-full max-w-[66rem] px-4 pb-24 pt-2 sm:px-6 lg:pt-4">
      <PageHeader
        icon={GraduationCap}
        tint="text-pink-11"
        title="博士申请"
        subtitle={<span className="tabular-nums">{weekLabel(week.start)}</span>}
        actions={
          enabled ? (
            <>
              {analyses.length > 1 && !busy ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    之前的点评 <ChevronDown size={14} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {analyses.map((a) => (
                      <DropdownMenuItem key={a.id} onSelect={() => setViewId(a.id)}>
                        {fmtTime(a.createdAt)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {busy ? (
                <Button variant="ghost" onClick={() => ctl.current?.abort()}>
                  <Square /> 停止
                </Button>
              ) : (
                <Button variant="primary" disabled={!planDir || choosing} onClick={() => void run()}>
                  {analyses[0]?.weekStart === weekKey ? '重新生成点评' : '生成本周点评'}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <WeekTable digest={digest} />

      {enabled ? (
        <section aria-label="点评" className="mt-12">
          {choosing ? (
            <div className="grid max-w-xl gap-2 px-2">
              <label htmlFor="plan-dir" className="text-sm text-secondary-foreground">
                申请计划所在的目录（里面有 {PLAN_STATE_FILE}）
              </label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <FolderField id="plan-dir" value={dirDraft} onChange={setDirDraft} />
                </div>
                <Button variant="primary" onClick={() => void saveDir()}>
                  保存
                </Button>
                {editingDir ? (
                  <Button variant="ghost" onClick={() => setEditingDir(false)}>
                    取消
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {busy ? (
            <p className="px-2 text-sm text-muted-foreground">
              {phase === 'reading'
                ? '正在读取申请计划、项目提交记录和改动扫描'
                : 'Claude 正在写点评，通常需要半分钟到一分钟'}
            </p>
          ) : null}
          {error ? <p className="mt-2 px-2 text-xs text-destructive">{error}</p> : null}
          {shown && !busy && !choosing ? (
            <AnalysisView record={shown} current={shown.weekStart === weekKey} digest={digest} />
          ) : null}
          {planDir && !choosing && !busy ? (
            <p className="mt-6 flex items-center gap-2 px-2 text-xs text-muted-foreground">
              申请计划目录：{folderName(planDir)}
              <button
                type="button"
                onClick={() => {
                  setDirDraft(planDir)
                  setEditingDir(true)
                }}
                className="rounded-sm text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                更改
              </button>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

/** 节标题：与任务页的分组标题同一样式。 */
function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b-[0.5px] border-border px-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  )
}

/** 本周各项目与其他专注的汇总表，不需要 AI。 */
function WeekTable({ digest }: { digest: WeekDigest }) {
  const num = (n: number, text: string) => (
    <td className={cn('py-2 pr-2 text-right tabular-nums', n === 0 ? 'text-muted-foreground' : 'text-secondary-foreground')}>
      {text}
    </td>
  )
  const hours = (min: number) => num(min, `${hoursOf(min)} 小时`)
  const empty = digest.projects.length === 0 && digest.others.length === 0
  return (
    <section aria-label="本周" className="mt-8">
      <SectionHead title="本周">
        <span className="text-sm tabular-nums text-muted-foreground">
          专注 {hoursOf(digest.totalMinutes)} 小时，上周 {hoursOf(digest.prevTotalMinutes)} 小时
        </span>
      </SectionHead>
      {empty ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">还没有项目和专注记录</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pl-2 pr-3 font-medium">项目</th>
                <th className="w-24 py-2 pr-2 text-right font-medium">专注</th>
                <th className="w-24 py-2 pr-2 text-right font-medium">上周专注</th>
                <th className="w-16 py-2 pr-2 text-right font-medium">完成</th>
                <th className="w-16 py-2 pr-2 text-right font-medium">笔记</th>
              </tr>
            </thead>
            <tbody>
              {digest.projects.map((p) => (
                <tr key={p.id} className="border-t-[0.5px] border-border">
                  <td className="py-2 pl-2 pr-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="truncate text-foreground">{p.name}</span>
                    </span>
                  </td>
                  {hours(p.minutes)}
                  {hours(p.prevMinutes)}
                  {num(p.done.length, String(p.done.length))}
                  {num(p.notes.length, String(p.notes.length))}
                </tr>
              ))}
              {digest.others.map((o) => (
                <tr key={o.name} className="border-t-[0.5px] border-border">
                  <td className="py-2 pl-2 pr-3 text-secondary-foreground">
                    <span className="pl-4">{o.name}</span>
                  </td>
                  {hours(o.minutes)}
                  {hours(o.prevMinutes)}
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AnalysisView({
  record,
  current,
  digest,
}: {
  record: AnalysisRecord
  current: boolean
  digest: WeekDigest
}) {
  const { result, sources } = record
  const colorOf = new Map(digest.projects.map((p) => [p.name, p.color]))
  const start = parseISO(record.weekStart)
  const basis = [
    '当前状态.md',
    sources.review ? `周报 ${sources.review.replace(/\.md$/, '')}` : null,
    sources.commits ? `${sources.commits} 个项目目录的提交记录` : null,
    sources.scan === 'ok' ? '改动扫描' : null,
  ].filter(Boolean)

  return (
    // 列宽用 minmax(0, 1fr)：对照安排的表格有最小宽度，在窄窗口里只在自己的容器里横向滚动，不撑宽页面。
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div>
        <SectionHead title={current || !isValid(start) ? '点评' : `${weekLabel(start)}的点评`} />
        <p className="px-2 pt-3 text-base leading-7 text-foreground">{result.summary}</p>
      </div>

      {result.projects.length ? (
        <div>
          <SectionHead title="各项目" />
          <ul>
            {result.projects.map((row, i) => (
              <li key={i} className="grid gap-1 border-b-[0.5px] border-border px-2 py-3 last:border-b-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-muted-foreground"
                    style={colorOf.has(row.name) ? { background: colorOf.get(row.name) } : undefined}
                  />
                  {row.name}
                </p>
                {row.update ? <p className="pl-4 text-sm leading-6 text-muted-foreground">{row.update}</p> : null}
                {row.comment ? <p className="pl-4 text-sm leading-6 text-foreground">{row.comment}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.plan.length ? (
        <div>
          <SectionHead title="对照安排" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pl-2 pr-3 font-medium">项目</th>
                  <th className="py-2 pr-3 font-medium">计划</th>
                  <th className="py-2 pr-3 font-medium">实际</th>
                  <th className="py-2 pr-3 font-medium">情况</th>
                  <th className="py-2 pr-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {result.plan.map((row, i) => (
                  <tr key={i} className="border-t-[0.5px] border-border align-top">
                    <td className="py-2 pl-2 pr-3 text-foreground">{row.item}</td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-secondary-foreground">
                      {hoursText(row.plannedHours)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-secondary-foreground">
                      {hoursText(row.actualHours)}
                    </td>
                    <td className={cn('whitespace-nowrap py-2 pr-3', STATUS_TONE[row.status] ?? 'text-muted-foreground')}>
                      {row.status}
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result.issues.length ? (
        <div>
          <SectionHead title="问题与建议" />
          <ol className="grid gap-4 px-2 pt-3 text-sm">
            {result.issues.map((issue, i) => (
              <li key={i} className="grid gap-0.5">
                <p className="text-foreground">
                  {i + 1}. {issue.phenomenon}
                </p>
                {issue.impact ? <p className="pl-4 text-muted-foreground">影响：{issue.impact}</p> : null}
                {issue.suggestion ? <p className="pl-4 text-secondary-foreground">建议：{issue.suggestion}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {result.questions.length ? (
        <div>
          <SectionHead title="需要你回答的问题" />
          <ol className="grid gap-1.5 px-2 pt-3 text-sm text-secondary-foreground">
            {result.questions.map((q, i) => (
              <li key={i}>
                {i + 1}. {q}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <p className="px-2 text-xs text-muted-foreground">
        {fmtTime(record.createdAt)} 生成，依据：{basis.join('、')}
        {sources.scan === 'failed' ? `；改动扫描失败：${sources.scanNote ?? '原因未查明'}` : ''}
      </p>
    </div>
  )
}
