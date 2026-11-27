import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemFs } from './memFs.ts'
import { setDesktop } from './desktop.ts'
import { gitReason, isPlanDir, readPlanSources, readProjectCommits } from './planSources.ts'
import { SETTINGS_FILE, readSettings, updateSettings } from './settings.ts'

const PLAN = '/Users/me/Documents/Projects/plan'
const fs = new MemFs()
let execResult: { stdout: string; stderr: string; code: number | null } | Error = { stdout: '# 工作区改动扫描\n', stderr: '', code: 0 }
const execCalls: { command: string; cwd?: string }[] = []

setDesktop({
  fs,
  os: { homedir: async () => '/Users/me' },
  childProcess: {
    exec: async (command: string, options?: { cwd?: string }) => {
      execCalls.push({ command, cwd: options?.cwd })
      if (execResult instanceof Error) throw execResult
      return { ...execResult, signal: null, truncated: false }
    },
  },
} as unknown as ClaudeDesktop)

test('没有当前状态.md 时报错，说明缺的是哪个文件；isPlanDir 据此判断', async () => {
  await assert.rejects(() => readPlanSources(PLAN), /没有找到 .*当前状态\.md/)
  assert.equal(await isPlanDir(PLAN), false)
})

test('读取当前状态、角色一节、最新周报，并在申请计划目录里运行只读扫描', async () => {
  fs.files.set(`${PLAN}/当前状态.md`, '# 当前状态\n每周 18 小时')
  fs.files.set(`${PLAN}/AGENTS.md`, '# 项目\n\n## 角色\n\n1. 判断依据\n\n## 每周同步\n略')
  fs.files.set(`${PLAN}/reviews/2026-11-16.md`, '旧周报')
  fs.files.set(`${PLAN}/reviews/2026-11-22.md`, '新周报')
  assert.equal(await isPlanDir('~/Documents/Projects/plan'), true)
  const sources = await readPlanSources('~/Documents/Projects/plan')
  assert.equal(sources.state, '# 当前状态\n每周 18 小时')
  assert.equal(sources.role, '## 角色\n\n1. 判断依据')
  assert.deepEqual(sources.review, { name: '2026-11-22.md', text: '新周报' })
  assert.deepEqual(sources.scan, { ok: true, text: '# 工作区改动扫描\n' })
  assert.deepEqual(execCalls.at(-1), { command: '/bin/zsh scripts/scan.sh 7', cwd: PLAN })
})

test('扫描退出码非 0 或命令出错时，记下原因，其余材料照常返回', async () => {
  execResult = { stdout: '', stderr: 'date: illegal option', code: 1 }
  assert.deepEqual((await readPlanSources(PLAN)).scan, { ok: false, reason: 'date: illegal option' })
  execResult = new Error('ENOSYS: commands are off')
  const sources = await readPlanSources(PLAN)
  assert.deepEqual(sources.scan, { ok: false, reason: 'ENOSYS: commands are off' })
  assert.equal(sources.review?.name, '2026-11-22.md')
})

test('没有 AGENTS.md 时在材料里写明', async () => {
  fs.files.delete(`${PLAN}/AGENTS.md`)
  assert.equal((await readPlanSources(PLAN)).role, '（申请计划目录里没有找到 AGENTS.md）')
})

test('本机设置：没有文件时为空；合并写回；内容不是 JSON 时报错', async () => {
  assert.deepEqual(await readSettings(), {})
  assert.deepEqual(await updateSettings({ planDir: PLAN }), { planDir: PLAN })
  assert.deepEqual(JSON.parse(fs.files.get(SETTINGS_FILE)!), { planDir: PLAN })
  assert.deepEqual(await readSettings(), { planDir: PLAN })
  fs.files.set(SETTINGS_FILE, '{坏的')
  await assert.rejects(() => readSettings(), /不是有效的 JSON/)
})

test('项目提交：只读有目录的项目，在项目目录里运行 git log，每条一行；失败的项目记下原因', async () => {
  execCalls.length = 0
  execResult = { stdout: '2026-11-24 写完方法部分\n2026-11-23 加参与者表\n', stderr: '', code: 0 }
  const since = new Date('2026-11-23T00:00:00')
  const ok = await readProjectCommits(
    [
      { id: 'p1', folder: '~/Documents/Projects/proj-a' },
      { id: 'p2' },
    ],
    since,
  )
  assert.deepEqual(ok, { p1: { ok: true, lines: ['2026-11-24 写完方法部分', '2026-11-23 加参与者表'] } })
  assert.equal(execCalls.length, 1)
  assert.equal(execCalls[0].cwd, '/Users/me/Documents/Projects/proj-a')
  assert.match(execCalls[0].command, /^\/usr\/bin\/git log --since=2026-11-23T00:00:00 --no-merges /)
  assert.doesNotMatch(execCalls[0].command, /proj-a/)

  execResult = { stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n', code: 128 }
  assert.deepEqual(await readProjectCommits([{ id: 'p1', folder: '/w/p1' }], since), {
    p1: { ok: false, reason: '目录不是 git 仓库' },
  })
  execResult = new Error('EAGAIN: too many processes')
  assert.deepEqual(await readProjectCommits([{ id: 'p1', folder: '/w/p1' }], since), {
    p1: { ok: false, reason: 'EAGAIN: too many processes' },
  })
  assert.equal(gitReason('', 1), '退出码 1')
  assert.equal(gitReason('error: bad\nsecond line', 2), 'error: bad')
})
