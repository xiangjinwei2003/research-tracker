import { memo, useRef, useState } from "react";
import { ChevronRight, ExternalLink, Plus } from "lucide-react";
import {
  PROJECT_TAG_META,
  PROJECT_TAG_ORDER,
  type Project,
} from "@/lib/types";
import { upcomingTodos, useStore } from "@/lib/store";
import { today } from "@/lib/date";
import { isSubmitEnter } from "@/lib/keyboard";
import { completeTodo } from "@/lib/todoActions";
import { cn } from "@/lib/cn";
import { Checkbox } from "./Checkbox";
import { DateButton } from "./DateButton";
import { ProgressPie } from "./ProgressPie";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/ContextMenu";

/** 项目拖动排序用的 dataTransfer 类型，与任务拖动区分。 */
export const PROJECT_DRAG_TYPE = "application/x-rt-project";

/** 项目行拖动排序的回调，由 Dashboard 统一提供。 */
export interface ProjectDragHandlers {
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

interface Props {
  project: Project;
  /** Receives the project so Dashboard can pass one stable callback to all rows. */
  onEdit: (p: Project) => void;
  /** When true, todos can be dragged into the task list above. */
  draggableTodos?: boolean;
  /** Archived list: quieter text, no expand. */
  dimmed?: boolean;
  /** 提供时整行可拖动排序。 */
  drag?: ProjectDragHandlers;
  /** 正在被拖动的行。 */
  dragging?: boolean;
  /** 拖动经过、松手后会被占据位置的行。 */
  dropTarget?: boolean;
}

/**
 * 项目列表的一行：进度饼、标题、未完成数；展开后列出未完成任务，
 * 可勾选、改日期、快速添加，也可拖到上方任务列表。
 */
export const ProjectRow = memo(function ProjectRow({
  project,
  onEdit,
  draggableTodos = false,
  dimmed = false,
  drag,
  dragging = false,
  dropTarget = false,
}: Props) {
  const toggleProjectTag = useStore((s) => s.toggleProjectTag);
  const updateTodo = useStore((s) => s.updateTodo);
  const addTodo = useStore((s) => s.addTodo);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  // Guards against a double insert: pressing Enter commits and then unmounts the
  // <input>, whose blur would otherwise fire commitDraft again from the stale
  // `draft` closure. Reset each time the quick-add input is (re)opened.
  const committedRef = useRef(false);

  const openAdd = () => {
    committedRef.current = false;
    setAdding(true);
  };

  /**
   * Create the drafted todo (no due date; set it from the row's date button). Returns
   * the new todo's id, or null when the draft was blank or already committed.
   */
  const commitDraft = (): string | null => {
    if (committedRef.current) return null;
    const title = draft.trim();
    setDraft("");
    // Latch only when a real todo is actually inserted: a blank Enter must not
    // stick the guard, or the next real title would be silently dropped.
    if (!title) return null;
    committedRef.current = true;
    return addTodo(project.id, { title });
  };

  /** 回车：创建任务后清空输入框并保持打开，便于连续录入。 */
  const commitAndContinue = () => {
    if (!commitDraft()) return;
    committedRef.current = false;
  };

  const t = today();
  const total = project.todos.length;
  const done = project.todos.filter((x) => x.done).length;
  const remaining = total - done;
  const todos = open ? upcomingTodos(project, remaining) : [];
  const title = project.title || "未命名项目";

  // 右键菜单「添加任务」：等菜单关闭、焦点范围撤掉之后再展开并打开输入框，
  // 否则输入框挂载时焦点会被菜单收回。
  const addAfterMenuRef = useRef(false)
  const onMenuCloseAutoFocus = (e: Event) => {
    e.preventDefault()
    if (!addAfterMenuRef.current) return
    addAfterMenuRef.current = false
    setOpen(true)
    openAdd()
  }

  const header = (
    <div
      draggable={drag ? true : undefined}
      onDragStart={
        drag
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(PROJECT_DRAG_TYPE, project.id);
              drag.onDragStart(project.id);
            }
          : undefined
      }
      onDragEnd={drag?.onDragEnd}
      className={cn(
        "group flex items-center gap-1 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-hover data-[state=open]:bg-hover",
        dropTarget && "bg-accent/50 hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? `收起「${title}」的任务` : `展开「${title}」的任务`}
        disabled={dimmed}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:invisible"
      >
        <ChevronRight
          size={14}
          strokeWidth={2.4}
          className={cn(
            "transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      <button
        type="button"
        onClick={() => onEdit(project)}
        className="flex min-w-0 flex-1 cursor-default items-center gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProgressPie color={project.color} value={total ? done / total : 0} />
        <span className="truncate text-base leading-7 text-foreground">
          {title}
        </span>
        {project.tags?.map((tag) => {
          const meta = PROJECT_TAG_META[tag];
          return (
            <span
              key={tag}
              className="shrink-0 rounded px-1.5 text-xs leading-5"
              style={{ backgroundColor: meta.bg, color: meta.text }}
            >
              {meta.label}
            </span>
          );
        })}
      </button>
      {remaining > 0 ? (
        <span
          className="shrink-0 text-xs tabular-nums text-faint"
          title="未完成任务"
        >
          {remaining}
        </span>
      ) : null}
    </div>
  );

  return (
    <li
      onDragOver={drag ? (e) => drag.onDragOver(e, project.id) : undefined}
      onDrop={drag ? (e) => drag.onDrop(e, project.id) : undefined}
      className={cn(dimmed && "opacity-70", dragging && "opacity-40")}
    >
      {dimmed ? (
        header
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>{header}</ContextMenuTrigger>
          <ContextMenuContent onCloseAutoFocus={onMenuCloseAutoFocus}>
            <ContextMenuItem onSelect={() => (addAfterMenuRef.current = true)}>
              <Plus /> 添加任务
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onEdit(project)}>
              <ExternalLink /> 打开项目
            </ContextMenuItem>
            <ContextMenuSeparator />
            {PROJECT_TAG_ORDER.map((tag) => (
              <ContextMenuCheckboxItem
                key={tag}
                checked={project.tags?.includes(tag) ?? false}
                onCheckedChange={() => toggleProjectTag(project.id, tag)}
              >
                {PROJECT_TAG_META[tag].label}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      )}

      {open ? (
        <div className="pb-3 pl-[30px] pr-2">
          {todos.length ? (
            <ul>
              {todos.map((todo) => {
                return (
                  <li
                    key={todo.id}
                    draggable={draggableTodos || undefined}
                    onDragStart={
                      draggableTodos
                        ? (e) => {
                            e.dataTransfer.effectAllowed = "move";
                            const payload = JSON.stringify({
                              projectId: project.id,
                              todoId: todo.id,
                            });
                            e.dataTransfer.setData(
                              "application/x-rt-todo",
                              payload,
                            );
                            e.dataTransfer.setData("text/plain", payload);
                          }
                        : undefined
                    }
                    title={
                      draggableTodos
                        ? "拖到上方任务列表，加入近期重点并设为该优先级"
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-md px-1.5 py-1.5 text-sm hover:bg-hover",
                      draggableTodos && "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    <Checkbox
                      checked={false}
                      onChange={() => completeTodo(project.id, todo.id, todo.title)}
                      label={`标记「${todo.title}」为已完成`}
                    />
                    <span className="min-w-0 flex-1 truncate text-secondary-foreground">
                      {todo.title || (
                        <span className="italic text-faint">未命名</span>
                      )}
                    </span>
                    <DateButton
                      value={todo.endDate}
                      todayIso={t}
                      onChange={(d) =>
                        updateTodo(project.id, todo.id, { endDate: d })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-1.5 py-1 text-sm text-faint">
              {total ? "所有任务已完成" : "还没有任务"}
            </p>
          )}

          <div className="relative mt-0.5">
            {adding ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitEnter(e)) {
                    commitAndContinue();
                  } else if (e.key === "Escape") {
                    committedRef.current = true; // discard: block a racing blur-commit
                    setDraft("");
                    setAdding(false);
                  }
                }}
                onBlur={() => {
                  commitDraft();
                  setAdding(false);
                }}
                placeholder="任务标题，回车添加，Esc 结束"
                aria-label={`为「${title}」添加任务`}
                className="h-8 w-full rounded-md bg-muted px-2 text-sm outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-8 items-center gap-2 rounded-md px-1.5 text-sm text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus size={14} /> 添加任务
              </button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
});
