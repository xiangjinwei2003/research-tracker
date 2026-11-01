import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronRight,
  GripVertical,
} from 'lucide-react'
import {
  PROJECT_COLOR_PRESETS,
  PROJECT_TAG_META,
  PROJECT_TAG_ORDER,
  todoPriority,
  type Todo,
  type Priority,
} from '@/lib/types'
import { today } from '@/lib/date'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { deleteTodo } from '@/lib/todoActions'
import { isSubmitEnter } from '@/lib/keyboard'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input, Textarea } from './ui/Input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Collapsible } from './ui/Collapsible'
import { PriorityButton } from './PriorityButton'
import { Checkbox } from './Checkbox'
import { DateButton } from './DateButton'
import { cn } from '@/lib/cn'

interface Props {
  projectId: string
  onClose: () => void
}

/** 项目详情：改动即时保存，没有保存按钮。 */
export function ProjectDialog({ projectId, onClose }: Props) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))
  const updateProject = useStore((s) => s.updateProject)
  const removeProject = useStore((s) => s.removeProject)
  const archiveProject = useStore((s) => s.archiveProject)
  const addTodo = useStore((s) => s.addTodo)
  const updateTodo = useStore((s) => s.updateTodo)
  const reorderTodos = useStore((s) => s.reorderTodos)
  const undo = useStore((s) => s.undo)

  // Stable handlers (keyed off the immutable `projectId` prop) so memoized
  // TodoRows only re-render the row that actually changed — not the whole list
  // on every keystroke.
  const handleTodoChange = useCallback(
    (id: string, patch: Partial<Todo>) => updateTodo(projectId, id, patch),
    [updateTodo, projectId],
  )
  const toggleProjectTag = useStore((s) => s.toggleProjectTag)
  const handleTodoRemove = useCallback(
    (id: string) => {
      const t = useStore
        .getState()
        .projects.find((p) => p.id === projectId)
        ?.todos.find((x) => x.id === id)
      deleteTodo(projectId, id, t?.title ?? '')
    },
    [projectId],
  )
  const handleTodoReorder = useCallback(
    (ids: string[]) => reorderTodos(projectId, ids),
    [reorderTodos, projectId],
  )

  if (!project) {
    return null
  }

  const notesFirstLine = project.notes.trim().split('\n')[0] ?? ''
  const notesSummary = notesFirstLine
    ? notesFirstLine.length > 24
      ? `${notesFirstLine.slice(0, 24)}…`
      : notesFirstLine
    : '无'

  const activeTodoCount = project.todos.filter((t) => !t.done).length

  // 删除有撤销通知和 Cmd+Z，不再额外弹确认框。
  const onDelete = () => {
    const title = project.title
    const token = removeProject(project.id)
    onClose()
    toast({
      message: `已删除项目「${title || '未命名项目'}」`,
      action: { label: '撤销', onClick: () => undo(token) },
    })
  }

  const onToggleArchive = () => {
    const wasArchived = project.archived
    const token = archiveProject(project.id, !wasArchived)
    onClose()
    toast({
      message: wasArchived ? `已取消归档「${project.title}」` : `已归档「${project.title}」`,
      action: { label: '撤销', onClick: () => undo(token) },
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="编辑项目" size="lg">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ProjectColorPicker
            value={project.color}
            onChange={(color) => updateProject(project.id, { color })}
          />
          <Input
            id="title"
            aria-label="项目名称"
            className="h-9 flex-1 text-base font-medium"
            value={project.title}
            onChange={(e) => updateProject(project.id, { title: e.target.value })}
          />
        </div>

        <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label="标签">
          {PROJECT_TAG_ORDER.map((tag) => {
            const meta = PROJECT_TAG_META[tag]
            const on = project.tags?.includes(tag) ?? false
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleProjectTag(project.id, tag)}
                className="h-6 rounded px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={
                  on
                    ? { backgroundColor: meta.bg, color: meta.text }
                    : { color: 'var(--faint)', boxShadow: 'inset 0 0 0 0.5px var(--input)' }
                }
              >
                {meta.label}
              </button>
            )
          })}
        </div>

        <div>
          <div className="flex items-baseline gap-2 border-b-[0.5px] border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">任务</h3>
            <span className="text-xs tabular-nums text-faint">{activeTodoCount} 项未完成</span>
          </div>
          <QuickAddTodo onAdd={(title) => addTodo(project.id, { title })} />
          <TodoList
            todos={project.todos}
            onChange={handleTodoChange}
            onRemove={handleTodoRemove}
            onReorder={handleTodoReorder}
          />
        </div>

        <Collapsible title="备注" summary={notesSummary}>
          <Textarea
            placeholder="写给自己的备注"
            aria-label="备注"
            value={project.notes}
            onChange={(e) => updateProject(project.id, { notes: e.target.value })}
          />
        </Collapsible>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t-[0.5px] border-border pt-4">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onToggleArchive}>
            {project.archived ? (
              <>
                <ArchiveRestore size={14} /> 取消归档
              </>
            ) : (
              <>
                <Archive size={14} /> 归档
              </>
            )}
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={14} /> 删除
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/* ---------- Subcomponents ---------- */

/**
 * Compact swatch + preset palette for the project's accent color. The chosen
 * color surfaces as a quiet spine in 本周重点 / 项目总览 so same-project cards group.
 */
function ProjectColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-border transition hover:ring-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          style={{ background: value || 'transparent' }}
          aria-label="项目颜色"
          title="项目颜色"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {PROJECT_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c)
                setOpen(false)
              }}
              className={cn(
                'h-5 w-5 rounded-full ring-inset transition hover:scale-110',
                value === c ? 'ring-2 ring-foreground' : 'ring-1 ring-border hover:ring-ring',
              )}
              style={{ background: c }}
              aria-label={`选择颜色 ${c}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---------- Todos ---------- */

/**
 * Todoist-style quick add: type → Enter → next one. Keeps focus for chained
 * entry; Enter during IME composition must NOT submit (Chinese input).
 */
function QuickAddTodo({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState('')
  const submit = () => {
    const title = value.trim()
    if (!title) return
    onAdd(title)
    setValue('')
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <Input
        value={value}
        placeholder="输入任务，回车添加"
        aria-label="快速添加任务"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitEnter(e)) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={submit}
        disabled={!value.trim()}
        aria-label="添加任务"
        title="添加任务"
      >
        <Plus size={15} />
      </Button>
    </div>
  )
}

function TodoList({
  todos,
  onChange,
  onRemove,
  onReorder,
}: {
  todos: Todo[]
  onChange: (id: string, patch: Partial<Todo>) => void
  onRemove: (id: string) => void
  onReorder: (ids: string[]) => void
}) {
  const dragIdRef = useRef<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Completed todos sink to the bottom; relative order within the done and
  // not-done groups is preserved (Array.prototype.sort is stable).
  const ordered = useMemo(
    () => todos.slice().sort((a, b) => Number(a.done) - Number(b.done)),
    [todos],
  )
  // Live ref so the stable drop handler always reorders against the order the
  // user actually sees, without needing `ordered` in its dependency list.
  const orderedRef = useRef(ordered)
  useEffect(() => {
    orderedRef.current = ordered
  }, [ordered])

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverId((cur) => (cur === id ? cur : id))
  }, [])

  const handleDragLeave = useCallback((id: string) => {
    setOverId((cur) => (cur === id ? null : cur))
  }, [])

  const handleDragEnd = useCallback(() => {
    setOverId(null)
    dragIdRef.current = null
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      const draggedId = dragIdRef.current
      setOverId(null)
      dragIdRef.current = null
      if (!draggedId || draggedId === targetId) return
      const dragged = orderedRef.current.find((todo) => todo.id === draggedId)
      const target = orderedRef.current.find((todo) => todo.id === targetId)
      if (!dragged || !target || dragged.done !== target.done) return
      const ids = orderedRef.current.map((t) => t.id)
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      if (from < 0 || to < 0) return
      const next = [...ids]
      next.splice(from, 1)
      next.splice(to, 0, draggedId)
      onReorder(next)
    },
    [onReorder],
  )

  // 已完成 todos fold away so past work stops crowding the daily list.
  const [doneOpen, setDoneOpen] = useState(false)
  const active = ordered.filter((t) => !t.done)
  const done = ordered.filter((t) => t.done)

  if (todos.length === 0) {
    return (
      <p className="mt-2 text-xs text-faint">还没有任务，输入内容回车即可添加。</p>
    )
  }

  const renderRow = (todo: Todo) => (
    <TodoRow
      key={todo.id}
      id={todo.id}
      value={todo}
      isDropTarget={overId === todo.id}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      onChange={onChange}
      onRemove={onRemove}
    />
  )

  return (
    <div className="mt-2 space-y-1.5">
      {active.map(renderRow)}
      {active.length === 0 ? (
        <p className="px-1 py-1.5 text-xs text-faint">没有未完成的任务。</p>
      ) : null}
      {done.length > 0 ? (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
            className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              size={13}
              className={cn('transition-transform', doneOpen && 'rotate-90')}
            />
            已完成 <span className="tabular-nums">{done.length}</span>
          </button>
          {doneOpen ? <div className="mt-1 space-y-1.5">{done.map(renderRow)}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

interface TodoRowProps {
  id: string
  value: Todo
  isDropTarget: boolean
  onChange: (id: string, patch: Partial<Todo>) => void
  onRemove: (id: string) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDragLeave: (id: string) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent, id: string) => void
}

const TodoRow = memo(function TodoRow({
  id,
  value,
  isDropTarget,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}: TodoRowProps) {
  return (
    <div
      onDragOver={(e) => onDragOver(e, id)}
      onDragLeave={() => onDragLeave(id)}
      onDrop={(e) => onDrop(e, id)}
      onDragEnd={onDragEnd}
      className={cn(
        'group flex flex-col gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-hover sm:flex-row sm:items-center',
        isDropTarget && 'bg-accent/50 shadow-[inset_0_0_0_1px_var(--ring)]',
        value.done && 'opacity-55',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          draggable
          onDragStart={(e) => onDragStart(e, id)}
          className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center text-faint opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
          aria-label="拖拽以重排"
          title="拖拽以重排"
        >
          <GripVertical size={16} />
        </button>
        <Checkbox
          checked={value.done}
          onChange={() => onChange(id, { done: !value.done })}
          label={value.done ? '标记为未完成' : '标记为已完成'}
          className="mx-1"
        />
        <Input
          className={cn(
            'min-w-0 flex-1 bg-transparent hover:bg-transparent focus-visible:bg-muted',
            value.done && 'text-muted-foreground line-through',
          )}
          placeholder="任务内容"
          value={value.title}
          onChange={(e) => onChange(id, { title: e.target.value })}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <PriorityButton
          priority={todoPriority(value)}
          pending={value.pending}
          onChange={(p: Priority) => onChange(id, { priority: p })}
        />
        <DateButton
          value={value.endDate}
          todayIso={today()}
          onChange={(d) => onChange(id, { endDate: d })}
          className="sm:w-[5.5rem] sm:justify-end"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="移除任务"
          onClick={() => onRemove(id)}
          className="opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )
})
