import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHomeOutlook, FREE_COLOR } from "./homeOutlook.ts";
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
): FocusSession => ({
  id,
  startedAt: atLocalNoon(iso),
  endedAt: atLocalNoon(iso) + minutes * 60_000,
  plannedMin: minutes,
  completed: true,
  projectId,
});

const NOW = new Date(2026, 9, 1, 18, 0, 0, 0).getTime();

function cell(calendar: { iso: string }[], iso: string) {
  const hit = calendar.find((item) => item.iso === iso);
  if (!hit) throw new Error(iso);
  return hit as ReturnType<typeof buildHomeOutlook>["calendar"][number];
}

test("week effort, share, and the next two weeks of deadlines", () => {
  const p1 = proj("p1", [
    task("soon", "2026-10-03"),
    task("late", "2026-09-30"),
    task("withDeadline", "2026-10-06"),
    task("far", "2026-10-20"),
    task("blank", ""),
  ]);
  p1.title = "协作注意";
  const p2 = proj("p2", [
    task("done", "2026-10-06", true),
    task("later", "2026-10-08"),
  ]);
  p2.title = "临床对话";
  p2.venue = { name: "CHI", deadline: "2026-10-06", rebuttalAt: "2026-10-06" };
  const arch = proj(
    "arch",
    [task("hidden", "2026-10-03"), task("old", "2026-09-29")],
    true,
  );
  arch.venue = { name: "X", deadline: "2026-10-04" };
  const lateStart = new Date(2026, 9, 1, 18, 30, 0, 0).getTime();
  const stillOpen = new Date(2026, 9, 1, 17, 50, 0, 0).getTime();
  const sessions: FocusSession[] = [
    session("mon", "2026-09-28", 40, "p1"),
    session("thu", "2026-10-01", 20, "p2"),
    session("tue", "2026-09-29", 15),
    session("prev", "2026-09-27", 50, "p1"),
    session("next", "2026-10-05", 50, "p1"),
    {
      id: "afterNow",
      startedAt: lateStart,
      endedAt: lateStart + 25 * 60_000,
      plannedMin: 25,
      completed: false,
      projectId: "p1",
    },
    {
      id: "unfinished",
      startedAt: stillOpen,
      endedAt: NOW + 10 * 60_000,
      plannedMin: 30,
      completed: false,
      projectId: "p2",
    },
  ];

  const result = buildHomeOutlook([p1, p2, arch], sessions, "2026-10-01", NOW);

  assert.equal(result.totalMinutes, 75);
  assert.deepEqual(
    result.days.map((day) => [day.iso, day.label, day.minutes, day.isToday, day.isFuture]),
    [
      ["2026-09-28", "一", 40, false, false],
      ["2026-09-29", "二", 15, false, false],
      ["2026-09-30", "三", 0, false, false],
      ["2026-10-01", "四", 20, true, false],
      ["2026-10-02", "五", 0, false, true],
      ["2026-10-03", "六", 0, false, true],
      ["2026-10-04", "日", 0, false, true],
    ],
  );
  assert.deepEqual(result.days[0].parts, [
    { key: "p1", color: "#f00", minutes: 40 },
  ]);
  assert.deepEqual(result.days[1].parts, [
    { key: "__free", color: FREE_COLOR, minutes: 15 },
  ]);
  assert.deepEqual(result.days[3].parts, [
    { key: "p2", color: "#0f0", minutes: 20 },
  ]);
  for (const day of result.days) {
    assert.equal(
      day.parts.reduce((sum, part) => sum + part.minutes, 0),
      day.minutes,
    );
  }
  assert.deepEqual(
    result.share.map((row) => [row.key, row.short, row.minutes, row.color]),
    [
      ["p1", "协作", 40, "#f00"],
      ["p2", "临床", 20, "#0f0"],
      ["__free", "自由", 15, FREE_COLOR],
    ],
  );
  assert.equal(
    result.share.reduce((sum, row) => sum + row.minutes, 0),
    result.totalMinutes,
  );
  assert.equal(result.overdue, 1);
  assert.equal(result.calendar.length, 14);
  assert.equal(result.calendar[0].iso, "2026-09-28");
  assert.equal(result.calendar[13].iso, "2026-10-11");
  assert.equal(result.calendar[3].isToday, true);
  assert.equal(cell(result.calendar, "2026-09-30").isPast, true);
  assert.deepEqual(cell(result.calendar, "2026-09-30").marks, [
    {
      key: "p1",
      name: "协作注意",
      short: "协作",
      color: "#f00",
      kind: "todo",
      n: 1,
      note: "",
    },
  ]);
  assert.deepEqual(
    cell(result.calendar, "2026-10-03").marks.map((mark) => mark.key),
    ["p1"],
  );
  assert.equal(cell(result.calendar, "2026-09-29").marks.length, 0);
  assert.equal(cell(result.calendar, "2026-10-04").marks.length, 0);
  assert.deepEqual(
    cell(result.calendar, "2026-10-06").marks.map((mark) => [mark.key, mark.kind, mark.note, mark.n]),
    [
      ["p2", "deadline", "截稿、Rebuttal", 2],
      ["p1", "todo", "", 1],
    ],
  );
  assert.equal(cell(result.calendar, "2026-10-06").detail, "10月6日 临床 截稿、Rebuttal 协作 1");
  assert.deepEqual(
    cell(result.calendar, "2026-10-08").marks.map((mark) => [mark.kind, mark.n]),
    [["todo", 1]],
  );
  assert.equal(
    result.calendar.some((item) => item.iso === "2026-10-20"),
    false,
  );
  assert.equal(
    result.calendar.some((item) => item.marks.some((mark) => mark.key === "arch")),
    false,
  );
});

test("stacked parts follow the week share order", () => {
  const projects = [proj("p1", []), proj("p2", [])];
  projects[0].title = "甲项目";
  projects[1].title = "乙项目";
  const result = buildHomeOutlook(
    projects,
    [
      session("a", "2026-09-28", 10, "p2"),
      session("b", "2026-09-28", 30, "p1"),
      session("c", "2026-09-29", 25, "p2"),
    ],
    "2026-10-01",
    NOW,
  );
  assert.equal(result.share[0].key, "p2");
  assert.deepEqual(
    result.days[0].parts.map((part) => part.key),
    ["p2", "p1"],
  );
});

test("focus on an archived project still counts", () => {
  const archived = proj("p1", [], true);
  archived.title = "旧项目";
  const result = buildHomeOutlook(
    [archived],
    [session("s", "2026-09-28", 12, "p1")],
    "2026-10-01",
    NOW,
  );
  assert.equal(result.totalMinutes, 12);
  assert.equal(result.share[0].name, "旧项目");
  assert.equal(result.overdue, 0);
  assert.equal(result.calendar.every((item) => item.marks.length === 0), true);
});

test("an empty week still has seven days and fourteen cells", () => {
  const result = buildHomeOutlook([], [], "2026-10-01", NOW);
  assert.equal(result.totalMinutes, 0);
  assert.equal(result.days.length, 7);
  assert.equal(result.share.length, 0);
  assert.equal(result.overdue, 0);
  assert.equal(result.calendar.length, 14);
  assert.equal(result.calendar[0].detail, "9月28日");
});
