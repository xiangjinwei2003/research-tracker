import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../output/card-schemes");
const names = ["01.html", "02.html", "03.html", "04.html", "05.html", "06.html", "07.html", "08.html", "09.html", "10.html"];

function styleBlock(html: string): string {
  const match = html.match(/<style id="card-treatment">([\s\S]*?)<\/style>/);
  if (!match) throw new Error("missing card-treatment");
  return match[1].trim();
}

function factsBlock(html: string): string {
  const start = html.indexOf("<!-- facts-start -->");
  const end = html.indexOf("<!-- facts-end -->");
  if (start < 0 || end < 0) throw new Error("missing facts");
  return html.slice(start, end).trim();
}

function readFamily(dir: string): string[] {
  const files = readdirSync(dir).filter((name) => name.endsWith(".html")).sort();
  assert.deepEqual(files, names);
  return files.map((name) => readFileSync(join(dir, name), "utf8"));
}

test("ten project card schemes share one fact block and differ in treatment", () => {
  const pages = readFamily(join(root, "project"));
  const treatments = pages.map(styleBlock);
  const facts = pages.map(factsBlock);
  assert.equal(new Set(treatments).size, 10);
  assert.equal(new Set(facts).size, 1);
  pages.forEach((html, index) => {
    const n = index + 1;
    assert.equal((html.match(/data-sample-card/g) ?? []).length, 1);
    assert.match(html, new RegExp(`<h1 class="scheme">项目方案 ${n}</h1>`));
    assert.match(html, /<p class="interaction">[^<]{8,}<\/p>/);
    assert.equal(html.includes("type=\"module\""), false);
    assert.equal(html.includes("<script"), false);
    assert.match(html, /注意力机制综述/);
    assert.match(html, /文献/);
    assert.match(html, /CHI/);
    assert.match(html, /还剩 2 天/);
    assert.match(html, /10月3日/);
    assert.match(html, /文献 1\/4/);
    assert.match(html, /待办 0\/1/);
    assert.match(html, /完整prototype1/);
    assert.match(html, /#6f8cff/);
  });
  for (const css of treatments) assert.ok(css.length > 40);
});

test("ten task card schemes share one fact block and differ in treatment", () => {
  const pages = readFamily(join(root, "task"));
  const treatments = pages.map(styleBlock);
  const facts = pages.map(factsBlock);
  assert.equal(new Set(treatments).size, 10);
  assert.equal(new Set(facts).size, 1);
  pages.forEach((html, index) => {
    const n = index + 1;
    assert.equal((html.match(/data-sample-card/g) ?? []).length, 1);
    assert.match(html, new RegExp(`<h1 class="scheme">任务方案 ${n}</h1>`));
    assert.match(html, /<p class="interaction">[^<]{8,}<\/p>/);
    assert.equal(html.includes("type=\"module\""), false);
    assert.equal(html.includes("<script"), false);
    assert.match(html, /注意力机制综述/);
    assert.match(html, /补全第三周的文献矩阵/);
    assert.match(html, /逾期 · 9月30日/);
    assert.match(html, /只保留有全文的条目/);
    assert.match(html, /手动加入/);
    assert.match(html, /林可/);
    assert.match(html, /45 分钟/);
    assert.match(html, />完成</);
    assert.match(html, />专注</);
  });
  for (const css of treatments) assert.ok(css.length > 40);
});
