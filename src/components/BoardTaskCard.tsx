import {
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  Pin,
  Timer,
} from "lucide-react";
import { type CSSProperties, type DragEvent } from "react";
import { useStore } from "@/lib/store";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  todoPriority,
  type Priority,
  type Project,
  type Todo,
} from "@/lib/types";
import { dateFromToday, fmtMD } from "@/lib/date";
import { toast } from "@/lib/toast";
import {
  primeChime,
  reminderEnabled,
  requestNotifyPermission,
} from "@/lib/reminder";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { cn } from "@/lib/cn";

interface Props {
  project: Project;
  todo: Todo;
  today: string;
  pinnedExtra: boolean;
  focusMinutes: number;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (priority: Priority, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export function BoardTaskCard({
  project,
  todo,
  today,
  pinnedExtra,
  focusMinutes,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
  const updateTodo = useStore((s) => s.updateTodo);
  const startTimer = useStore((s) => s.startTimer);
  const overdue = !!todo.endDate && todo.endDate < today;
  const dueText = !todo.endDate
    ? "未排期"
    : overdue
      ? `逾期 · ${fmtMD(todo.endDate)}`
      : todo.endDate === today
        ? "今天到期"
        : fmtMD(todo.endDate);
  const collaborators = project.collaborators.slice(0, 3);

  const complete = () => {
    updateTodo(project.id, todo.id, { done: true });
    toast({
      message: `已完成「${todo.title || "未命名待办"}」`,
      action: {
        label: "撤销",
        onClick: () => updateTodo(project.id, todo.id, { done: false }),
      },
    });
  };
  const focus = (plannedMin: number) => {
    if (reminderEnabled()) {
      primeChime();
      void requestNotifyPermission();
    }
    startTimer({ plannedMin, projectId: project.id, todoId: todo.id });
    toast({ message: `开始专注 ${plannedMin} 分钟` });
  };
  const setPinned = (value: boolean) => {
    updateTodo(project.id, todo.id, { inWeek: value });
    const remains =
      !value && !!todo.endDate && todo.endDate <= dateFromToday(7);
    toast({
      message: value
        ? "已手动加入近期重点"
        : remains
          ? "已取消手动加入；任务因截止日期仍会自动显示"
          : "已取消手动加入",
    });
  };

  return (
    <article
      draggable
      data-project-id={project.id}
      data-todo-id={todo.id}
      onDragStart={(e) => onDragStart(todoPriority(todo), e)}
      onDragEnd={onDragEnd}
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,.10)] transition hover:border-ring/40 active:cursor-grabbing",
        dragging && "opacity-45",
      )}
    >
      <div className="p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            title={project.title || "未命名项目"}
            className="proj-name min-w-0 shrink text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ "--proj": project.color } as CSSProperties}
          >
            {project.title || "未命名项目"}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`管理「${todo.title || "未命名待办"}」`}
            >
              <MoreHorizontal size={17} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onOpen}>
                <ExternalLink /> 打开所属项目
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>优先级</DropdownMenuLabel>
              {PRIORITY_ORDER.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onSelect={() =>
                    updateTodo(project.id, todo.id, { priority: p })
                  }
                  disabled={todoPriority(todo) === p}
                >
                  <span
                    className={cn("size-2 rounded-full", PRIORITY_META[p].dot)}
                  />
                  {PRIORITY_META[p].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setPinned(!todo.inWeek)}>
                <Pin /> {todo.inWeek ? "取消手动加入" : "手动加入近期重点"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-3 flex items-start">
          <button
            type="button"
            onClick={onOpen}
            className="line-clamp-3 min-w-0 flex-1 text-left text-[15px] font-semibold leading-[1.5] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {todo.title || (
              <span className="italic text-faint">未命名待办</span>
            )}
          </button>
        </div>
        {todo.notes?.trim() ? (
          <p className="mt-2 line-clamp-1 text-xs leading-5 text-muted-foreground">
            {todo.notes.trim()}
          </p>
        ) : null}
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-1 tabular-nums",
              overdue
                ? "font-medium text-destructive"
                : todo.endDate === today
                  ? "font-medium text-warn"
                  : "",
            )}
          >
            <CalendarDays size={13} />
            {dueText}
          </span>
          {pinnedExtra ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-accent-foreground">
              <Pin size={11} />
              手动加入
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-12 min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border px-4 py-2.5">
        {collaborators.length ? (
          <div
            className="flex items-center -space-x-1.5"
            aria-label={`项目合作者：${project.collaborators.map((person) => person.name).join("、")}`}
            title={`项目合作者：${project.collaborators.map((person) => person.name).join("、")}`}
          >
            {collaborators.map((person) => (
              <span
                key={person.id}
                className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-accent text-[10px] font-semibold text-accent-foreground"
              >
                {person.name.trim().slice(0, 1) || "?"}
              </span>
            ))}
            {project.collaborators.length > 3 ? (
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] text-muted-foreground">
                +{project.collaborators.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {focusMinutes > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
              title="此任务累计专注"
            >
              <Clock3 size={13} />
              {focusMinutes} 分钟
            </span>
          ) : null}
          <button
            type="button"
            onClick={complete}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`完成「${todo.title || "未命名待办"}」`}
            title="标记完成"
          >
            <Check size={15} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Timer size={14} />
              专注
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => focus(30)}>
                30 分钟
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => focus(60)}>
                60 分钟
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
