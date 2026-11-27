import { useEffect, useRef, useState } from 'react'
import { Copy, RotateCcw, Square } from 'lucide-react'
import { useStore } from '@/lib/store'
import { todoWords, type PromptContext } from '@/lib/promptDraft'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { usePromptWriter, type WriteResult } from './usePromptWriter'

interface Props {
  projectId: string
  todoId: string
  onClose: () => void
}

/** 生成时用的材料：任务名、截止日、项目名，以及任务备注和关联到这个任务的笔记。任务已不存在时为 null。 */
function todoContext(projectId: string, todoId: string): PromptContext | null {
  const st = useStore.getState()
  const p = st.projects.find((x) => x.id === projectId)
  const t = p?.todos.find((x) => x.id === todoId)
  if (!p || !t) return null
  return {
    words: todoWords(t, st.notes),
    projectTitle: p.title || undefined,
    todoTitle: t.title || '未命名任务',
    todoDue: t.endDate || undefined,
  }
}

/**
 * 从任务生成一段交给 Claude 的提示词：打开即由内置的 Claude 生成，用户复制后自己打开 Claude 开始。
 */
export function TodoPromptDialog({ projectId, todoId, onClose }: Props) {
  const todo = useStore((s) => s.projects.find((p) => p.id === projectId)?.todos.find((t) => t.id === todoId))
  const ai = usePromptWriter({ startRunning: true })
  const [prompt, setPrompt] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)

  /** 生成结束后：成功时换成新的提示词；停止或失败时回到开始前的内容；被取代时不动。 */
  const settle = (before: string) => (result: WriteResult) => {
    if (result.kind === 'done') setPrompt(result.text)
    else if (result.kind !== 'superseded') setPrompt(before)
  }

  // 打开即生成一次，关闭时停止。sample 的请求在下一个微任务才发出，
  // 在同一段同步代码里被停止的请求不发送、不询问、不计用量（开发模式的二次挂载即如此）。
  const { write, stop } = ai
  useEffect(() => {
    const ctx = todoContext(projectId, todoId)
    if (ctx) {
      void write(ctx, setPrompt).then((result) => {
        if (result.kind === 'done') setPrompt(result.text)
        else if (result.kind !== 'superseded') setPrompt('')
      })
    }
    return stop
  }, [projectId, todoId, write, stop])

  useEffect(() => {
    if (!todo) onClose()
  }, [todo, onClose])
  if (!todo) return null

  const regenerate = () => {
    const ctx = todoContext(projectId, todoId)
    if (ctx) void write(ctx, setPrompt).then(settle(prompt))
  }

  const copy = () => {
    navigator.clipboard.writeText(prompt).then(
      () => {
        toast({ message: '已复制提示词' })
        onClose()
      },
      () => {
        area.current?.select()
        toast({ message: '已选中提示词，按 ⌘C 复制' })
      },
    )
  }

  const waiting = ai.running && !prompt
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="生成提示词"
      description={todo.title || '未命名任务'}
      size="lg"
    >
      <textarea
        ref={area}
        aria-label="提示词"
        value={waiting ? '' : prompt}
        placeholder={waiting ? '正在生成' : ''}
        readOnly={ai.running}
        onChange={(e) => setPrompt(e.target.value)}
        className={cn(
          'block max-h-[50dvh] min-h-40 w-full resize-y rounded-md bg-secondary px-2.5 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
          ai.running && 'text-muted-foreground',
        )}
      />
      {ai.error ? <p className="mt-2 text-xs text-destructive">{ai.error}</p> : null}
      <div className="mt-5 flex items-center gap-2">
        {ai.available ? (
          ai.running ? (
            <Button variant="ghost" onClick={stop}>
              <Square /> 停止
            </Button>
          ) : (
            <Button variant="ghost" onClick={regenerate}>
              <RotateCcw /> 重新生成
            </Button>
          )
        ) : null}
        <Button variant="primary" className="ml-auto" disabled={ai.running || !prompt.trim()} onClick={copy}>
          <Copy /> 复制
        </Button>
      </div>
    </Dialog>
  )
}
