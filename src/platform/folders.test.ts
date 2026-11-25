import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { MemFs } from './memFs.ts'
import { setDesktop } from './desktop.ts'
import { expandHome, folderExists, listProjectFolders, writeTaskFile } from './folders.ts'
import { openClaudeLink } from './claudeCode.ts'

const HOME = '/Users/me'
const fs = new MemFs()
let platform = 'darwin'
let exitCode = 0
const spawned: { command: string; args: string[] }[] = []

setDesktop({
  fs,
  os: {
    homedir: async () => HOME,
    platform: async () => platform,
  },
  childProcess: {
    spawn: (command: string, args: string[]) => {
      spawned.push({ command, args })
      const child = new EventEmitter()
      setTimeout(() => child.emit('exit', exitCode, null), 0)
      return child
    },
  },
} as unknown as ClaudeDesktop)

test('expandHome：只展开 ~ 开头的路径', async () => {
  assert.equal(await expandHome('~/Documents/Projects/proj-a'), `${HOME}/Documents/Projects/proj-a`)
  assert.equal(await expandHome('~'), HOME)
  assert.equal(await expandHome(' /opt/x '), '/opt/x')
})

test('listProjectFolders：列出 ~/Documents/Projects 的子目录，跳过隐藏目录和文件', async () => {
  fs.dirs.add('~/Documents/Projects')
  fs.dirs.add('~/Documents/Projects/proj-a')
  fs.dirs.add('~/Documents/Projects/todo web')
  fs.dirs.add('~/Documents/Projects/.obsidian')
  fs.files.set('~/Documents/Projects/README.md', '')
  assert.deepEqual(await listProjectFolders(), [
    `${HOME}/Documents/Projects/proj-a`,
    `${HOME}/Documents/Projects/todo web`,
  ])
})

test('folderExists：目录存在返回 true，文件或不存在返回 false', async () => {
  fs.dirs.add('/work/proj-a')
  fs.files.set('/work/file.txt', '')
  assert.equal(await folderExists('/work/proj-a'), true)
  assert.equal(await folderExists('/work/file.txt'), false)
  assert.equal(await folderExists('/work/missing'), false)
})

test('writeTaskFile：写到 docs/tasks，重名时加序号，不覆盖已有文件', async () => {
  const first = await writeTaskFile({ folder: '/work/proj-a', date: '2026-11-25', title: '整理记录', content: 'A' })
  const second = await writeTaskFile({ folder: '/work/proj-a', date: '2026-11-25', title: '整理记录', content: 'B' })
  assert.equal(first, 'docs/tasks/2026-11-25_整理记录.md')
  assert.equal(second, 'docs/tasks/2026-11-25_整理记录_2.md')
  assert.equal(fs.files.get('/work/proj-a/docs/tasks/2026-11-25_整理记录.md'), 'A')
  assert.equal(fs.files.get('/work/proj-a/docs/tasks/2026-11-25_整理记录_2.md'), 'B')
  assert.ok(fs.dirs.has('/work/proj-a/docs/tasks'))
})

test('openClaudeLink：桌面版用 open 打开深链接，参数不经过 shell；退出码非 0 或非 macOS 时报错', async () => {
  const url = 'claude://code/new?q=%E6%95%B4%E7%90%86&folder=%2Fwork%2Fproj-a'
  assert.equal(await openClaudeLink(url), 'opened')
  assert.deepEqual(spawned.at(-1), { command: 'open', args: [url] })
  exitCode = 1
  await assert.rejects(() => openClaudeLink(url), /退出码 1/)
  exitCode = 0
  platform = 'win32'
  await assert.rejects(() => openClaudeLink(url), /macOS/)
  platform = 'darwin'
})
