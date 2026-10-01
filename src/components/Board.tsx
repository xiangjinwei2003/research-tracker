import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CalendarDays,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { dateFromToday, today } from "@/lib/date";
import { buildBoard, parseTodoDragPayload, type BoardRange } from "@/lib/board";
import { buildBoardInsights, taskFocusKey } from "@/lib/boardInsights";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  todoPriority,
  type Priority,
  type Project,
} from "@/lib/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { BoardTaskCard } from "./BoardTaskCard";
import { BoardTaskDialog } from "./BoardTaskDialog";
import { HomeOutlook } from "./HomeOutlook";
import { Dashboard } from "./Dashboard";
import { Button } from "./ui/Button";
import { Container } from "./ui/Container";
import { Input } from "./ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Props {
  onNew: () => void;
  onEdit: (project: Project) => void;
  onGoReview: () => void;
}

export function Board({ onNew, onEdit, onGoReview }: Props) {
  const projects = useStore((s) => s.projects);
  const sessions = useStore((s) => s.sessions);
  const updateTodo = useStore((s) => s.updateTodo);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [range, setRange] = useState<BoardRange>("recent");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [undatedOnly, setUndatedOnly] = useState(false);
  const [dialogPriority, setDialogPriority] = useState<Priority>("normal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [insightsNow, setInsightsNow] = useState(() => Date.now());
  const [overCol, setOverCol] = useState<Priority | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
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
  const insights = useMemo(
    () => buildBoardInsights(projects, sessions, now, insightsNow, 7),
    [projects, sessions, now, insightsNow],
  );
  const filtered =
    !!query.trim() ||
    effectiveProjectId !== "all" ||
    range !== "recent" ||
    overdueOnly ||
    !!dueDate ||
    undatedOnly;
  const columns = PRIORITY_ORDER.map((priority) => ({
    priority,
    items: result.items.filter((x) => todoPriority(x.todo) === priority),
  }));

  useEffect(() => {
    const timer = window.setInterval(() => setInsightsNow(Date.now()), 60_000);
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.sessions !== previous.sessions) setInsightsNow(Date.now());
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const clearFilters = () => {
    setQuery("");
    setProjectId("all");
    setRange("recent");
    setOverdueOnly(false);
    setDueDate(null);
    setUndatedOnly(false);
  };
  const showAll = () => {
    setQuery("");
    setProjectId("all");
    setRange("all");
    setOverdueOnly(false);
    setDueDate(null);
    setUndatedOnly(false);
  };
  const openTaskDialog = (priority: Priority = "normal") => {
    setDialogPriority(priority);
    setDialogOpen(true);
  };
  const handleDrop = (priority: Priority, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOverCol(null);
    setDraggingKey(null);
    const own = dragRef.current;
    dragRef.current = null;
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

  return (
    <main>
      <Container className="py-7">
        <h1 className="text-[26px] font-semibold tracking-[-.025em]">
          任务看板
        </h1>
        <HomeOutlook
          projects={projects}
          sessions={sessions}
          todayIso={now}
          nowMs={insightsNow}
          onOpenDay={(iso) => {
            showAll();
            setDueDate(iso);
          }}
          onShowOverdue={() => {
            showAll();
            setOverdueOnly(true);
          }}
          onOpenProject={(id) => {
            showAll();
            setProjectId(id);
          }}
          onReview={onGoReview}
        />

        {activeProjects.length ? (
          <>
            <div
              id="task-board"
              className="mt-5 scroll-mt-24 flex min-w-0 max-w-full flex-wrap items-center gap-2 border-b pb-3"
            >
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {result.stats.total}
              </span>
              <div className="inline-flex h-8 rounded-md bg-muted p-0.5">
                {(["recent", "all"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={range === value}
                    onClick={() => setRange(value)}
                    className={cn(
                      "rounded px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      range === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {value === "recent" ? "近期重点" : "全部待办"}
                  </button>
                ))}
              </div>
              <div className="relative w-full min-w-0 sm:ml-auto sm:w-auto sm:min-w-[180px] sm:max-w-[260px] sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索任务或项目"
                  aria-label="搜索任务或项目"
                  className="pl-9"
                />
              </div>
              <Select value={effectiveProjectId} onValueChange={setProjectId}>
                <SelectTrigger
                  className="w-full min-w-0 max-w-full sm:w-[180px]"
                  aria-label="筛选项目"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {activeProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title || "未命名项目"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                aria-pressed={overdueOnly}
                onClick={() => setOverdueOnly((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  overdueOnly
                    ? "border-destructive/35 bg-destructive/[.07] text-destructive"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <AlertCircle size={14} />
                仅逾期
              </button>
              <button
                type="button"
                aria-pressed={undatedOnly}
                onClick={() => {
                  setUndatedOnly((value) => !value);
                  if (!undatedOnly) setDueDate(null);
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  undatedOnly
                    ? "border-ring/40 bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                未排期
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openTaskDialog()}
              >
                <Plus />
                新建任务
              </Button>
              {filtered ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                  清除
                </button>
              ) : null}
            </div>
            {dueDate || undatedOnly ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="rounded-full border border-ring/30 bg-accent px-2.5 py-1 text-accent-foreground">
                  {undatedOnly
                    ? "未排期"
                    : `${Number(dueDate?.slice(5, 7))}月${Number(dueDate?.slice(8, 10))}日到期`}
                </span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setDueDate(null);
                    setUndatedOnly(false);
                  }}
                >
                  清除日期条件
                </button>
              </div>
            ) : null}

            {result.items.length ? (
              <div className="pane-grid cols-2 cols-3 mt-4 gap-4">
                {columns.map(({ priority, items }) => (
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
                      "rounded-xl border border-transparent bg-[var(--column)] p-3 transition",
                      overCol === priority &&
                        "border-dashed border-ring bg-accent/40",
                    )}
                    aria-label={`${PRIORITY_META[priority].label}（${items.length} 项）`}
                  >
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          PRIORITY_META[priority].dot,
                        )}
                      />
                      <h2 className="text-sm font-semibold">
                        {PRIORITY_META[priority].label}
                      </h2>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {items.length}
                      </span>
                      <button
                        className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                        onClick={() => openTaskDialog(priority)}
                        aria-label={`新建${PRIORITY_META[priority].label}任务`}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((item) => {
                        const key = taskFocusKey(item.project.id, item.todo.id);
                        return (
                          <BoardTaskCard
                            key={key}
                            project={item.project}
                            todo={item.todo}
                            today={now}
                            pinnedExtra={item.pinnedExtra}
                            focusMinutes={
                              insights.taskFocusMinutes.get(key) ?? 0
                            }
                            dragging={draggingKey === key}
                            onOpen={() => onEdit(item.project)}
                            onDragStart={(from, e) => {
                              dragRef.current = {
                                projectId: item.project.id,
                                todoId: item.todo.id,
                                from,
                              };
                              setDraggingKey(key);
                              const payload = JSON.stringify({
                                projectId: item.project.id,
                                todoId: item.todo.id,
                              });
                              e.dataTransfer.setData(
                                "application/x-rt-todo",
                                payload,
                              );
                              e.dataTransfer.setData("text/plain", payload);
                            }}
                            onDragEnd={() => {
                              dragRef.current = null;
                              setDraggingKey(null);
                              setOverCol(null);
                            }}
                          />
                        );
                      })}
                      {items.length === 0 ? (
                        <p className="px-2 py-3 text-center text-xs text-faint">
                          暂无此优先级任务
                        </p>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Empty
                filtered={filtered}
                onClear={clearFilters}
                onAll={() => setRange("all")}
                onNew={() => openTaskDialog()}
              />
            )}
          </>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            还没有进行中的项目。用右上角的新建项目开始。
          </p>
        )}
      </Container>
      <div className="border-t bg-panel/35">
        <Dashboard
          showArchived={false}
          onNew={onNew}
          onEdit={onEdit}
          draggableTodos
          collapsible
        />
      </div>
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

function Empty({
  filtered,
  onClear,
  onAll,
  onNew,
}: {
  filtered: boolean;
  onClear: () => void;
  onAll: () => void;
  onNew: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      <CalendarDays className="mx-auto size-7 text-faint" />
      <h2 className="mt-3 text-sm font-semibold">
        {filtered ? "没有符合筛选的任务" : "近期没有待处理任务"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {filtered
          ? "调整条件或清除筛选，查看其他任务。"
          : "可以查看全部待办，或创建一个新任务。"}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={filtered ? onClear : onAll}>
          {filtered ? "清除筛选" : "查看全部待办"}
        </Button>
        <Button variant="primary" onClick={onNew}>
          新建任务
        </Button>
      </div>
    </div>
  );
}
