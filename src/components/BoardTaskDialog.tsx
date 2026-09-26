import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { toast } from "@/lib/toast";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input, Label } from "./ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferredProjectId?: string;
  initialPriority: Priority;
  onNewProject: () => void;
  onCreated: (projectId: string) => void;
}

export function BoardTaskDialog({
  open,
  onOpenChange,
  preferredProjectId,
  initialPriority,
  onNewProject,
  onCreated,
}: Props) {
  const allProjects = useStore((s) => s.projects);
  const projects = allProjects.filter((p) => !p.archived);
  const addTodo = useStore((s) => s.addTodo);
  const initialProjectId = projects.some((p) => p.id === preferredProjectId)
    ? preferredProjectId!
    : (projects[0]?.id ?? "");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(initialPriority);
  const [endDate, setEndDate] = useState("");
  const effectiveProjectId = projects.some((p) => p.id === projectId)
    ? projectId
    : (projects[0]?.id ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || !effectiveProjectId) return;
    addTodo(effectiveProjectId, {
      title: clean,
      priority,
      endDate,
      inWeek: true,
    });
    onOpenChange(false);
    onCreated(effectiveProjectId);
    toast({ message: `已创建任务「${clean}」并加入近期重点` });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建任务"
      description="任务会手动加入近期重点；截止日期可以留空。"
      size="md"
    >
      {projects.length === 0 ? (
        <div className="py-5 text-center">
          <p className="text-sm text-muted-foreground">
            请先新建一个项目，再添加任务。
          </p>
          <Button
            className="mt-4"
            variant="primary"
            onClick={() => {
              onOpenChange(false);
              onNewProject();
            }}
          >
            <Plus />
            新建项目
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="board-task-project">所属项目</Label>
            <Select value={effectiveProjectId} onValueChange={setProjectId}>
              <SelectTrigger id="board-task-project" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title || "未命名项目"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="board-task-title">任务标题</Label>
            <Input
              id="board-task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)
                )
                  e.preventDefault();
              }}
              placeholder="下一步要完成什么？"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="board-task-priority">优先级</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger id="board-task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高优先级</SelectItem>
                  <SelectItem value="normal">普通优先级</SelectItem>
                  <SelectItem value="low">低优先级</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="board-task-date">截止日期</Label>
              <Input
                id="board-task-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!title.trim() || !effectiveProjectId}
            >
              创建任务
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
