import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  Check,
  Square,
  Archive,
  ArchiveRestore,
  GripVertical,
  Paintbrush,
  RotateCcw,
} from 'lucide-react'
import {
  ROLES,
  PRESET_VENUES,
  STAGE_COLOR_PRESETS,
  defaultStages,
  findStage,
  todoPriority,
  type Collaborator,
  type Todo,
  type Priority,
  type Project,
  type Stage,
  type StageDef,
} from '@/lib/types'
import { today } from '@/lib/date'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input, Label, Select, Textarea } from './ui/Input'
import { PriorityButton } from './PriorityButton'
import { cn } from '@/lib/cn'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, edit this project (autosave); otherwise create new. */
  project?: Project | null
}

export function ProjectDialog({ open, onOpenChange, project }: Props) {
  if (project) {
    return (
      <EditDialog
        key={project.id}
        projectId={project.id}
        open={open}
        onOpenChange={onOpenChange}
      />
    )
  }
  return <CreateDialog open={open} onOpenChange={onOpenChange} />
}

/* ---------- Edit existing project: autosave, no Save button ---------- */

function EditDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))
  const updateProject = useStore((s) => s.updateProject)
  const removeProject = useStore((s) => s.removeProject)
  const archiveProject = useStore((s) => s.archiveProject)
  const addTodo = useStore((s) => s.addTodo)
  const updateTodo = useStore((s) => s.updateTodo)
  const removeTodo = useStore((s) => s.removeTodo)
  const reorderTodos = useStore((s) => s.reorderTodos)
  const applyStageToTodos = useStore((s) => s.applyProjectStageToTodos)
  const addCollaborator = useStore((s) => s.addCollaborator)
  const updateCollaborator = useStore((s) => s.updateCollaborator)
  const removeCollaborator = useStore((s) => s.removeCollaborator)
  const addProjectStage = useStore((s) => s.addProjectStage)
  const updateProjectStage = useStore((s) => s.updateProjectStage)
  const removeProjectStage = useStore((s) => s.removeProjectStage)
  const reorderProjectStages = useStore((s) => s.reorderProjectStages)
  const resetProjectStages = useStore((s) => s.resetProjectStages)
  const undo = useStore((s) => s.undo)

  // Stable handlers (keyed off the immutable `projectId` prop) so memoized
  // TodoRows only re-render the row that actually changed — not the whole list
  // on every keystroke.
  const handleTodoChange = useCallback(
    (id: string, patch: Partial<Todo>) => updateTodo(projectId, id, patch),
    [updateTodo, projectId],
  )
  const handleTodoRemove = useCallback(
    (id: string) => {
      const t = useStore
        .getState()
        .projects.find((p) => p.id === projectId)
        ?.todos.find((x) => x.id === id)
      const token = removeTodo(projectId, id)
      toast({
        message: `已删除待办「${t?.title || '未命名'}」`,
        action: { label: '撤销', onClick: () => undo(token) },
      })
    },
    [removeTodo, undo, projectId],
  )
  const handleTodoReorder = useCallback(
    (ids: string[]) => reorderTodos(projectId, ids),
    [reorderTodos, projectId],
  )

  if (!project) {
    return null
  }

  const hasVenue = !!project.venue
  const hasRebuttal = !!project.venue?.rebuttalAt

  const onDelete = () => {
    if (confirm(`确认删除「${project.title}」？可在 6 秒内点击撤销。`)) {
      const title = project.title
      const token = removeProject(project.id)
      onOpenChange(false)
      toast({
        message: `已删除项目「${title}」`,
        action: { label: '撤销', onClick: () => undo(token) },
      })
    }
  }

  const onToggleArchive = () => {
    const wasArchived = project.archived
    const token = archiveProject(project.id, !wasArchived)
    onOpenChange(false)
    toast({
      message: wasArchived ? `已取消归档「${project.title}」` : `已归档「${project.title}」`,
      action: { label: '撤销', onClick: () => undo(token) },
    })
  }

  const onApplyStage = () => {
    applyStageToTodos(project.id)
    toast({ message: '已将所有待办对齐项目当前阶段' })
  }

  const onResetStages = () => {
    if (
      confirm(
        '重置阶段列表会替换为默认 9 阶段。如果你定制过阶段名/颜色或新增过阶段，这些改动会丢失。继续？',
      )
    ) {
      resetProjectStages(project.id)
      toast({ message: '已重置阶段列表为默认' })
    }
  }

  const onRemoveStage = (stageId: string) => {
    if (project.stages.length <= 1) {
      alert('至少要保留一个阶段。')
      return
    }
    const usingProject = project.stage === stageId
    const usingTodos = project.todos.filter((t) => t.stage === stageId)
    const usageNote =
      usingTodos.length === 0 && !usingProject
        ? ''
        : `（当前${usingProject ? '项目主阶段' : ''}${usingProject && usingTodos.length > 0 ? ' + ' : ''}${usingTodos.length > 0 ? `${usingTodos.length} 个待办` : ''}使用此阶段，删除后将自动改为列表首位的阶段）`
    if (confirm(`删除此阶段？${usageNote}`)) {
      const reassignTo = project.stages.find((s) => s.id !== stageId)?.id
      if (reassignTo) removeProjectStage(project.id, stageId, reassignTo)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="编辑项目"
      description="改完即时保存。点 Esc 或关闭按钮即可退出。"
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">项目名称</Label>
          <Input
            id="title"
            value={project.title}
            onChange={(e) => updateProject(project.id, { title: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="desc">一句话描述</Label>
          <Input
            id="desc"
            value={project.description}
            onChange={(e) => updateProject(project.id, { description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="stage">当前阶段</Label>
            <Select
              id="stage"
              value={project.stage}
              onChange={(e) => updateProject(project.id, { stage: e.target.value as Stage })}
            >
              {project.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="start">项目起始日期</Label>
            <Input
              id="start"
              type="date"
              value={project.startDate}
              onChange={(e) => updateProject(project.id, { startDate: e.target.value })}
            />
          </div>
        </div>

        {/* Venue */}
        <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasVenue}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateProject(project.id, { venue: { name: 'CHI', deadline: today() } })
                  } else {
                    updateProject(project.id, { venue: undefined })
                  }
                }}
              />
              投稿目标
            </label>
          </legend>

          {hasVenue && project.venue ? (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>会议 / 期刊</Label>
                  <Input
                    list="venue-presets"
                    value={project.venue.name}
                    onChange={(e) =>
                      updateProject(project.id, {
                        venue: { ...project.venue!, name: e.target.value },
                      })
                    }
                  />
                  <datalist id="venue-presets">
                    {PRESET_VENUES.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label>投稿截止</Label>
                  <Input
                    type="date"
                    value={project.venue.deadline}
                    onChange={(e) =>
                      updateProject(project.id, {
                        venue: { ...project.venue!, deadline: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={hasRebuttal}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateProject(project.id, {
                          venue: { ...project.venue!, rebuttalAt: today() },
                        })
                      } else {
                        const { rebuttalAt: _rebuttal, ...rest } = project.venue!
                        updateProject(project.id, { venue: rest })
                      }
                    }}
                  />
                  有 rebuttal 阶段
                </label>
                {hasRebuttal ? (
                  <Input
                    className="mt-1.5"
                    type="date"
                    value={project.venue.rebuttalAt ?? ''}
                    onChange={(e) =>
                      updateProject(project.id, {
                        venue: { ...project.venue!, rebuttalAt: e.target.value },
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </fieldset>

        {/* Todos (was 里程碑) — moved above stages + collaborators */}
        <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            待办
          </legend>
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onApplyStage}>
              <Paintbrush size={12} /> 全部对齐项目阶段
            </Button>
          </div>
          <TodoList
            todos={project.todos}
            stages={project.stages}
            onChange={handleTodoChange}
            onRemove={handleTodoRemove}
            onReorder={handleTodoReorder}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => addTodo(project.id)}
          >
            <Plus size={14} /> 添加待办
          </Button>
        </fieldset>

        {/* Stage editor */}
        <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            研究阶段
          </legend>
          <p className="mb-2 text-[11px] text-neutral-500 dark:text-neutral-500">
            每个项目自带一份阶段列表。改名、改色、增删、拖拽重排都只影响本项目。
          </p>
          <StageList
            stages={project.stages}
            onChange={(id, patch) => updateProjectStage(project.id, id, patch)}
            onRemove={onRemoveStage}
            onReorder={(ids) => reorderProjectStages(project.id, ids)}
          />
          <div className="mt-2 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addProjectStage(project.id)}
            >
              <Plus size={14} /> 添加阶段
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onResetStages}>
              <RotateCcw size={12} /> 重置为默认 9 阶段
            </Button>
          </div>
        </fieldset>

        {/* Collaborators */}
        <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            合作者
          </legend>
          <div className="mt-2 space-y-2">
            {project.collaborators.map((c) => (
              <CollaboratorRow
                key={c.id}
                value={c}
                onChange={(patch) => updateCollaborator(project.id, c.id, patch)}
                onRemove={() => {
                  const token = removeCollaborator(project.id, c.id)
                  toast({
                    message: `已移除合作者「${c.name || '未命名'}」`,
                    action: { label: '撤销', onClick: () => undo(token) },
                  })
                }}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addCollaborator(project.id)}
            >
              <Plus size={14} /> 添加合作者
            </Button>
          </div>
        </fieldset>

        <div>
          <Label htmlFor="notes">备注</Label>
          <Textarea
            id="notes"
            placeholder="给未来的自己留个 note"
            value={project.notes}
            onChange={(e) => updateProject(project.id, { notes: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
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
        <div className="text-xs text-neutral-400">改动已自动保存</div>
      </div>
    </Dialog>
  )
}

/* ---------- Create new project: local draft, Save on confirm ---------- */

type Draft = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>

function emptyDraft(): Draft {
  const stages = defaultStages()
  return {
    title: '',
    description: '',
    stage: stages[0].id,
    stages,
    startDate: today(),
    venue: undefined,
    collaborators: [],
    todos: [],
    notes: '',
  }
}

function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const addProject = useStore((s) => s.addProject)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [prevOpen, setPrevOpen] = useState(open)

  // Reset the draft each time the dialog (re)opens. Done during render rather
  // than in an effect so the fresh form is ready on the first paint.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setDraft(emptyDraft())
  }

  const save = () => {
    if (!draft.title.trim()) return
    addProject({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      notes: draft.notes.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建项目"
      description="先把项目名填了。其他字段稍后再补也行。"
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="new-title">项目名称 *</Label>
          <Input
            id="new-title"
            autoFocus
            placeholder="例如：AI 写作助手对研究者工作流的影响"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.title.trim()) save()
            }}
          />
        </div>
        <div>
          <Label htmlFor="new-desc">一句话描述</Label>
          <Input
            id="new-desc"
            placeholder="研究问题或核心方法"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="new-stage">当前阶段</Label>
            <Select
              id="new-stage"
              value={draft.stage}
              onChange={(e) => setDraft({ ...draft, stage: e.target.value as Stage })}
            >
              {draft.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-start">项目起始日期</Label>
            <Input
              id="new-start"
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </div>
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-500">
          新项目默认会带上 9 个常用研究阶段（文献调研 → 完成/搁置）。创建后可在编辑页里改名、增删或重排。
        </p>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button variant="primary" onClick={save} disabled={!draft.title.trim()}>
          创建
        </Button>
      </div>
    </Dialog>
  )
}

/* ---------- Subcomponents ---------- */

function CollaboratorRow({
  value,
  onChange,
  onRemove,
}: {
  value: Collaborator
  onChange: (patch: Partial<Collaborator>) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-12 items-start gap-2">
      <Input
        className="col-span-4"
        placeholder="姓名"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <Select
        className="col-span-2"
        value={value.role}
        onChange={(e) => onChange({ role: e.target.value as Collaborator['role'] })}
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      <Input
        className="col-span-5"
        placeholder="等什么？（留空 = 不在等）"
        value={value.waitingFor}
        onChange={(e) => onChange({ waitingFor: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="col-span-1"
        aria-label="移除合作者"
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

/* ---------- Stage editor ---------- */

function StageList({
  stages,
  onChange,
  onRemove,
  onReorder,
}: {
  stages: StageDef[]
  onChange: (id: string, patch: Partial<StageDef>) => void
  onRemove: (id: string) => void
  onReorder: (ids: string[]) => void
}) {
  const dragIdRef = useRef<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overId !== id) setOverId(id)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const draggedId = dragIdRef.current
    setOverId(null)
    dragIdRef.current = null
    if (!draggedId || draggedId === targetId) return
    const ids = stages.map((s) => s.id)
    const from = ids.indexOf(draggedId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, draggedId)
    onReorder(next)
  }

  return (
    <div className="space-y-1.5">
      {stages.map((s) => (
        <StageRow
          key={s.id}
          value={s}
          isDropTarget={overId === s.id}
          onDragStart={(e) => handleDragStart(e, s.id)}
          onDragOver={(e) => handleDragOver(e, s.id)}
          onDragLeave={() => setOverId((cur) => (cur === s.id ? null : cur))}
          onDragEnd={() => {
            setOverId(null)
            dragIdRef.current = null
          }}
          onDrop={(e) => handleDrop(e, s.id)}
          onChange={(patch) => onChange(s.id, patch)}
          onRemove={() => onRemove(s.id)}
        />
      ))}
    </div>
  )
}

function StageRow({
  value,
  isDropTarget,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}: {
  value: StageDef
  isDropTarget: boolean
  onChange: (patch: Partial<StageDef>) => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const [palOpen, setPalOpen] = useState(false)

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-transparent p-1 transition',
        isDropTarget && 'border-brand-400 bg-brand-50/50 dark:bg-brand-950/30',
      )}
    >
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        className="shrink-0 cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing dark:hover:text-neutral-300"
        aria-label="拖拽以重排"
        title="拖拽以重排"
      >
        <GripVertical size={16} />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setPalOpen((v) => !v)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-neutral-300 transition hover:ring-neutral-500 dark:ring-neutral-700"
          style={{ background: value.color }}
          aria-label="改阶段颜色"
          title="改阶段颜色"
        />
        {palOpen ? (
          <div
            className="absolute left-0 top-9 z-20 grid w-44 grid-cols-6 gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg animate-menu-in dark:border-neutral-700 dark:bg-neutral-800"
            onMouseLeave={() => setPalOpen(false)}
          >
            {STAGE_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange({ color: c })
                  setPalOpen(false)
                }}
                className="h-5 w-5 rounded-full ring-1 ring-inset ring-neutral-300 transition hover:scale-110 hover:ring-neutral-500 dark:ring-neutral-600"
                style={{ background: c }}
                aria-label={`选择颜色 ${c}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <Input
        className="min-w-0 flex-1"
        placeholder="阶段名称（如：文献调研）"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <Input
        className="w-24 shrink-0"
        placeholder="缩写"
        value={value.shortLabel}
        onChange={(e) => onChange({ shortLabel: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="移除阶段"
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

/* ---------- Todos ---------- */

function TodoList({
  todos,
  stages,
  onChange,
  onRemove,
  onReorder,
}: {
  todos: Todo[]
  stages: StageDef[]
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

  if (todos.length === 0) {
    return <p className="text-xs text-neutral-400">还没有待办。点下方按钮添加。</p>
  }

  return (
    <div className="space-y-1.5">
      {ordered.map((todo) => (
        <TodoRow
          key={todo.id}
          id={todo.id}
          value={todo}
          stages={stages}
          isDropTarget={overId === todo.id}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

interface TodoRowProps {
  id: string
  value: Todo
  stages: StageDef[]
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
  stages,
  isDropTarget,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}: TodoRowProps) {
  const stage = findStage(stages, value.stage)

  return (
    <div
      onDragOver={(e) => onDragOver(e, id)}
      onDragLeave={() => onDragLeave(id)}
      onDrop={(e) => onDrop(e, id)}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-transparent p-1 transition',
        isDropTarget && 'border-brand-400 bg-brand-50/50 dark:bg-brand-950/30',
        value.done && 'opacity-55',
      )}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, id)}
        className="shrink-0 cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing dark:hover:text-neutral-300"
        aria-label="拖拽以重排"
        title="拖拽以重排"
      >
        <GripVertical size={16} />
      </button>
      <button
        type="button"
        onClick={() => onChange(id, { done: !value.done })}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          value.done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-neutral-300 text-neutral-400 hover:border-neutral-400 dark:border-neutral-700',
        )}
        aria-label={value.done ? '标记为未完成' : '标记为已完成'}
      >
        {value.done ? <Check size={14} /> : <Square size={14} />}
      </button>
      <label
        className="relative inline-flex shrink-0 cursor-pointer items-center rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        title="所属研究阶段"
      >
        {stage.shortLabel || stage.name}
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value.stage}
          onChange={(e) => onChange(id, { stage: e.target.value as Stage })}
          aria-label="研究阶段"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Input
        className={cn('min-w-0 flex-1', value.done && 'line-through')}
        placeholder="待办内容"
        value={value.title}
        onChange={(e) => onChange(id, { title: e.target.value })}
      />
      <PriorityButton
        priority={todoPriority(value)}
        onChange={(p: Priority) => onChange(id, { priority: p })}
      />
      <Input
        className="w-[8.5rem] shrink-0"
        type="date"
        value={value.endDate}
        onChange={(e) => onChange(id, { endDate: e.target.value })}
        aria-label="结束日期"
        title="结束日期"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="移除待办"
        onClick={() => onRemove(id)}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
})
