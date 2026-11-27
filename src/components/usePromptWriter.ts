import { useCallback, useEffect, useRef, useState } from 'react'
import { buildPromptInput, sampleErrorMessage, type PromptContext } from '@/lib/promptDraft'
import { getSample, useSample } from '@/platform/sample'

/**
 * 一次生成的结果。superseded：这一次已被新的一次或卸载取代，调用方不改任何状态；
 * stopped：用户停止；failed：出错，原因已写进 error。
 */
export type WriteResult =
  | { kind: 'done'; text: string }
  | { kind: 'stopped' }
  | { kind: 'failed' }
  | { kind: 'superseded' }

/**
 * 用内置的 Claude（sample 能力，计入用户自己的套餐）写提示词。笔记的「AI 整理」与任务的「生成提示词」共用。
 * 同一时间只有一次生成：新的一次开始时停止上一次；组件卸载时停止，不再为剩下的部分花额度。
 * 只有当前这一次的进度、结果和错误会写回界面。
 */
export function usePromptWriter({ startRunning = false }: { startRunning?: boolean } = {}) {
  /** startRunning：打开即生成的界面，第一次渲染就显示为生成中。 */
  const [running, setRunning] = useState(startRunning)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const sampleReady = useSample() !== null

  useEffect(() => () => ctl.current?.abort(), [])

  /** 流式写入 onPartial（每次给出目前为止的全文）。 */
  const write = useCallback(
    async (ctx: PromptContext, onPartial: (text: string) => void): Promise<WriteResult> => {
      const sample = getSample()
      if (!sample) {
        setRunning(false)
        setError('当前环境不能调用 Claude')
        return { kind: 'failed' }
      }
      ctl.current?.abort()
      const controller = new AbortController()
      ctl.current = controller
      setRunning(true)
      setError(null)
      try {
        const { text } = await sample(buildPromptInput(ctx), {
          modelTier: 'default',
          cache: false,
          signal: controller.signal,
          onText: ({ text: partial }) => {
            if (ctl.current === controller) onPartial(partial)
          },
        })
        return ctl.current === controller ? { kind: 'done', text: text.trim() } : { kind: 'superseded' }
      } catch (err) {
        if (ctl.current !== controller) return { kind: 'superseded' }
        const { code, reason } = (err ?? {}) as { code?: string; reason?: string }
        if (code === 'cancelled') return { kind: 'stopped' }
        const shown = sampleErrorMessage(code, reason)
        setError(shown.message)
        if (shown.hide) setHidden(true)
        return { kind: 'failed' }
      } finally {
        if (ctl.current === controller) {
          ctl.current = null
          setRunning(false)
        }
      }
    },
    [],
  )

  const stop = useCallback(() => ctl.current?.abort(), [])

  return {
    /** 这次打开期间能否使用：网页版、没有授权或账号不能用时为 false。 */
    available: !hidden && sampleReady,
    running,
    error,
    setError,
    write,
    stop,
  }
}
