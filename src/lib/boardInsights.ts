import { addDays, format, parseISO } from "date-fns";
import { dayKey, sessionMinutes } from "./focus";
import {
  todoPriority,
  type FocusSession,
  type Priority,
  type Project,
} from "./types";

export interface InsightDay {
  iso: string;
  label: string;
  count: number;
}

export function buildBoardInsights(
  projects: Project[],
  sessions: FocusSession[],
  todayIso: string,
  nowMs: number,
  focusRangeDays: 7 | 14 = 7,
) {
  const active = projects.filter((project) => !project.archived);
  const allTasks = active.flatMap((project) => project.todos);
  const done = allTasks.filter((todo) => todo.done).length;
  const open = allTasks.length - done;
  const overdue = allTasks.filter(
    (todo) => !todo.done && !!todo.endDate && todo.endDate < todayIso,
  ).length;
  const priorities: Record<Priority, number> = { high: 0, normal: 0, low: 0 };
  for (const todo of allTasks) {
    if (!todo.done) priorities[todoPriority(todo)] += 1;
  }

  const projectRows = active
    .map((project) => ({
      projectId: project.id,
      title: project.title || "未命名项目",
      color: project.color,
      open: project.todos.filter((todo) => !todo.done).length,
    }))
    .sort((a, b) => b.open - a.open || a.title.localeCompare(b.title, "zh-CN"));

  const todayDate = parseISO(todayIso);
  const deadlineDays: InsightDay[] = Array.from({ length: 8 }, (_, index) => {
    const date = addDays(todayDate, index);
    const iso = format(date, "yyyy-MM-dd");
    return {
      iso,
      label: index === 0 ? "今天" : format(date, "M/d"),
      count: allTasks.filter((todo) => !todo.done && todo.endDate === iso)
        .length,
    };
  });
  const undated = allTasks.filter((todo) => !todo.done && !todo.endDate).length;

  const focusDays = Array.from({ length: focusRangeDays }, (_, index) => {
    const date = addDays(todayDate, index - (focusRangeDays - 1));
    return {
      iso: format(date, "yyyy-MM-dd"),
      label: format(date, "M/d"),
      minutes: 0,
    };
  });
  const focusByDay = new Map(focusDays.map((day) => [day.iso, day]));
  const taskFocusMinutes = new Map<string, number>();
  for (const focusSession of sessions) {
    if (focusSession.startedAt > nowMs || focusSession.endedAt > nowMs)
      continue;
    const minutes = sessionMinutes(focusSession);
    const bucket = focusByDay.get(dayKey(focusSession.startedAt));
    if (bucket) bucket.minutes += minutes;
    if (focusSession.projectId && focusSession.todoId) {
      const key = taskFocusKey(focusSession.projectId, focusSession.todoId);
      taskFocusMinutes.set(key, (taskFocusMinutes.get(key) ?? 0) + minutes);
    }
  }

  return {
    tasks: {
      total: allTasks.length,
      done,
      open,
      overdue,
      completionPercent: allTasks.length
        ? Math.round((done / allTasks.length) * 100)
        : 0,
      priorities,
    },
    projects: projectRows,
    deadlines: { days: deadlineDays, overdue, undated },
    focus: {
      days: focusDays,
      totalMinutes: focusDays.reduce((sum, day) => sum + day.minutes, 0),
    },
    taskFocusMinutes,
  };
}

export type BoardInsightsData = ReturnType<typeof buildBoardInsights>;

export function taskFocusKey(projectId: string, todoId: string): string {
  return JSON.stringify([projectId, todoId]);
}
