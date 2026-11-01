import {
  PRIORITY_META,
  todoPriority,
  type Priority,
  type Project,
  type Todo,
} from "./types";

export type BoardRange = "recent" | "all";

export interface BoardItem {
  project: Project;
  todo: Todo;
  pinnedExtra: boolean;
}

/**
 * 截止日期筛选。逾期、未排期、某一天到期三者互斥，所以是同一维度上的取值：
 * "any" 不筛选，"overdue" 逾期，"undated" 未排期，其余为 ISO 日期。
 */
export type DueFilter = "any" | "overdue" | "undated" | (string & {});

export interface BoardFilters {
  today: string;
  end: string;
  query: string;
  projectId: string;
  range: BoardRange;
  due: DueFilter;
}

function matchesDue(todo: Todo, due: DueFilter, today: string): boolean {
  if (due === "any") return true;
  if (due === "overdue") return !!todo.endDate && todo.endDate < today;
  if (due === "undated") return !todo.endDate;
  return todo.endDate === due;
}

export interface BoardResult {
  items: BoardItem[];
  stats: { total: number; overdue: number; dueToday: number };
}

/** 首页任务分组：先按优先级，待分配放在最后（紧挨项目列表）。 */
export type BoardGroup = "pending" | Priority;

export const BOARD_GROUPS: BoardGroup[] = ["high", "normal", "low", "pending"];

export function boardGroup(todo: Todo): BoardGroup {
  return todo.pending ? "pending" : todoPriority(todo);
}

/** 放进某组时写回任务的字段；指定优先级会在 store 里清掉待分配标记。 */
export function groupPatch(group: BoardGroup): Partial<Todo> {
  return group === "pending" ? { pending: true } : { priority: group };
}

function sortItems(a: BoardItem, b: BoardItem): number {
  const priority =
    PRIORITY_META[todoPriority(a.todo)].rank -
    PRIORITY_META[todoPriority(b.todo)].rank;
  if (priority !== 0) return priority;
  const byDate = (a.todo.endDate || "9999-12-31").localeCompare(
    b.todo.endDate || "9999-12-31",
  );
  if (byDate !== 0) return byDate;
  const byProject = a.project.title.localeCompare(b.project.title, "zh-CN");
  return byProject || a.todo.title.localeCompare(b.todo.title, "zh-CN");
}

export function buildBoard(
  projects: Project[],
  filters: BoardFilters,
): BoardResult {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  const items: BoardItem[] = [];
  for (const project of projects) {
    if (
      project.archived ||
      (filters.projectId !== "all" && project.id !== filters.projectId)
    )
      continue;
    const projectMatches = project.title
      .toLocaleLowerCase("zh-CN")
      .includes(query);
    for (const todo of project.todos) {
      if (todo.done) continue;
      const inWindow = !!todo.endDate && todo.endDate <= filters.end;
      // 待分配的待办在两种范围下都显示，等用户定优先级。
      if (
        filters.range === "recent" &&
        !inWindow &&
        !todo.inWeek &&
        !todo.pending
      )
        continue;
      if (!matchesDue(todo, filters.due, filters.today)) continue;
      if (
        query &&
        !projectMatches &&
        !todo.title.toLocaleLowerCase("zh-CN").includes(query)
      )
        continue;
      // 待分配的任务本来就在近期重点里显示，不再标「手动加入」。
      items.push({
        project,
        todo,
        pinnedExtra: !!todo.inWeek && !inWindow && !todo.pending,
      });
    }
  }
  items.sort(sortItems);
  return {
    items,
    stats: {
      total: items.length,
      overdue: items.filter(
        ({ todo }) => !!todo.endDate && todo.endDate < filters.today,
      ).length,
      dueToday: items.filter(({ todo }) => todo.endDate === filters.today)
        .length,
    },
  };
}

/** 按首页分组顺序取第一项，作为首页顶部的「下一件事」。 */
export function nextItem(items: BoardItem[]): BoardItem | null {
  for (const group of BOARD_GROUPS) {
    const hit = items.find((x) => boardGroup(x.todo) === group);
    if (hit) return hit;
  }
  return null;
}

export function parseTodoDragPayload(
  raw: string,
): { projectId: string; todoId: string } | null {
  try {
    const value = JSON.parse(raw) as { projectId?: unknown; todoId?: unknown };
    if (typeof value.projectId !== "string" || !value.projectId) return null;
    if (typeof value.todoId !== "string" || !value.todoId) return null;
    return { projectId: value.projectId, todoId: value.todoId };
  } catch {
    return null;
  }
}
