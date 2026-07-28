import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Plus,
  Trash2,
  Check,
  Square,
  Archive,
  ArchiveRestore,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Paintbrush,
  RotateCcw,
} from 'lucide-react'
import {
  ROLES,
  PRESET_VENUES,
  STAGE_COLOR_PRESETS,
  PROJECT_COLOR_PRESETS,
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
import { today, daysUntil } from '@/lib/date'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input, Label, Textarea } from './ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Collapsible } from './ui/Collapsible'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/DropdownMenu'
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

  // Collapsed-section summaries: the key fact stays visible without expanding.
  const venueSummary: ReactNode = project.venue ? (
    <>
      {project.venue.name || '未命名'} · {project.venue.deadline || '未定截止'}
      {(() => {
        const d = project.venue.deadline ? daysUntil(project.venue.deadline) : null
        if (d == null) return null
        return (
          <span
            className={cn(
              'ml-1.5',
              d < 0
                ? 'font-medium text-destructive'
                : d <= 14
                  ? 'font-medium text-warn'
                  : '',
            )}
          >
            {d < 0 ? `逾期 ${-d} 天` : d === 0 ? '今天截止' : `还剩 ${d} 天`}
          </span>
        )
      })()}
    </>
  ) : (
    '未设置'
  )

  const currentStageName =
    project.stages.find((s) => s.id === project.stage)?.name ?? '未指定'
  const stageSummary = `${project.stages.length} 个阶段 · 当前：${currentStageName}`

  const waitingOn = project.collaborators.find((c) => c.waitingFor.trim())
  const collabSummary =
    project.collaborators.length === 0
      ? '无'
      : `${project.collaborators.length} 人${
          waitingOn ? ` · 等待：${waitingOn.waitingFor.trim().slice(0, 12)}` : ''
        }`

  const notesFirstLine = project.notes.trim().split('\n')[0] ?? ''
  const notesSummary = notesFirstLine
    ? notesFirstLine.length > 24
      ? `${notesFirstLine.slice(0, 24)}…`
      : notesFirstLine
    : '无'

  const activeTodoCount = project.todos.filter((t) => !t.done).length

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
      size="xl"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* 身份栏：项目是谁 */}
        <div className="space-y-4 lg:border-r lg:border-border lg:pr-6">
          <div>
            <Label htmlFor="title">项目名称</Label>
            <div className="flex items-center gap-2">
              <ProjectColorPicker
                value={project.color}
                onChange={(color) => updateProject(project.id, { color })}
              />
              <Input
                id="title"
                className="flex-1"
                value={project.title}
                onChange={(e) => updateProject(project.id, { title: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="desc">一句话描述</Label>
            <Input
              id="desc"
              value={project.description}
              onChange={(e) => updateProject(project.id, { description: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="stage">当前阶段</Label>
              <Select
                value={project.stage}
                onValueChange={(v) => updateProject(project.id, { stage: v as Stage })}
              >
                <SelectTrigger id="stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
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

          {/* Rarely-edited config folds away; summaries keep the key facts visible. */}
          <Collapsible title="投稿目标" summary={venueSummary}>
            {hasVenue && project.venue ? (
              <div className="space-y-3">
                <div className="space-y-3">
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
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => updateProject(project.id, { venue: undefined })}
                >
                  <Trash2 size={13} /> 移除投稿目标
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateProject(project.id, { venue: { name: 'CHI', deadline: today() } })
                }
              >
                <Plus size={14} /> 设置投稿目标
              </Button>
            )}
          </Collapsible>
        </div>

        {/* 工作栏：项目正在做什么 */}
        <div className="space-y-4">
          {/* 待办 — the dialog's primary body (config folds away below). */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-foreground">待办</h3>
              <span className="mono text-faint">{activeTodoCount} 项未完成</span>
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label="待办批量操作"
                    title="待办批量操作"
                  >
                    <MoreHorizontal size={15} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={onApplyStage}>
                      <Paintbrush size={14} /> 全部对齐项目阶段
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <QuickAddTodo onAdd={(title) => addTodo(project.id, { title })} />
            <TodoList
              todos={project.todos}
              stages={project.stages}
              onChange={handleTodoChange}
              onRemove={handleTodoRemove}
              onReorder={handleTodoReorder}
            />
          </div>

          <Collapsible title="研究阶段" summary={stageSummary}>
            <p className="mb-2 text-[11px] text-faint">
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
          </Collapsible>

          <Collapsible title="合作者" summary={collabSummary}>
            <div className="space-y-2">
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
          </Collapsible>

          <Collapsible title="备注" summary={notesSummary}>
            <Textarea
              placeholder="给未来的自己留个 note"
              aria-label="备注"
              value={project.notes}
              onChange={(e) => updateProject(project.id, { notes: e.target.value })}
            />
          </Collapsible>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
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
        <div className="text-xs text-faint">改动已自动保存</div>
      </div>
    </Dialog>
  )
}

/* ---------- Create new project: local draft, Save on confirm ---------- */

type Draft = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>

function emptyDraft(color: string): Draft {
  const stages = defaultStages()
  return {
    title: '',
    description: '',
    color,
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
  const projectCount = useStore((s) => s.projects.length)
  // Pre-select the next palette hue so a new project starts with a distinct
  // accent (still changeable via the swatch before saving).
  const nextColor = () => PROJECT_COLOR_PRESETS[projectCount % PROJECT_COLOR_PRESETS.length]
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(nextColor()))
  const [prevOpen, setPrevOpen] = useState(open)

  // Reset the draft each time the dialog (re)opens. Done during render rather
  // than in an effect so the fresh form is ready on the first paint.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setDraft(emptyDraft(nextColor()))
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
          <div className="flex items-center gap-2">
            <ProjectColorPicker
              value={draft.color}
              onChange={(color) => setDraft({ ...draft, color })}
            />
            <Input
              id="new-title"
              className="flex-1"
              autoFocus
              placeholder="例如：AI 写作助手对研究者工作流的影响"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && draft.title.trim()) save()
              }}
            />
          </div>
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
              value={draft.stage}
              onValueChange={(v) => setDraft({ ...draft, stage: v as Stage })}
            >
              <SelectTrigger id="new-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {draft.stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
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
        <p className="text-[11px] text-faint">
          新项目默认会带上 9 个常用研究阶段（文献调研 → 完成/搁置）。创建后可在编辑页里改名、增删或重排。
        </p>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
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
        value={value.role}
        onValueChange={(v) => onChange({ role: v as Collaborator['role'] })}
      >
        <SelectTrigger className="col-span-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
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
        isDropTarget && 'border-brand-500/60 bg-brand-500/[0.06]',
      )}
    >
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground/90 active:cursor-grabbing"
        aria-label="拖拽以重排"
        title="拖拽以重排"
      >
        <GripVertical size={16} />
      </button>
      <Popover open={palOpen} onOpenChange={setPalOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-border transition hover:ring-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            style={{ background: value.color }}
            aria-label="改阶段颜色"
            title="改阶段颜色"
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-6 gap-1.5">
            {STAGE_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange({ color: c })
                  setPalOpen(false)
                }}
                className="h-5 w-5 rounded-full ring-1 ring-inset ring-border transition hover:scale-110 hover:ring-ring"
                style={{ background: c }}
                aria-label={`选择颜色 ${c}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
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
        placeholder="输入待办，回车添加"
        aria-label="快速添加待办"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
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
        aria-label="添加待办"
        title="添加待办"
      >
        <Plus size={15} />
      </Button>
    </div>
  )
}

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

  // 已完成 todos fold away so past work stops crowding the daily list.
  const [doneOpen, setDoneOpen] = useState(false)
  const active = ordered.filter((t) => !t.done)
  const done = ordered.filter((t) => t.done)

  if (todos.length === 0) {
    return (
      <p className="mt-2 text-xs text-faint">还没有待办，输入内容回车即可添加。</p>
    )
  }

  const renderRow = (todo: Todo) => (
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
  )

  return (
    <div className="mt-2 space-y-1.5">
      {active.map(renderRow)}
      {active.length === 0 ? (
        <p className="px-1 py-1.5 text-xs text-faint">没有未完成的待办。</p>
      ) : null}
      {done.length > 0 ? (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
            className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
        isDropTarget && 'border-brand-500/60 bg-brand-500/[0.06]',
        value.done && 'opacity-55',
      )}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, id)}
        className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground/90 active:cursor-grabbing"
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
            ? 'border-success bg-success text-[#0b0c10]'
            : 'border-[#3a3e4d] text-faint hover:border-white/25',
        )}
        aria-label={value.done ? '标记为未完成' : '标记为已完成'}
      >
        {value.done ? <Check size={14} /> : <Square size={14} />}
      </button>
      <label
        className="relative inline-flex shrink-0 cursor-pointer items-center rounded border border-white/10 bg-panel px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
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
