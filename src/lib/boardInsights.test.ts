import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoardInsights, taskFocusKey } from "./boardInsights.ts";
import {
  defaultStages,
  type FocusSession,
  type Project,
  type Todo,
} from "./types.ts";

const task = (id: string, endDate: string, done = false): Todo => ({
  id,
  title: id,
  endDate,
  done,
  stage: "literature",
});
const proj = (id: string, todos: Todo[], archived = false): Project => ({
  id,
  title: id,
  description: "",
  color: id === "p1" ? "#f00" : "#0f0",
  stage: "literature",
  stages: defaultStages(),
  startDate: "",
  collaborators: [],
  todos,
  notes: "",
  archived,
  createdAt: "",
  updatedAt: "",
});
const atLocalNoon = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
const session = (
  id: string,
  iso: string,
  minutes: number,
  projectId?: string,
  todoId?: string,
): FocusSession => ({
  id,
  startedAt: atLocalNoon(iso),
  endedAt: atLocalNoon(iso) + minutes * 60_000,
  plannedMin: minutes,
  completed: true,
  projectId,
  todoId,
});

test("insights use active projects for tasks and all records for recent focus", () => {
  const projects = [
    proj("p1", [
      task("late", "2026-09-15"),
      task("today", "2026-09-16"),
      task("edge", "2026-09-23"),
      task("none", ""),
      task("done", "2026-09-16", true),
    ]),
    proj("p2", [task("future", "2026-10-01")]),
    proj("arch", [task("hidden", "2026-09-16")], true),
  ];
  const sessions = [
    session("s1", "2026-09-16", 30, "p1", "today"),
    session("s2", "2026-09-10", 15),
    session("future", "2026-09-17", 60),
  ];
  const result = buildBoardInsights(
    projects,
    sessions,
    "2026-09-16",
    new Date("2026-09-16T23:59:59").getTime(),
  );
  assert.deepEqual(result.tasks, {
    total: 6,
    done: 1,
    open: 5,
    overdue: 1,
    completionPercent: 17,
    priorities: { high: 0, normal: 5, low: 0 },
  });
  assert.deepEqual(
    result.projects.map((x) => [x.projectId, x.open]),
    [
      ["p1", 4],
      ["p2", 1],
    ],
  );
  assert.equal(result.deadlines.overdue, 1);
  assert.equal(result.deadlines.undated, 1);
  assert.equal(result.deadlines.days[0].count, 1);
  assert.equal(result.deadlines.days[7].count, 1);
  assert.equal(result.focus.totalMinutes, 45);
  assert.equal(result.focus.days.at(-1)?.minutes, 30);
  assert.equal(result.taskFocusMinutes.get(taskFocusKey("p1", "today")), 30);
});

test("zero task total reports zero percent without inventing completion", () => {
  const result = buildBoardInsights(
    [],
    [],
    "2026-09-16",
    new Date("2026-09-16T23:59:59").getTime(),
  );
  assert.deepEqual(result.tasks, {
    total: 0,
    done: 0,
    open: 0,
    overdue: 0,
    completionPercent: 0,
    priorities: { high: 0, normal: 0, low: 0 },
  });
  assert.equal(result.focus.totalMinutes, 0);
});

test("14 day focus range includes the preceding second week", () => {
  const sessions = [
    session("recent", "2026-09-16", 30),
    session("older", "2026-09-04", 45),
    session("outside", "2026-09-02", 60),
  ];
  const result = buildBoardInsights(
    [],
    sessions,
    "2026-09-16",
    new Date("2026-09-16T23:59:59").getTime(),
    14,
  );
  assert.equal(result.focus.days.length, 14);
  assert.equal(result.focus.totalMinutes, 75);
});

test("task focus uses composite identity and excludes future records", () => {
  const sessions = [
    session("a", "2026-09-16", 30, "p:1", "t"),
    session("b", "2026-09-16", 10, "p", "1:t"),
    session("future", "2026-09-17", 40, "p:1", "t"),
  ];
  const result = buildBoardInsights(
    [],
    sessions,
    "2026-09-16",
    new Date("2026-09-16T23:59:59").getTime(),
  );
  assert.equal(result.taskFocusMinutes.get(taskFocusKey("p:1", "t")), 30);
  assert.equal(result.taskFocusMinutes.get(taskFocusKey("p", "1:t")), 10);
  assert.equal(result.focus.totalMinutes, 40);
});
