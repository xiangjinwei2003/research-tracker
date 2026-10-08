import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, parseTodoDragPayload } from "./board.ts";
import { defaultStages, type Project, type Todo } from "./types.ts";

const todo = (
  id: string,
  title: string,
  endDate: string,
  extra: Partial<Todo> = {},
): Todo => ({
  id,
  title,
  endDate,
  done: false,
  stage: "literature",
  ...extra,
});

const project = (
  id: string,
  title: string,
  todos: Todo[],
  archived = false,
): Project => ({
  id,
  title,
  description: "",
  color: "#28634b",
  stage: "literature",
  stages: defaultStages(),
  startDate: "2026-09-01",
  collaborators: [],
  todos,
  notes: "",
  archived,
  createdAt: "",
  updatedAt: "",
});

const projects = [
  project("p1", "Alpha Study", [
    todo("late", "Late synthesis", "2026-09-15", { priority: "high" }),
    todo("today", "Interview today", "2026-09-16"),
    todo("edge", "Window edge", "2026-09-23", { priority: "low" }),
    todo("future", "Far future", "2026-10-01"),
    todo("pin", "Pinned undated", "", { inWeek: true }),
    todo("done", "Done task", "2026-09-16", { done: true }),
  ]),
  project("p2", "Beta Lab", [todo("beta", "Paper draft", "2026-09-17")]),
  project("arch", "Archived", [todo("hidden", "Hidden", "2026-09-16")], true),
];

test("recent range is inclusive and includes overdue plus undated manual items", () => {
  const result = buildBoard(projects, {
    today: "2026-09-16",
    end: "2026-09-23",
    query: "",
    projectId: "all",
    range: "recent",
    overdueOnly: false,
    dueDate: null,
    undatedOnly: false,
  });
  assert.deepEqual(
    result.items.map((x) => x.todo.id),
    ["late", "today", "beta", "pin", "edge"],
  );
  assert.deepEqual(result.stats, { total: 5, overdue: 1, dueToday: 1 });
});

test("all range, search, project and overdue filters form an intersection", () => {
  const all = buildBoard(projects, {
    today: "2026-09-16",
    end: "2026-09-23",
    query: "alpha",
    projectId: "p1",
    range: "all",
    overdueOnly: true,
    dueDate: null,
    undatedOnly: false,
  });
  assert.deepEqual(
    all.items.map((x) => x.todo.id),
    ["late"],
  );
  const taskSearch = buildBoard(projects, {
    today: "2026-09-16",
    end: "2026-09-23",
    query: "PAPER",
    projectId: "all",
    range: "all",
    overdueOnly: false,
    dueDate: null,
    undatedOnly: false,
  });
  assert.deepEqual(
    taskSearch.items.map((x) => x.todo.id),
    ["beta"],
  );
});

test("all range excludes archived projects and completed tasks", () => {
  const result = buildBoard(projects, {
    today: "2026-09-16",
    end: "2026-09-23",
    query: "",
    projectId: "all",
    range: "all",
    overdueOnly: false,
    dueDate: null,
    undatedOnly: false,
  });
  assert.deepEqual(
    result.items.map((x) => x.todo.id),
    ["late", "today", "beta", "future", "pin", "edge"],
  );
});

test("exact due-date and undated filters only return their matching tasks", () => {
  const base = {
    today: "2026-09-16",
    end: "2026-09-23",
    query: "",
    projectId: "all",
    range: "all" as const,
    overdueOnly: false,
  };
  assert.deepEqual(
    buildBoard(projects, {
      ...base,
      dueDate: "2026-09-17",
      undatedOnly: false,
    }).items.map((x) => x.todo.id),
    ["beta"],
  );
  assert.deepEqual(
    buildBoard(projects, {
      ...base,
      dueDate: null,
      undatedOnly: true,
    }).items.map((x) => x.todo.id),
    ["pin"],
  );
});

test("drag payload accepts both supported payload shapes and rejects malformed data", () => {
  assert.deepEqual(parseTodoDragPayload('{"projectId":"p","todoId":"t"}'), {
    projectId: "p",
    todoId: "t",
  });
  assert.equal(parseTodoDragPayload("t"), null);
  assert.equal(parseTodoDragPayload('{"projectId":"","todoId":"t"}'), null);
  assert.equal(parseTodoDragPayload("not-json"), null);
});

test("pending todos show in 近期重点 regardless of due date", () => {
  const result = buildBoard(
    [project("p", "P", [todo("far", "Far pending", "2026-12-01", { pending: true })])],
    {
      today: "2026-09-16",
      end: "2026-09-23",
      query: "",
      projectId: "all",
      range: "recent",
      overdueOnly: false,
      dueDate: null,
      undatedOnly: false,
    },
  );
  assert.deepEqual(
    result.items.map((x) => x.todo.id),
    ["far"],
  );
});
