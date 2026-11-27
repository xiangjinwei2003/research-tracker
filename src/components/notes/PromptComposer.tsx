import { useEffect, useRef, useState } from 'react'
import { Copy, SendHorizontal, Sparkles, Square, Undo2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { subtree } from '@/lib/notes'
import { today } from '@/lib/date'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { CLAUDE_PROMPT_MAX, claudeCodeNewUrl, isAbsoluteFolder } from '@/lib/claudeLink'
import { outlineText, taskFileContent, taskFilePrompt, taskFileTitle } from '@/lib/promptDraft'
import { getDesktop } from '@/platform/desktop'
import { openClaudeLink } from '@/platform/claudeCode'
import { expandHome, folderExists, writeTaskFile } from '@/platform/folders'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Label } from '../ui/Input'
import { FolderField } from '../FolderField'
import { usePromptWriter } from '../usePromptWriter'

interface Props {
  noteId: string
  onClose: () => void
}

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * 把一条笔记（连同子条目）转成提示词，发送到 Claude 桌面应用的新会话。
 * 桌面版可以用内置的 Claude 把笔记整理清楚，也可以写成项目里的任务文件、只把路径发过去。
 */
export function PromptComposer({ noteId, onClose }: Props) {
  const note = useStore((s) => s.notes.find((n) => n.id === noteId))
  const project = useStore((s) =>
    note?.projectId ? s.projects.find((p) => p.id === note.projectId) : undefined,
  )
  const todo = note?.todoId ? project?.todos.find((t) => t.id === note.todoId) : undefined
  const markNoteSent = useStore((s) => s.markNoteSent)
  const updateProject = useStore((s) => s.updateProject)

  const [prompt, setPrompt] = useState(() => outlineText(subtree(useStore.getState().notes, noteId)))
  const [folder, setFolder] = useState(() => {
    const st = useStore.getState()
    const n = st.notes.find((x) => x.id === noteId)
    return st.projects.find((p) => p.id === n?.projectId)?.folder ?? ''
  })
  const [original, setOriginal] = useState<string | null>(null)
  const [asFile, setAsFile] = useState(false)
  const [sending, setSending] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const ai = usePromptWriter()
  const { running, error, setError } = ai

  const desktop = getDesktop()
  const over = prompt.length > CLAUDE_PROMPT_MAX
  const fileMode = !!desktop && (asFile || over)
  const title = taskFileTitle(prompt)

  useEffect(() => {
    if (!note) onClose()
  }, [note, onClose])
  if (!note) return null

  const polish = async () => {
    if (!ai.available || running) return
    const before = prompt
    const result = await ai.write(
      { words: before, projectTitle: project?.title, todoTitle: todo?.title, todoDue: todo?.endDate },
      setPrompt,
    )
    if (result.kind === 'done') {
      setPrompt(result.text)
      setOriginal(before)
    } else if (result.kind !== 'superseded') {
      setPrompt(before)
    }
  }

  const send = async () => {
    if (sending || running) return
    const text = prompt.trim()
    if (!text) {
      setError('提示词是空的')
      return
    }
    setSending(true)
    setError(null)
    try {
      let dir = folder.trim()
      if (dir && desktop) dir = await expandHome(dir)
      if (dir && !isAbsoluteFolder(dir)) {
        throw new Error(desktop ? '工作目录需要是绝对路径' : '工作目录需要是以 / 开头的完整路径')
      }
      if (dir && desktop && !(await folderExists(dir))) throw new Error('工作目录不存在')
      let finalPrompt = text
      if (fileMode) {
        if (!dir) throw new Error('写成任务文件需要先填工作目录')
        const path = await writeTaskFile({
          folder: dir,
          date: today(),
          title,
          content: taskFileContent({ title, prompt: text, noteDate: note.date, createdOn: new Date() }),
        })
        finalPrompt = taskFilePrompt(path)
      }
      const how = await openClaudeLink(claudeCodeNewUrl({ prompt: finalPrompt, folder: dir || undefined }))
      markNoteSent(note.id, { at: Date.now(), folder: dir, prompt: finalPrompt })
      if (project && dir && dir !== project.folder) updateProject(project.id, { folder: dir })
      toast({
        message: how === 'opened' ? '已在 Claude 桌面应用中新建会话' : '已请求打开 Claude 桌面应用',
      })
      onClose()
    } catch (err) {
      setError(reasonOf(err))
    } finally {
      setSending(false)
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(prompt).then(
      () => toast({ message: '已复制提示词' }),
      () => {
        area.current?.select()
        toast({ message: '已选中提示词，按 ⌘C 复制' })
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="转为提示词" size="lg">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="composer-folder">工作目录</Label>
          <FolderField id="composer-folder" value={folder} onChange={setFolder} />
        </div>
        <div>
          <Label htmlFor="composer-prompt">提示词</Label>
          <textarea
            id="composer-prompt"
            ref={area}
            value={prompt}
            readOnly={running}
            onChange={(e) => {
              setPrompt(e.target.value)
              setOriginal(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send()
              }
            }}
            className={cn(
              'block max-h-[50dvh] min-h-48 w-full resize-y rounded-md border-[0.5px] border-transparent bg-secondary px-2.5 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
              running && 'text-muted-foreground',
            )}
          />
          <div className="mt-1.5 flex min-h-7 items-center gap-1">
            {ai.available ? (
              running ? (
                <Button variant="ghost" size="sm" onClick={ai.stop}>
                  <Square /> 停止整理
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => void polish()} disabled={!prompt.trim() || sending}>
                  <Sparkles /> AI 整理
                </Button>
              )
            ) : null}
            {original !== null && !running ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrompt(original)
                  setOriginal(null)
                }}
              >
                <Undo2 /> 恢复原文
              </Button>
            ) : null}
            <span className={cn('ml-auto text-xs tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}>
              {prompt.length} / {CLAUDE_PROMPT_MAX}
            </span>
          </div>
        </div>
        {desktop ? (
          <label className="flex items-start gap-2 text-sm text-secondary-foreground">
            <input
              type="checkbox"
              checked={fileMode}
              disabled={over}
              onChange={(e) => setAsFile(e.target.checked)}
              className="mt-[4px]"
            />
            <span className="grid min-w-0 gap-0.5">
              写成任务文件，新会话只收到文件路径
              {fileMode ? (
                <span className="break-all text-xs text-muted-foreground">
                  docs/tasks/{today()}_{title}.md
                </span>
              ) : null}
            </span>
          </label>
        ) : over ? (
          <p className="text-xs text-destructive">提示词超过 {CLAUDE_PROMPT_MAX} 个字符，请缩短。</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t-[0.5px] border-border pt-4">
        <Button variant="ghost" onClick={copy}>
          <Copy /> 复制
        </Button>
        <Button
          variant="primary"
          disabled={sending || running || (!desktop && over)}
          onClick={() => void send()}
        >
          <SendHorizontal /> 发送到 Claude Code
        </Button>
      </div>
    </Dialog>
  )
}
