import { PRIORITY_META, todoPriority, type Project, type Todo } from "./types";

export type BoardRange = "recent" | "all";

export interface BoardItem {
  project: Project;
  todo: Todo;
  pinnedExtra: boolean;
}

export interface BoardFilters {
  today: string;
  end: string;
  query: string;
  projectId: string;
  range: BoardRange;
  overdueOnly: boolean;
  dueDate: string | null;
  undatedOnly: boolean;
}

export interface BoardResult {
  items: BoardItem[];
  stats: { total: number; overdue: number; dueToday: number };
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
      if (filters.range === "recent" && !inWindow && !todo.inWeek) continue;
      if (
        filters.overdueOnly &&
        (!todo.endDate || todo.endDate >= filters.today)
      )
        continue;
      if (filters.dueDate && todo.endDate !== filters.dueDate) continue;
      if (filters.undatedOnly && !!todo.endDate) continue;
      if (
        query &&
        !projectMatches &&
        !todo.title.toLocaleLowerCase("zh-CN").includes(query)
      )
        continue;
      items.push({ project, todo, pinnedExtra: !!todo.inWeek && !inWindow });
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
