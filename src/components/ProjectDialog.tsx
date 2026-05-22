import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  Check,
  Square,
  Archive,
  ArchiveRestore,
  GripVertical,
  Paintbrush,
} from 'lucide-react'
import {
  ROLES,
  STAGES,
  STAGE_BY_VALUE,
  PRESET_VENUES,
  type Collaborator,
  type Milestone,
  type Project,
  type Stage,
} from '@/lib/types'
import { today } from '@/lib/date'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input, Label, Select, Textarea } from './ui/Input'
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
  // Subscribe to the live project from the store, so external changes (undo) refresh the UI.
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))
  const updateProject = useStore((s) => s.updateProject)
  const removeProject = useStore((s) => s.removeProject)
  const archiveProject = useStore((s) => s.archiveProject)
  const addMilestone = useStore((s) => s.addMilestone)
  const updateMilestone = useStore((s) => s.updateMilestone)
  const removeMilestone = useStore((s) => s.removeMilestone)
  const reorderMilestones = useStore((s) => s.reorderMilestones)
  const applyStageToMilestones = useStore((s) => s.applyProjectStageToMilestones)
  const addCollaborator = useStore((s) => s.addCollaborator)
  const updateCollaborator = useStore((s) => s.updateCollaborator)
  const removeCollaborator = useStore((s) => s.removeCollaborator)
  const undo = useStore((s) => s.undo)

  if (!project) {
    return null
  }

  const hasVenue = !!project.venue
  const hasRebuttal = !!project.venue?.rebuttalAt

  const onDelete = () => {
    if (confirm(`确认删除「${project.title}」？可在 6 秒内点击撤销。`)) {
      const title = project.title
      removeProject(project.id)
      onOpenChange(false)
      toast({
        message: `已删除项目「${title}」`,
        action: { label: '撤销', onClick: () => undo() },
      })
    }
  }

  const onToggleArchive = () => {
    const wasArchived = project.archived
    archiveProject(project.id, !wasArchived)
    onOpenChange(false)
    toast({
      message: wasArchived ? `已取消归档「${project.title}」` : `已归档「${project.title}」`,
      action: { label: '撤销', onClick: () => undo() },
    })
  }

  const onApplyStage = () => {
    applyStageToMilestones(project.id)
    toast({ message: '已将所有里程碑改为项目当前阶段色' })
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
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
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
                  removeCollaborator(project.id, c.id)
                  toast({
                    message: `已移除合作者「${c.name || '未命名'}」`,
                    action: { label: '撤销', onClick: () => undo() },
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

        {/* Milestones */}
        <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            里程碑
          </legend>
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onApplyStage}>
              <Paintbrush size={12} /> 全部用项目阶段色
            </Button>
          </div>
          <MilestoneList
            milestones={project.milestones}
            projectStage={project.stage}
            onChange={(id, patch) => updateMilestone(project.id, id, patch)}
            onRemove={(id) => {
              const m = project.milestones.find((x) => x.id === id)
              removeMilestone(project.id, id)
              toast({
                message: `已删除里程碑「${m?.title || '未命名'}」`,
                action: { label: '撤销', onClick: () => undo() },
              })
            }}
            onReorder={(ids) => reorderMilestones(project.id, ids)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => addMilestone(project.id)}
          >
            <Plus size={14} /> 添加里程碑
          </Button>
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
  return {
    title: '',
    description: '',
    stage: 'literature',
    startDate: today(),
    venue: undefined,
    collaborators: [],
    milestones: [],
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

  useEffect(() => {
    if (open) setDraft(emptyDraft())
  }, [open])

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
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
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

function MilestoneList({
  milestones,
  projectStage,
  onChange,
  onRemove,
  onReorder,
}: {
  milestones: Milestone[]
  projectStage: Stage
  onChange: (id: string, patch: Partial<Milestone>) => void
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
    const ids = milestones.map((m) => m.id)
    const from = ids.indexOf(draggedId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, draggedId)
    onReorder(next)
  }

  if (milestones.length === 0) {
    return (
      <p className="text-xs text-neutral-400">还没有里程碑。点下方按钮添加。</p>
    )
  }

  return (
    <div className="space-y-1.5">
      {milestones.map((m) => (
        <MilestoneRow
          key={m.id}
          value={m}
          projectStage={projectStage}
          isDropTarget={overId === m.id}
          onDragStart={(e) => handleDragStart(e, m.id)}
          onDragOver={(e) => handleDragOver(e, m.id)}
          onDragLeave={() => setOverId((cur) => (cur === m.id ? null : cur))}
          onDragEnd={() => {
            setOverId(null)
            dragIdRef.current = null
          }}
          onDrop={(e) => handleDrop(e, m.id)}
          onChange={(patch) => onChange(m.id, patch)}
          onRemove={() => onRemove(m.id)}
        />
      ))}
    </div>
  )
}

interface MilestoneRowProps {
  value: Milestone
  projectStage: Stage
  isDropTarget: boolean
  onChange: (patch: Partial<Milestone>) => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
}

function MilestoneRow({
  value,
  projectStage,
  isDropTarget,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}: MilestoneRowProps) {
  const effectiveStage = STAGE_BY_VALUE[value.stage ?? projectStage]

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-transparent p-1 transition',
        isDropTarget && 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30',
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
      <button
        type="button"
        onClick={() => onChange({ done: !value.done })}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          value.done
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-neutral-300 text-neutral-400 hover:border-neutral-400 dark:border-neutral-700',
        )}
        aria-label={value.done ? '标记为未完成' : '标记为已完成'}
      >
        {value.done ? <Check size={14} /> : <Square size={14} />}
      </button>
      <label className="relative inline-flex shrink-0 items-center" title="里程碑阶段（选「跟随项目」继承项目阶段色）">
        <span
          className="inline-block h-5 w-5 rounded-full ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700"
          style={{ background: `var(${effectiveStage.colorVar})` }}
        />
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value.stage ?? ''}
          onChange={(e) =>
            onChange({ stage: e.target.value ? (e.target.value as Stage) : undefined })
          }
        >
          <option value="">跟随项目（{STAGE_BY_VALUE[projectStage].label}）</option>
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <Input
        className="min-w-0 flex-1"
        placeholder="里程碑名称"
        value={value.title}
        onChange={(e) => onChange({ title: e.target.value })}
      />
      <Input
        className="w-[8.5rem] shrink-0"
        type="date"
        value={value.startDate}
        onChange={(e) => onChange({ startDate: e.target.value })}
      />
      <Input
        className="w-[8.5rem] shrink-0"
        type="date"
        value={value.endDate}
        onChange={(e) => onChange({ endDate: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="移除里程碑"
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}
