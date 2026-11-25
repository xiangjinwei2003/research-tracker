import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, GraduationCap, Square } from 'lucide-react'
import { useStore } from '@/lib/store'
import { uid } from '@/lib/id'
import { cn } from '@/lib/cn'
import {
  buildAnalysisInput,
  extractJson,
  focusDigest,
  notesDigest,
  parseAnalysis,
  taskDigest,
  weekRange,
} from '@/lib/planAnalysis'
import { sampleErrorMessage } from '@/lib/promptDraft'
import { folderName } from '@/lib/claudeLink'
import type { AnalysisRecord } from '@/lib/types'
import { getDesktop } from '@/platform/desktop'
import { getSample } from '@/platform/sample'
import { expandHome } from '@/platform/folders'
import { PLAN_STATE_FILE, isPlanDir, readPlanSources } from '@/platform/planSources'
import { readSettings, updateSettings } from '@/platform/settings'
import { Widget } from './Widget'
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

const hoursText = (h: number | null) => (h === null ? '未知' : `${h} 小时`)

/**
 * 按 PhD 申请计划分析本周（只在桌面版出现）：读取申请计划目录里的当前状态、导师规则、最新周报和改动扫描，
 * 加上本应用的专注、任务与笔记，交给 Claude 的 default 档，结果按导师周报的三节显示并保存。
 * 申请计划目录是本机设置，第一次使用时选择。
 */
export function PlanAnalysis({ className }: { className?: string }) {
  const analyses = useStore((s) => s.analyses)
  const addAnalysis = useStore((s) => s.addAnalysis)
  const [phase, setPhase] = useState<'idle' | 'reading' | 'thinking'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  /** undefined：还在读取设置；null：没有设置。 */
  const [planDir, setPlanDir] = useState<string | null | undefined>(undefined)
  const [editingDir, setEditingDir] = useState(false)
  const [dirDraft, setDirDraft] = useState('')
  const ctl = useRef<AbortController | null>(null)
  const enabled = !!getDesktop() && !!getSample()

  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => {
    if (!enabled) return
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
  }, [enabled])

  const sample = getSample()
  if (!enabled || !sample || hidden) return null
  const shown = analyses.find((a) => a.id === viewId) ?? analyses[0]
  const choosing = planDir === null || editingDir

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
    if (!planDir) return
    const controller = new AbortController()
    ctl.current = controller
    setError(null)
    setPhase('reading')
    try {
      const sources = await readPlanSources(planDir)
      if (controller.signal.aborted) return
      const now = new Date()
      const week = weekRange(now)
      const st = useStore.getState()
      const input = buildAnalysisInput({
        ...sources,
        week,
        now,
        focusThis: focusDigest(st.sessions, st.projects, week.start, week.end),
        focusPrev: focusDigest(st.sessions, st.projects, week.prevStart, week.start),
        tasks: taskDigest(st.projects, now, week.start),
        notes: notesDigest(st.notes, week.start, week.end),
      })
      setPhase('thinking')
      const answer = await sample(input, { modelTier: 'default', cache: false, signal: controller.signal })
      const result = parseAnalysis(extractJson(answer.text))
      const record: AnalysisRecord = {
        id: uid(),
        createdAt: now.toISOString(),
        weekStart: format(week.start, 'yyyy-MM-dd'),
        tier: answer.modelTierApplied,
        sources: {
          review: sources.review?.name ?? null,
          scan: sources.scan.ok ? 'ok' : 'failed',
          ...(sources.scan.ok ? {} : { scanNote: sources.scan.reason }),
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
      setPhase('idle')
    }
  }

  const busy = phase !== 'idle'
  return (
    <Widget
      title="按申请计划分析"
      icon={GraduationCap}
      tint="text-accent-foreground"
      className={className}
      aside={
        <div className="flex items-center gap-1">
          {analyses.length > 1 && !busy ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                之前的分析 <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {analyses.map((a) => (
                  <DropdownMenuItem key={a.id} onSelect={() => setViewId(a.id)}>
                    {format(new Date(a.createdAt), 'M月d日 HH:mm')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {busy ? (
            <Button variant="ghost" size="sm" onClick={() => ctl.current?.abort()}>
              <Square /> 停止
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={!planDir || choosing} onClick={() => void run()}>
              分析本周
            </Button>
          )}
        </div>
      }
    >
      {choosing ? (
        <div className="mt-3 grid gap-2">
          <label htmlFor="plan-dir" className="text-sm text-secondary-foreground">
            申请计划所在的目录（里面有 {PLAN_STATE_FILE}）
          </label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <FolderField id="plan-dir" value={dirDraft} onChange={setDirDraft} />
            </div>
            <Button variant="primary" size="md" onClick={() => void saveDir()}>
              保存
            </Button>
            {editingDir ? (
              <Button variant="ghost" size="md" onClick={() => setEditingDir(false)}>
                取消
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {busy ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {phase === 'reading' ? '正在读取申请计划、周报和改动扫描' : 'Claude 正在分析，通常需要半分钟到一分钟'}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      {shown && !busy && !choosing ? <AnalysisView record={shown} /> : null}
      {planDir && !choosing && !busy ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
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
    </Widget>
  )
}

function AnalysisView({ record }: { record: AnalysisRecord }) {
  const { result, sources } = record
  const basis = [
    '当前状态.md',
    sources.review ? `周报 ${sources.review.replace(/\.md$/, '')}` : null,
    sources.scan === 'ok' ? '改动扫描' : null,
  ].filter(Boolean)
  return (
    <div className="mt-3 grid gap-5">
      <p className="text-base leading-6 text-foreground">{result.summary}</p>

      {result.plan.length ? (
        <section aria-label="对照安排">
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">对照安排</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">项目</th>
                  <th className="py-1.5 pr-3 font-medium">计划</th>
                  <th className="py-1.5 pr-3 font-medium">实际</th>
                  <th className="py-1.5 pr-3 font-medium">情况</th>
                  <th className="py-1.5 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {result.plan.map((row, i) => (
                  <tr key={i} className="border-t-[0.5px] border-border align-top">
                    <td className="py-2 pr-3 text-foreground">{row.item}</td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-secondary-foreground">
                      {hoursText(row.plannedHours)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-secondary-foreground">
                      {hoursText(row.actualHours)}
                    </td>
                    <td className={cn('whitespace-nowrap py-2 pr-3', STATUS_TONE[row.status] ?? 'text-muted-foreground')}>
                      {row.status}
                    </td>
                    <td className="py-2 text-muted-foreground">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result.issues.length ? (
        <section aria-label="问题">
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">问题</h3>
          <ol className="grid gap-3 text-sm">
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
        </section>
      ) : null}

      {result.questions.length ? (
        <section aria-label="需要你回答的问题">
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">需要你回答的问题</h3>
          <ol className="grid gap-1.5 text-sm text-secondary-foreground">
            {result.questions.map((q, i) => (
              <li key={i}>
                {i + 1}. {q}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {format(new Date(record.createdAt), 'M月d日 HH:mm')} 生成，依据：{basis.join('、')}
        {sources.scan === 'failed' ? `；改动扫描失败：${sources.scanNote ?? '原因未查明'}` : ''}
      </p>
    </div>
  )
}
