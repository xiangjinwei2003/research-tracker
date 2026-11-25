// 把 `vite build --mode artifact` 生成的单文件 HTML 改成 Artifact 页面格式。
//
// Artifact 发布时会给页面套上自己的 <!doctype>、<head>、<body>，所以文件里不能再有这些标签：
// 顺序为 <title>、<style>、桌面应用权限清单、#root、内联的模块脚本。
// 结构和预期不符时直接报错退出，不输出半成品。
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'dist-artifact/index.html'
const OUT = 'dist-artifact/research-tracker.html'

// 桌面应用的权限清单：只列页面实际调用的权限（desktop.d.ts 的 Manifest 说明）。
const MANIFEST = { permissions: ["full-access", "shortcuts", "notifications", "menu-bar", "overlay"] }

function fail(message) {
  console.error(`[artifact-page] ${message}`)
  process.exit(1)
}

const html = readFileSync(SRC, 'utf8')

const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
if (!title) fail('没有找到 <title>')

const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
if (styles.length === 0) fail('没有找到内联的 <style>')

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
const modules = scripts.filter((m) => /type="module"/.test(m[1]))
if (modules.length !== 1) fail(`应有 1 个内联模块脚本，实际 ${modules.length} 个`)
if (scripts.length !== modules.length) fail('出现了预期之外的 <script>')
const code = modules[0][2]
if (/src=/.test(modules[0][1]) || !code.trim()) fail('模块脚本没有内联')
if (/<\/script/i.test(code)) fail('脚本内容里含有 </script，会截断页面')

const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1]
if (body === undefined) fail('没有找到 <body>')
const bodyMarkup = body.replace(/<script\b[\s\S]*?<\/script>/g, '').trim()
if (bodyMarkup !== '<div id="root"></div>') fail(`body 里有预期之外的内容：${bodyMarkup.slice(0, 120)}`)

const page = [
  `<title>${title}</title>`,
  `<style>${styles.join('\n')}</style>`,
  `<script type="application/json" id="claude-artifacts-manifest">${JSON.stringify(MANIFEST)}</script>`,
  '<div id="root"></div>',
  `<script type="module">${code}</script>`,
  '',
].join('\n')

writeFileSync(OUT, page)
console.log(`[artifact-page] ${OUT}  ${(Buffer.byteLength(page) / 1024).toFixed(1)} KiB`)
