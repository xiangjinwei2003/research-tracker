import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../output/color-id");

function styleBlock(html: string): string {
  const match = html.match(/<style id="id-treatment">([\s\S]*?)<\/style>/);
  if (!match) throw new Error("missing id-treatment");
  return match[1].trim();
}

function marksBlock(html: string): string {
  const start = html.indexOf("<!-- marks-start -->");
  const end = html.indexOf("<!-- marks-end -->");
  if (start < 0 || end < 0) throw new Error("missing marks");
  return html.slice(start, end).trim();
}

test("ten color pages share one card and one set of marks, and differ in treatment", () => {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".html"))
    .sort();
  assert.deepEqual(
    files,
    ["01.html", "02.html", "03.html", "04.html", "05.html", "06.html", "07.html", "08.html", "09.html", "10.html"],
  );

  const pages = files.map((name) => readFileSync(join(dir, name), "utf8"));
  const treatments = pages.map((html) => styleBlock(html));
  const marks = pages.map((html) => marksBlock(html));

  assert.equal(new Set(treatments).size, 10);
  assert.equal(new Set(marks).size, 1);
  for (const html of pages) {
    assert.equal((html.match(/data-sample-card/g) ?? []).length, 1);
    assert.equal((html.match(/补全第三周的文献矩阵/g) ?? []).length, 1);
    assert.equal(html.includes("type=\"module\""), false);
    assert.equal(html.includes("<script"), false);
    assert.match(html, /#6f8cff/);
    assert.match(html, /#e07a5f/);
  }
  for (const css of treatments) {
    assert.ok(css.length > 10);
  }
});
