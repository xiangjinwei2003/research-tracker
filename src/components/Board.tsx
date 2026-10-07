import { useMemo, useRef, useState, type DragEvent } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Check,
  CircleCheck,
  ListFilter,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { dateFromToday, fmtMD, parse, today } from "@/lib/date";
import { buildBoard, parseTodoDragPayload, type BoardRange } from "@/lib/board";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  todoPriority,
  type Priority,
  type Project,
} from "@/lib/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { TaskRow } from "./TaskRow";
import { BoardTaskDialog } from "./BoardTaskDialog";
import { Dashboard } from "./Dashboard";
import { Button } from "./ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface Props {
  onNew: () => void;
  onEdit: (project: Project) => void;
}

export function Board({ onNew, onEdit }: Props) {
  const projects = useStore((s) => s.projects);
  const updateTodo = useStore((s) => s.updateTodo);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [range, setRange] = useState<BoardRange>("recent");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [undatedOnly, setUndatedOnly] = useState(false);
  const [dialogPriority, setDialogPriority] = useState<Priority>("normal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overCol, setOverCol] = useState<Priority | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragRef = useRef<{
    projectId: string;
    todoId: string;
    from: Priority;
  } | null>(null);
  const activeProjects = useMemo(
    () => projects.filter((p) => !p.archived),
    [projects],
  );
  const effectiveProjectId =
    projectId === "all" || activeProjects.some((p) => p.id === projectId)
      ? projectId
      : "all";
  const now = today();
  const end = dateFromToday(7);
  const result = useMemo(
    () =>
      buildBoard(projects, {
        today: now,
        end,
        query,
        projectId: effectiveProjectId,
        range,
        overdueOnly,
        dueDate,
        undatedOnly,
      }),
    [
      projects,
      now,
      end,
      query,
      effectiveProjectId,
      range,
      overdueOnly,
      dueDate,
      undatedOnly,
    ],
  );
  // 标题下的摘要按全部未完成任务统计，不受下方筛选影响。
  const totals = useMemo(
    () =>
      buildBoard(projects, {
        today: now,
        end,
        query: "",
        projectId: "all",
        range: "all",
        overdueOnly: false,
        dueDate: null,
        undatedOnly: false,
      }).stats,
    [projects, now, end],
  );
  const filtered =
    !!query.trim() ||
    effectiveProjectId !== "all" ||
    overdueOnly ||
    !!dueDate ||
    undatedOnly;
  const filterCount =
    (effectiveProjectId !== "all" ? 1 : 0) +
    (overdueOnly ? 1 : 0) +
    (undatedOnly ? 1 : 0);
  const sections = PRIORITY_ORDER.map((priority) => ({
    priority,
    items: result.items.filter((x) => todoPriority(x.todo) === priority),
  }));
  const projectName =
    activeProjects.find((p) => p.id === effectiveProjectId)?.title ||
    "未命名项目";

  const clearFilters = () => {
    setQuery("");
    setProjectId("all");
    setOverdueOnly(false);
    setDueDate(null);
    setUndatedOnly(false);
  };
  const showOnly = (next: { overdue?: boolean; date?: string }) => {
    clearFilters();
    setRange("all");
    setOverdueOnly(!!next.overdue);
    setDueDate(next.date ?? null);
  };
  const openTaskDialog = (priority: Priority = "normal") => {
    setDialogPriority(priority);
    setDialogOpen(true);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDraggingKey(null);
    setOverCol(null);
    setDragActive(false);
  };
  const handleDrop = (priority: Priority, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const own = dragRef.current;
    endDrag();
    if (own) {
      if (own.from !== priority)
        updateTodo(own.projectId, own.todoId, { priority });
      return;
    }
    const parsed = parseTodoDragPayload(
      e.dataTransfer.getData("application/x-rt-todo") ||
        e.dataTransfer.getData("text/plain"),
    );
    if (!parsed) return;
    const project = projects.find(
      (p) => p.id === parsed.projectId && !p.archived,
    );
    const todo = project?.todos.find((t) => t.id === parsed.todoId && !t.done);
    if (!project || !todo) return;
    updateTodo(project.id, todo.id, { inWeek: true, priority });
    toast({ message: `已加入近期重点 · ${PRIORITY_META[priority].label}` });
  };

  const todayDate = parse(now) ?? new Date();

  return (
    <main
      className="pb-24"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("application/x-rt-todo"))
          setDragActive(true);
      }}
      onDrop={() => setDragActive(false)}
    >
      <div className="mx-auto w-full max-w-[52rem] px-4 pt-6 sm:px-8 lg:pt-10">
        <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.01em]">
              <CircleCheck
                size={26}
                strokeWidth={2.4}
                className="text-ring"
                aria-hidden
              />
              任务
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[36px] text-[13px] text-muted-foreground">
              <span>{format(todayDate, "M月d日 EEEE", { locale: zhCN })}</span>
              {totals.overdue ? (
                <button
                  type="button"
                  onClick={() => showOnly({ overdue: true })}
                  className="rounded-sm text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {totals.overdue} 项逾期
                </button>
              ) : null}
              {totals.dueToday ? (
                <button
                  type="button"
                  onClick={() => showOnly({ date: now })}
                  className="rounded-sm text-today hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {totals.dueToday} 项今天到期
                </button>
              ) : null}
            </p>
          </div>
        </header>

        {activeProjects.length ? (
          <>
            <div
              id="task-board"
              className="mt-8 flex min-w-0 flex-wrap items-center gap-2"
            >
              <div
                className="inline-flex h-8 rounded-md bg-muted p-0.5"
                role="group"
                aria-label="显示范围"
              >
                {(["recent", "all"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={range === value}
                    onClick={() => setRange(value)}
                    className={cn(
                      "rounded-[5px] px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      range === value
                        ? "bg-input font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.3)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {value === "recent" ? "近期重点" : "全部待办"}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex min-w-0 items-center gap-1">
                <label className="group relative flex h-8 min-w-0 items-center">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-2.5 text-faint"
                    aria-hidden
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索"
                    aria-label="搜索任务或项目"
                    className="h-8 w-28 min-w-0 max-sm:w-20 rounded-md bg-transparent pl-8 pr-2 text-[13px] outline-none transition-[width,background-color] duration-200 placeholder:text-faint hover:bg-hover focus:w-48 focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-sm:focus:w-36"
                  />
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover",
                      filterCount
                        ? "text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-label="筛选"
                  >
                    <ListFilter size={15} />
                    <span className="max-sm:sr-only">筛选</span>
                    {filterCount ? (
                      <span className="tabular-nums">· {filterCount}</span>
                    ) : null}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-[70vh] w-60 overflow-y-auto">
                    <DropdownMenuItem
                      onSelect={() => setOverdueOnly((v) => !v)}
                    >
                      <Check className={overdueOnly ? "" : "opacity-0"} />
                      仅看逾期
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setUndatedOnly((v) => !v);
                        setDueDate(null);
                      }}
                    >
                      <Check className={undatedOnly ? "" : "opacity-0"} />
                      仅看未排期
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>项目</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => setProjectId("all")}>
                      <Check
                        className={
                          effectiveProjectId === "all" ? "" : "opacity-0"
                        }
                      />
                      全部项目
                    </DropdownMenuItem>
                    {activeProjects.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={() => setProjectId(p.id)}
                      >
                        <Check
                          className={
                            effectiveProjectId === p.id ? "" : "opacity-0"
                          }
                        />
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="truncate">
                          {p.title || "未命名项目"}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openTaskDialog()}
                  className="ml-1 max-sm:w-8 max-sm:px-0"
                  aria-label="新建任务"
                >
                  <Plus />
                  <span className="max-sm:hidden">新建任务</span>
                </Button>
              </div>
            </div>

            {filtered ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {query.trim() ? (
                  <FilterChip
                    label={`搜索「${query.trim()}」`}
                    onClear={() => setQuery("")}
                  />
                ) : null}
                {effectiveProjectId !== "all" ? (
                  <FilterChip
                    label={projectName}
                    onClear={() => setProjectId("all")}
                  />
                ) : null}
                {overdueOnly ? (
                  <FilterChip
                    label="仅逾期"
                    onClear={() => setOverdueOnly(false)}
                  />
                ) : null}
                {undatedOnly ? (
                  <FilterChip
                    label="未排期"
                    onClear={() => setUndatedOnly(false)}
                  />
                ) : null}
                {dueDate ? (
                  <FilterChip
                    label={`${fmtMD(dueDate)}到期`}
                    onClear={() => setDueDate(null)}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-1 rounded-sm px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  全部清除
                </button>
              </div>
            ) : null}

            {result.items.length || dragActive ? (
              <div className="mt-6 space-y-8">
                {sections.map(({ priority, items }) => {
                  if (!items.length && !dragActive) return null;
                  const meta = PRIORITY_META[priority];
                  return (
                    <section
                      key={priority}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setOverCol(priority);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setOverCol(null);
                      }}
                      onDrop={(e) => handleDrop(priority, e)}
                      className={cn(
                        "rounded-xl transition-[background-color,box-shadow] duration-150",
                        overCol === priority &&
                          "bg-accent/40 shadow-[0_0_0_1px_var(--ring)]",
                      )}
                      aria-label={`${meta.label}（${items.length} 项）`}
                    >
                      <div className="group/head flex h-9 items-center gap-2 border-b border-border px-2">
                        <span
                          aria-hidden
                          className={cn("size-2 rounded-full", meta.dot)}
                        />
                        <h2 className={cn("text-[13px] font-semibold", meta.text)}>
                          {meta.label}
                        </h2>
                        <span className="text-xs tabular-nums text-faint">
                          {items.length}
                        </span>
                        <button
                          className="ml-auto flex size-7 items-center justify-center rounded-md text-faint opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/head:opacity-100 [@media(hover:none)]:opacity-100"
                          onClick={() => openTaskDialog(priority)}
                          aria-label={`新建${meta.label}任务`}
                          title={`新建${meta.label}任务`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      {items.length ? (
                        <ul className="mt-1">
                          {items.map((item) => {
                            const key = `${item.project.id}:${item.todo.id}`;
                            return (
                              <TaskRow
                                key={key}
                                project={item.project}
                                todo={item.todo}
                                today={now}
                                pinnedExtra={item.pinnedExtra}
                                dragging={draggingKey === key}
                                onOpen={() => onEdit(item.project)}
                                onDragStart={(from, e) => {
                                  dragRef.current = {
                                    projectId: item.project.id,
                                    todoId: item.todo.id,
                                    from,
                                  };
                                  setDraggingKey(key);
                                  setDragActive(true);
                                  const payload = JSON.stringify({
                                    projectId: item.project.id,
                                    todoId: item.todo.id,
                                  });
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData(
                                    "application/x-rt-todo",
                                    payload,
                                  );
                                  e.dataTransfer.setData("text/plain", payload);
                                }}
                                onDragEnd={endDrag}
                              />
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="px-2 py-3 text-xs text-faint">
                          拖到这里设为{meta.label}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <Empty
                filtered={filtered}
                recent={range === "recent"}
                onClear={clearFilters}
                onAll={() => setRange("all")}
                onNew={() => openTaskDialog()}
              />
            )}
          </>
        ) : (
          <div className="mt-16 max-w-sm">
            <p className="text-[15px] font-medium">还没有进行中的项目</p>
            <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
              任务挂在项目下。先建一个项目，填上阶段和投稿目标，再回来添加任务。
            </p>
            <Button variant="primary" className="mt-5" onClick={onNew}>
              <Plus />
              新建项目
            </Button>
          </div>
        )}
      </div>
      {activeProjects.length ? (
        <div className="mx-auto mt-16 w-full max-w-[52rem] px-4 sm:px-8">
          <Dashboard
            showArchived={false}
            onNew={onNew}
            onEdit={onEdit}
            draggableTodos
            collapsible
          />
        </div>
      ) : null}
      {dialogOpen ? (
        <BoardTaskDialog
          open
          onOpenChange={setDialogOpen}
          preferredProjectId={
            effectiveProjectId === "all" ? undefined : effectiveProjectId
          }
          initialPriority={dialogPriority}
          onNewProject={onNew}
          onCreated={(createdProjectId) => {
            setQuery("");
            setOverdueOnly(false);
            setDueDate(null);
            setUndatedOnly(false);
            setRange("recent");
            setProjectId(createdProjectId);
          }}
        />
      ) : null}
    </main>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-6 max-w-[16rem] items-center gap-1 rounded-full bg-accent pl-2.5 pr-1 text-accent-foreground">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`移除筛选：${label}`}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  );
}

function Empty({
  filtered,
  recent,
  onClear,
  onAll,
  onNew,
}: {
  filtered: boolean;
  recent: boolean;
  onClear: () => void;
  onAll: () => void;
  onNew: () => void;
}) {
  return (
    <div className="mt-12 flex flex-col items-center py-6 text-center">
      <CircleCheck size={40} strokeWidth={1.5} className="text-input" aria-hidden />
      <p className="mt-4 text-[15px] font-medium">
        {filtered
          ? "没有符合筛选的任务"
          : recent
            ? "近 7 天没有待办"
            : "所有任务都完成了"}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {filtered
          ? "调整条件，或清除筛选。"
          : recent
            ? "近期重点显示逾期、7 天内到期和手动加入的任务。"
            : "新建一项任务，或在项目里添加。"}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {filtered ? (
          <Button onClick={onClear}>清除筛选</Button>
        ) : recent ? (
          <Button onClick={onAll}>查看全部待办</Button>
        ) : null}
        <Button variant="primary" onClick={onNew}>
          <Plus />
          新建任务
        </Button>
      </div>
    </div>
  );
}
