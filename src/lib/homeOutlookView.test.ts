import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOutlook } from "../components/HomeOutlook.tsx";
import { defaultStages, type FocusSession, type Project, type Todo } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function textOnly(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, "");
}

const task = (id: string, endDate: string, done = false): Todo => ({
  id,
  title: id,
  endDate,
  done,
  stage: "literature",
});

const proj = (id: string, title: string, color: string, todos: Todo[]): Project => ({
  id,
  title,
  description: "",
  color,
  stage: "literature",
  stages: defaultStages(),
  startDate: "",
  collaborators: [],
  todos,
  notes: "",
  archived: false,
  createdAt: "",
  updatedAt: "",
});

const atNoon = (iso: string) => new Date(`${iso}T12:00:00`).getTime();

const session = (id: string, iso: string, minutes: number, projectId: string): FocusSession => ({
  id,
  startedAt: atNoon(iso),
  endedAt: atNoon(iso) + minutes * 60_000,
  plannedMin: minutes,
  completed: true,
  projectId,
});

function render(projects: Project[], sessions: FocusSession[]): string {
  return renderToStaticMarkup(
    createElement(HomeOutlook, {
      projects,
      sessions,
      todayIso: "2026-10-01",
      nowMs: new Date(2026, 9, 1, 18, 0, 0, 0).getTime(),
      onOpenDay: () => {},
      onShowOverdue: () => {},
      onOpenProject: () => {},
      onReview: () => {},
    }),
  );
}

test("outlook band keeps the marks and paints no text", () => {
  const projects = [
    proj("p1", "协作注意", "#f00", [
      task("soon", "2026-10-03"),
      task("late", "2026-09-30"),
      task("withDeadline", "2026-10-06"),
    ]),
    proj("p2", "临床对话", "#0f0", [task("later", "2026-10-08")]),
  ];
  projects[1].venue = { name: "CHI", deadline: "2026-10-06", rebuttalAt: "2026-10-08" };
  const html = render(projects, [
    session("mon", "2026-09-28", 40, "p1"),
    session("thu", "2026-10-01", 20, "p2"),
  ]);

  assert.equal(textOnly(html), "");
  assert.match(html, /data-outlook-band/);
  assert.match(html, /data-focus-plot/);
  assert.match(html, /data-outlook-panel="share"/);
  assert.match(html, /data-outlook-panel="calendar"/);
  assert.match(html, /outlook-stack/);
  assert.match(html, /outlook-share/);
  assert.match(html, /outlook-tick/);
  assert.match(html, /aria-label="专注 /);
  assert.equal(html.includes(">专注<"), false);
  assert.equal(html.includes(">占比<"), false);
  assert.equal(html.includes(">临近<"), false);
  assert.equal(html.includes("逾期"), false);
});

test("empty outlook band still renders the three panels without text", () => {
  const html = render([], []);
  assert.equal(textOnly(html), "");
  assert.equal((html.match(/data-outlook-panel=/g) ?? []).length, 3);
  assert.equal((html.match(/outlook-col/g) ?? []).length, 7);
  assert.equal((html.match(/outlook-day/g) ?? []).length, 14);
});

test("shell width is one variable and the old insets are gone", () => {
  const css = readFileSync(join(root, "src/index.css"), "utf8");
  const app = readFileSync(join(root, "src/App.tsx"), "utf8");
  const header = readFileSync(join(root, "src/components/Header.tsx"), "utf8");
  const board = readFileSync(join(root, "src/components/Board.tsx"), "utf8");
  const container = readFileSync(join(root, "src/components/ui/Container.tsx"), "utf8");

  assert.match(css, /--sidebar-w:\s*0px/);
  assert.match(css, /--sidebar-w:\s*68px/);
  assert.match(css, /--sidebar-w:\s*224px/);
  assert.match(css, /grid-template-columns:\s*var\(--sidebar-w\)/);
  assert.equal(app.includes("md:pl-[68px]"), false);
  assert.equal(app.includes("pl-56"), false);
  assert.equal(header.includes("md:ml-[68px]"), false);
  assert.equal(header.includes("ml-56"), false);
  assert.equal(header.includes("w-[68px]"), false);
  assert.equal(board.includes("min-h-[340px]"), false);
  assert.equal(container.includes("max-w-[1500px]"), false);
  assert.match(css, /\.outlook-col\s*\{[^}]*background:/);
  assert.equal(css.includes("height: 48px"), false);
  assert.match(css, /\.outlook-plot\s*\{[^}]*min-height:\s*36px/);
  assert.equal(/\.outlook-plot\s*\{[^}]*max-height:/.test(css), false);
  assert.match(css, /\.app-main\s*\{[^}]*min-height:\s*100dvh/);
});
