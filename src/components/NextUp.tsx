import { useEffect, useRef, useState, type ReactNode } from "react";
import { Timer } from "lucide-react";
import { PRIORITY_META, todoPriority } from "@/lib/types";
import { dueLabel } from "@/lib/date";
import type { BoardItem } from "@/lib/board";
import { completeTodo, startTodoFocus } from "@/lib/todoActions";
import { cn } from "@/lib/cn";
import { Checkbox } from "./Checkbox";
import { Button } from "./ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface Props {
  item: BoardItem;
  today: string;
  /** 标题上方一行：日期与逾期、今天到期的统计。 */
  dateLine: ReactNode;
  onOpen: () => void;
}

/** 与任务行一致：勾选后先显示完成态，再写入完成。 */
const COMPLETE_DELAY_MS = 420;

/** 首页顶部：列表排在第一位的任务单独放大，勾选和开始专注放在同一行。 */
export function NextUp({ item, today, dateLine, onOpen }: Props) {
  const { project, todo } = item;
  const [checking, setChecking] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );
  const title = todo.title || "未命名任务";
  const due = dueLabel(todo.endDate, today);

  const complete = () => {
    if (checking) return;
    setChecking(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      completeTodo(project.id, todo.id, todo.title);
    }, COMPLETE_DELAY_MS);
  };

  return (
    <header aria-label="下一件事" className="px-2 pt-2">
      <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {dateLine}
      </div>
      <div
        className={cn(
          "mt-4 flex flex-wrap items-start gap-x-5 gap-y-3 transition-opacity",
          checking && "opacity-60",
        )}
      >
        <Checkbox
          checked={checking}
          onChange={complete}
          label={`完成「${title}」`}
          className="mt-[5px] size-6 rounded-md border-2 [&_svg]:size-4"
        />
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 basis-64 cursor-default rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "block break-words text-title font-bold tracking-[-0.01em]",
              checking && "text-muted-foreground line-through",
              !todo.title && "italic text-muted-foreground",
            )}
          >
            {title}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
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
                  "tabular-nums",
                  due.tone === "overdue" && "text-destructive",
                  due.tone === "today" && "text-today",
                )}
              >
                {due.text}
              </span>
            ) : null}
            <span>
              {todo.pending ? "待分配" : PRIORITY_META[todoPriority(todo)].label}
            </span>
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="mt-px max-sm:ml-11">
              <Timer />
              开始专注
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => startTodoFocus(project.id, todo.id, 30)}
            >
              <Timer /> 30 分钟
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => startTodoFocus(project.id, todo.id, 60)}
            >
              <Timer /> 1 小时
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
