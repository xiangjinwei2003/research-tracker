import { useEffect, useRef, useState, type DragEvent } from "react";
import { ExternalLink, Ellipsis, Flag, Pin, StickyNote, Timer } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  todoPriority,
  type Priority,
  type Project,
  type Todo,
} from "@/lib/types";
import { dateFromToday, dueLabel } from "@/lib/date";
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
import { Checkbox } from "./Checkbox";
import { cn } from "@/lib/cn";

interface Props {
  project: Project;
  todo: Todo;
  today: string;
  pinnedExtra: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (priority: Priority, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

/** 勾选后先显示完成态，再从列表移除，让完成动作有可见反馈。 */
const COMPLETE_DELAY_MS = 420;

export function TaskRow({
  project,
  todo,
  today,
  pinnedExtra,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
  const updateTodo = useStore((s) => s.updateTodo);
  const startTimer = useStore((s) => s.startTimer);
  const [checking, setChecking] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );
  const due = dueLabel(todo.endDate, today);
  const title = todo.title || "未命名待办";
  const notes = todo.notes?.trim();

  const complete = () => {
    if (checking) return;
    setChecking(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      updateTodo(project.id, todo.id, { done: true });
      toast({
        message: `已完成「${title}」`,
        action: {
          label: "撤销",
          onClick: () => updateTodo(project.id, todo.id, { done: false }),
        },
      });
    }, COMPLETE_DELAY_MS);
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
    <li
      draggable
      data-project-id={project.id}
      data-todo-id={todo.id}
      onDragStart={(e) => onDragStart(todoPriority(todo), e)}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg px-2 py-2 transition-[background-color,opacity] duration-150 hover:bg-hover has-[[data-state=open]]:bg-hover",
        dragging && "opacity-40",
        checking && "opacity-60",
      )}
    >
      <Checkbox
        checked={checking}
        onChange={complete}
        label={`完成「${title}」`}
        className="mt-[3px]"
      />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 cursor-default rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "block break-words text-[14px] leading-[22px] text-foreground transition-colors",
            checking && "text-muted-foreground line-through decoration-faint",
            !todo.title && "italic text-faint",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-5 text-muted-foreground">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: project.color }}
            />
            <span className="truncate">{project.title || "未命名项目"}</span>
          </span>
          {due ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 tabular-nums",
                due.tone === "overdue" && "text-destructive",
                due.tone === "today" && "text-today",
              )}
            >
              {due.tone === "overdue" ? <Flag size={11} strokeWidth={2.4} /> : null}
              {due.text}
            </span>
          ) : null}
          {pinnedExtra ? (
            <span
              className="inline-flex shrink-0 items-center text-faint"
              title="手动加入近期重点"
              aria-label="手动加入近期重点"
            >
              <Pin size={11} />
            </span>
          ) : null}
          {notes ? (
            <span
              className="inline-flex min-w-0 max-w-[24rem] items-center gap-1 text-faint"
              title={notes}
            >
              <StickyNote size={11} className="shrink-0" />
              <span className="truncate">{notes}</span>
            </span>
          ) : null}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover data-[state=open]:text-foreground"
            aria-label={`专注「${title}」`}
            title="开始专注"
          >
            <Timer size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>专注这项任务</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => focus(30)}>
              <Timer /> 30 分钟
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => focus(60)}>
              <Timer /> 1 小时
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover data-[state=open]:text-foreground"
            aria-label={`管理「${title}」`}
          >
            <Ellipsis size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onOpen}>
              <ExternalLink /> 打开所属项目
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPinned(!todo.inWeek)}>
              <Pin /> {todo.inWeek ? "取消手动加入" : "手动加入近期重点"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>优先级</DropdownMenuLabel>
            {PRIORITY_ORDER.map((p) => (
              <DropdownMenuItem
                key={p}
                onSelect={() => updateTodo(project.id, todo.id, { priority: p })}
                disabled={todoPriority(todo) === p}
              >
                <span
                  className={cn("size-2 rounded-full", PRIORITY_META[p].dot)}
                />
                {PRIORITY_META[p].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
