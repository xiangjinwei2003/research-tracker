import { addDays, format } from "date-fns";
import { weekStart } from "./date";
import { dayKey, projectShare, resolveSession } from "./focus";
import type { FocusSession, Project } from "./types";

export const FREE_KEY = "__free";
export const FREE_COLOR = "oklch(0.72 0.02 264)";

const WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"] as const;
const DEADLINE_NOTES = ["截稿", "Rebuttal"] as const;

export interface OutlookPart {
  key: string;
  color: string;
  minutes: number;
}

export interface OutlookDay {
  iso: string;
  label: string;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
  parts: OutlookPart[];
}

export interface OutlookShare {
  key: string;
  name: string;
  short: string;
  color: string;
  minutes: number;
}

export interface OutlookMark {
  key: string;
  name: string;
  short: string;
  color: string;
  kind: "todo" | "deadline";
  n: number;
  note: string;
}

export interface OutlookCell {
  iso: string;
  dayNum: number;
  isToday: boolean;
  isPast: boolean;
  detail: string;
  marks: OutlookMark[];
}

export interface HomeOutlook {
  totalMinutes: number;
  days: OutlookDay[];
  share: OutlookShare[];
  overdue: number;
  calendar: OutlookCell[];
}

export function localNoon(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function shortName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "自由专注") return "自由";
  const chars = [...trimmed];
  return chars.slice(0, 2).join("") || "未名";
}

function colorOf(color: string | undefined, key: string): string {
  if (key === FREE_KEY) return FREE_COLOR;
  return color || FREE_COLOR;
}

function monthDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

function cellDetail(iso: string, marks: OutlookMark[]): string {
  const head = monthDay(iso);
  if (marks.length === 0) return head;
  const bits = marks.map((mark) =>
    mark.kind === "deadline"
      ? `${mark.short} ${mark.note}`
      : `${mark.short} ${mark.n}`,
  );
  return `${head} ${bits.join(" ")}`;
}

interface DeadlineAcc {
  name: string;
  color: string;
  notes: Set<string>;
}

interface DayAcc {
  todos: Map<string, { name: string; color: string; n: number }>;
  deadlines: Map<string, DeadlineAcc>;
}

export function buildHomeOutlook(
  projects: Project[],
  sessions: FocusSession[],
  todayIso: string,
  nowMs: number,
): HomeOutlook {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const start = weekStart(localNoon(todayIso));
  const days: OutlookDay[] = Array.from({ length: 7 }, (_, i) => {
    const iso = format(addDays(start, i), "yyyy-MM-dd");
    return {
      iso,
      label: WEEKDAY[i],
      minutes: 0,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
      parts: [],
    };
  });
  const dayIndex = new Map(days.map((day, i) => [day.iso, i]));

  const resolved = sessions
    .filter((session) => {
      if (session.startedAt > nowMs || session.endedAt > nowMs) return false;
      const iso = dayKey(session.startedAt);
      return dayIndex.has(iso) && iso <= todayIso;
    })
    .map((session) => resolveSession(session, byId));

  const share: OutlookShare[] = projectShare(resolved).map((row) => ({
    key: row.key,
    name: row.name,
    short: shortName(row.name),
    color: colorOf(row.color, row.key),
    minutes: row.minutes,
  }));
  const order = new Map(share.map((row, i) => [row.key, i]));
  const colorByKey = new Map(share.map((row) => [row.key, row.color]));
  const partMaps = days.map(() => new Map<string, number>());

  for (const row of resolved) {
    const iso = dayKey(row.session.startedAt);
    const i = dayIndex.get(iso);
    if (i == null) continue;
    const key = row.session.projectId ?? FREE_KEY;
    const bucket = partMaps[i];
    bucket.set(key, (bucket.get(key) ?? 0) + row.minutes);
    days[i].minutes += row.minutes;
  }

  for (let i = 0; i < days.length; i++) {
    days[i].parts = [...partMaps[i].entries()]
      .map(([key, minutes]) => ({
        key,
        color: colorByKey.get(key) ?? FREE_COLOR,
        minutes,
      }))
      .sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  }

  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const calendar: OutlookCell[] = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(start, i);
    const iso = format(date, "yyyy-MM-dd");
    return {
      iso,
      dayNum: date.getDate(),
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      detail: "",
      marks: [],
    };
  });
  const cellIndex = new Map(calendar.map((cell, i) => [cell.iso, i]));
  const acc = new Map<string, DayAcc>();
  const ensure = (iso: string): DayAcc | undefined => {
    if (!cellIndex.has(iso)) return undefined;
    let hit = acc.get(iso);
    if (!hit) {
      hit = { todos: new Map(), deadlines: new Map() };
      acc.set(iso, hit);
    }
    return hit;
  };

  let overdue = 0;
  for (const project of projects) {
    if (project.archived) continue;
    const name = project.title.trim() || "未命名项目";
    for (const todo of project.todos) {
      if (todo.done || !todo.endDate) continue;
      if (todo.endDate < todayIso) overdue += 1;
      const bucket = ensure(todo.endDate);
      if (!bucket) continue;
      const hit = bucket.todos.get(project.id);
      if (hit) hit.n += 1;
      else bucket.todos.set(project.id, { name, color: project.color, n: 1 });
    }
    const venue = project.venue;
    const addDeadline = (iso: string | undefined, note: string) => {
      if (!iso) return;
      const bucket = ensure(iso);
      if (!bucket) return;
      const hit = bucket.deadlines.get(project.id) ?? {
        name,
        color: project.color,
        notes: new Set<string>(),
      };
      hit.notes.add(note);
      bucket.deadlines.set(project.id, hit);
    };
    addDeadline(venue?.deadline, "截稿");
    addDeadline(venue?.rebuttalAt, "Rebuttal");
  }

  const byName = (a: OutlookMark, b: OutlookMark) =>
    a.name.localeCompare(b.name, "zh-CN") || a.key.localeCompare(b.key);

  for (const cell of calendar) {
    const bucket = acc.get(cell.iso);
    if (!bucket) {
      cell.detail = cellDetail(cell.iso, []);
      continue;
    }
    const deadlineMarks: OutlookMark[] = [...bucket.deadlines.entries()].map(
      ([key, value]) => {
        const notes = DEADLINE_NOTES.filter((note) => value.notes.has(note));
        return {
          key,
          name: value.name,
          short: shortName(value.name),
          color: value.color,
          kind: "deadline" as const,
          n: notes.length,
          note: notes.join("、"),
        };
      },
    );
    const todoMarks: OutlookMark[] = [...bucket.todos.entries()].map(
      ([key, value]) => ({
        key,
        name: value.name,
        short: shortName(value.name),
        color: value.color,
        kind: "todo" as const,
        n: value.n,
        note: "",
      }),
    );
    cell.marks = [...deadlineMarks.sort(byName), ...todoMarks.sort(byName)];
    cell.detail = cellDetail(cell.iso, cell.marks);
  }

  return { totalMinutes, days, share, overdue, calendar };
}
