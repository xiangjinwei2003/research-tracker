import { useState, type FormEvent } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { boardGroup, groupPatch, type BoardGroup } from "@/lib/board";
import { toast } from "@/lib/toast";
import { deleteTodo } from "@/lib/todoActions";
import { isSubmitEnter } from "@/lib/keyboard";
import type { Project, Todo } from "@/lib/types";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input, Label, Textarea } from "./ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

/** 打开任务弹窗的目标：新建（可带默认项目和分组），或编辑某个已有任务。 */
export type TaskTarget =
  | { mode: "create"; projectId?: string; group: BoardGroup }
  | { mode: "edit"; todoId: string };

interface Props {
  target: TaskTarget | null;
  onClose: () => void;
  onOpenProject: (project: Project) => void;
  /** 新建成功后回调，首页据此判断新任务是否被当前筛选隐藏。 */
  onCreated?: (projectId: string, todoId: string) => void;
}

const GROUP_OPTIONS: { value: BoardGroup; label: string }[] = [
  { value: "pending", label: "待分配" },
  { value: "high", label: "高优先级" },
  { value: "normal", label: "普通优先级" },
  { value: "low", label: "低优先级" },
];

/**
 * 任务弹窗。新建时是表单，点「创建」才写入；编辑时每个字段改动即时保存，
 * 与项目弹窗一致。两种模式字段相同：标题、项目、优先级、截止日期、备注。
 */
export function TaskDialog({ target, onClose, onOpenProject, onCreated }: Props) {
  const open = target !== null;
  return target?.mode === "edit" ? (
    <EditTask
      key={target.todoId}
      todoId={target.todoId}
      onClose={onClose}
      onOpenProject={onOpenProject}
    />
  ) : (
    <CreateTask
      key={open ? "open" : "closed"}
      open={open}
      projectId={target?.projectId}
      group={target?.group ?? "pending"}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function useActiveProjects() {
  const projects = useStore((s) => s.projects);
  return projects.filter((p) => !p.archived);
}

function CreateTask({
  open,
  projectId: preferredProjectId,
  group: initialGroup,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId?: string;
  group: BoardGroup;
  onClose: () => void;
  onCreated?: (projectId: string, todoId: string) => void;
}) {
  const projects = useActiveProjects();
  const addTodo = useStore((s) => s.addTodo);
  const [projectId, setProjectId] = useState(
    projects.some((p) => p.id === preferredProjectId)
      ? preferredProjectId!
      : (projects[0]?.id ?? ""),
  );
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState<BoardGroup>(initialGroup);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const clean = title.trim();
    if (!clean || !projectId) return;
    // 从首页新建的任务手动加入近期重点，保证建完就能在列表里看到。
    const todoId = addTodo(projectId, {
      title: clean,
      ...groupPatch(group),
      endDate,
      inWeek: true,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    onClose();
    onCreated?.(projectId, todoId);
    toast({ message: `已创建任务「${clean}」` });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="新建任务"
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          autoFocus
          aria-label="任务标题"
          className="h-9 text-[15px] font-medium"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // 输入法组字时的回车不提交。
            if (e.key === "Enter" && !isSubmitEnter(e)) e.preventDefault();
          }}
          placeholder="下一步要完成什么？"
        />
        <TaskFields
          projects={projects}
          projectId={projectId}
          onProjectChange={setProjectId}
          group={group}
          onGroupChange={setGroup}
          endDate={endDate}
          onEndDateChange={setEndDate}
          notes={notes}
          onNotesChange={setNotes}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            取消
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!title.trim() || !projectId}
          >
            创建
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditTask({
  todoId,
  onClose,
  onOpenProject,
}: {
  todoId: string;
  onClose: () => void;
  onOpenProject: (project: Project) => void;
}) {
  const projects = useActiveProjects();
  const updateTodo = useStore((s) => s.updateTodo);
  const moveTodo = useStore((s) => s.moveTodo);
  // 改项目会让任务换到另一个项目下，所以按 todoId 在全部项目里找它的当前位置。
  // 选择器返回 store 里已有的项目引用，不新建对象，否则每次读取都判定为变化而无限重渲染。
  const project = useStore((s) =>
    s.projects.find((p) => p.todos.some((t) => t.id === todoId)),
  );
  const todo = project?.todos.find((t) => t.id === todoId);
  if (!project || !todo) return null;
  const patch = (p: Partial<Todo>) => updateTodo(project.id, todo.id, p);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="编辑任务"
      size="md"
    >
      <div className="space-y-4">
        <Input
          aria-label="任务标题"
          className="h-9 text-[15px] font-medium"
          value={todo.title}
          placeholder="未命名任务"
          onChange={(e) => patch({ title: e.target.value })}
        />
        <TaskFields
          projects={projects}
          projectId={project.id}
          onProjectChange={(to) => moveTodo(project.id, todo.id, to)}
          group={boardGroup(todo)}
          onGroupChange={(g) => patch(groupPatch(g))}
          endDate={todo.endDate}
          onEndDateChange={(d) => patch({ endDate: d })}
          notes={todo.notes ?? ""}
          onNotesChange={(n) => patch({ notes: n })}
        />
      </div>
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            onClose();
            deleteTodo(project.id, todo.id, todo.title);
          }}
        >
          <Trash2 size={14} /> 删除
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClose();
            onOpenProject(project);
          }}
        >
          <ExternalLink size={14} /> 打开项目
        </Button>
      </div>
    </Dialog>
  );
}

function TaskFields({
  projects,
  projectId,
  onProjectChange,
  group,
  onGroupChange,
  endDate,
  onEndDateChange,
  notes,
  onNotesChange,
}: {
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  group: BoardGroup;
  onGroupChange: (g: BoardGroup) => void;
  endDate: string;
  onEndDateChange: (d: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
}) {
  return (
    <>
      <div>
        <Label htmlFor="task-project">项目</Label>
        <Select value={projectId} onValueChange={onProjectChange}>
          <SelectTrigger id="task-project" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                {p.title || "未命名项目"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="task-priority">优先级</Label>
          <Select
            value={group}
            onValueChange={(v) => onGroupChange(v as BoardGroup)}
          >
            <SelectTrigger id="task-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="task-date">截止日期</Label>
          <Input
            id="task-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="task-notes">备注</Label>
        <Textarea
          id="task-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>
    </>
  );
}
