import { memo, useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Ellipsis, Link2, SendHorizontal, Trash2, X } from 'lucide-react'
import { format, isToday } from 'date-fns'
import { useStore } from '@/lib/store'
import type { NoteEntry } from '@/lib/types'
import { folderName } from '@/lib/claudeLink'
import { cn } from '@/lib/cn'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu'
import { NoteLinkPicker, type NoteLink } from './NoteLinkPicker'
import { useAutosize } from './useAutosize'

export interface NoteRowHandlers {
  register: (id: string, el: HTMLTextAreaElement | null) => void
  onText: (entry: NoteEntry, text: string, ghost: boolean) => void
  onKey: (entry: NoteEntry, e: KeyboardEvent<HTMLTextAreaElement>, ghost: boolean) => void
  onLink: (entry: NoteEntry, link: NoteLink | null) => void
  onDelete: (entry: NoteEntry) => void
  onCompose: (entry: NoteEntry) => void
}

interface Props {
  entry: NoteEntry
  /** 今天还没有笔记时预留的输入行：第一次输入才建笔记。 */
  ghost: boolean
  compact: boolean
  placeholder?: string
  handlers: NoteRowHandlers
}

const ICON_BUTTON =
  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover data-[state=open]:text-foreground'

export const NoteRow = memo(function NoteRow({ entry, ghost, compact, placeholder, handlers }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  useAutosize(ref, entry.text)
  const { register } = handlers
  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ref.current = el
      register(entry.id, el)
    },
    [register, entry.id],
  )

  const project = useStore((s) =>
    entry.projectId ? s.projects.find((p) => p.id === entry.projectId) : undefined,
  )
  const todo = entry.todoId ? project?.todos.find((t) => t.id === entry.todoId) : undefined
  const linked = !!entry.projectId
  const linkLabel = !project
    ? '关联的项目已删除'
    : entry.todoId && !todo
      ? '关联的任务已删除'
      : todo
        ? todo.title || '未命名任务'
        : project.title || '未命名项目'
  const current: NoteLink | undefined = entry.projectId
    ? { projectId: entry.projectId, todoId: entry.todoId }
    : undefined
  const sent = entry.sent ?? []
  const lastSent = sent[sent.length - 1]

  return (
    <li
      className="group relative flex items-start gap-2.5 rounded-md pr-1"
      style={{ paddingLeft: entry.level * (compact ? 16 : 24) }}
    >
      <span
        aria-hidden
        className={cn(
          'size-[5px] shrink-0 rounded-full bg-muted-foreground',
          compact ? 'mt-[8px]' : 'mt-[10px]',
          !entry.text && 'opacity-40',
        )}
      />
      <div className="min-w-0 flex-1">
        <textarea
          ref={setRef}
          rows={1}
          value={entry.text}
          placeholder={placeholder}
          aria-label="笔记内容"
          onChange={(e) => handlers.onText(entry, e.target.value, ghost)}
          onKeyDown={(e) => handlers.onKey(entry, e, ghost)}
          className={cn(
            'block w-full resize-none overflow-hidden bg-transparent text-foreground outline-none placeholder:text-muted-foreground',
            compact ? 'text-sm leading-5' : 'text-base leading-6',
          )}
        />
        {linked ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: project?.color ?? 'var(--muted-foreground)' }}
            />
            <span className="truncate">{linkLabel}</span>
            <button
              type="button"
              onClick={() => handlers.onLink(entry, null)}
              aria-label="取消关联"
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
        {lastSent ? (
          <div
            className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
            title={lastSent.prompt}
          >
            <SendHorizontal size={11} className="shrink-0" />
            <span className="shrink-0 tabular-nums">
              已发送 {format(lastSent.at, isToday(lastSent.at) ? 'HH:mm' : 'M月d日 HH:mm')}
            </span>
            {lastSent.folder ? <span className="truncate">{folderName(lastSent.folder)}</span> : null}
            {sent.length > 1 ? <span className="shrink-0">共 {sent.length} 次</span> : null}
          </div>
        ) : null}
      </div>
      {ghost ? null : (
        <div className="-my-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
          {entry.text.trim() ? (
            <button
              type="button"
              onClick={() => handlers.onCompose(entry)}
              className={ICON_BUTTON}
              aria-label="转为提示词"
              title="转为提示词（⌘↩）"
            >
              <SendHorizontal size={15} />
            </button>
          ) : null}
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger className={ICON_BUTTON} aria-label="关联任务" title="关联任务">
              <Link2 size={15} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              <NoteLinkPicker
                current={current}
                onSelect={(link) => {
                  setLinkOpen(false)
                  handlers.onLink(entry, link)
                }}
              />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger className={ICON_BUTTON} aria-label="更多操作">
              <Ellipsis size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem destructive onSelect={() => handlers.onDelete(entry)}>
                <Trash2 /> 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  )
})
