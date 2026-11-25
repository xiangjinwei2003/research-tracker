import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { MemFs } from './memFs.ts'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}
const { setDesktop } = await import('./desktop.ts')
const { readSessionInfo, resolvePendingSessions } = await import('./claudeSessions.ts')
const { useStore } = await import('../lib/store.ts')

const ROOT = '/Users/me/Library/Application Support/Claude/claude-code-sessions'
const fs = new MemFs()
const findCalls: string[][] = []

setDesktop({
  fs,
  os: { homedir: async () => '/Users/me' },
  childProcess: {
    spawn: (_cmd: string, args: string[]) => {
      findCalls.push(args)
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() })
      const name = args[args.indexOf('-name') + 1]
      const re = new RegExp(`^${name.replace(/[.]/g, '\\.').replace('*', '.*')}$`)
      const hits = [...fs.files.keys()].filter((k) => k.startsWith(ROOT) && re.test(k.split('/').pop()!))
      setTimeout(() => {
        child.stdout.emit('data', hits.join('\n') + (hits.length ? '\n' : ''))
        child.emit('close', 0, null)
      }, 0)
      return child
    },
  },
} as unknown as ClaudeDesktop)

const meta = (id: string, cwd: string, createdAt: number, title: string) =>
  JSON.stringify({ sessionId: `local_${id}`, cwd, createdAt, lastActivityAt: createdAt + 1000, title, isArchived: false })

test('resolvePendingSessions：只看发送之后改动的记录，配上的写进笔记；再次运行不重复配对', async () => {
  const now = Date.now()
  const id = useStore.getState().addNote({ date: '2026-11-25', text: '整理访谈记录' })
  useStore.getState().markNoteSent(id, { at: now - 60_000, folder: '/w/proj-a', prompt: 'p' })
  fs.files.set(`${ROOT}/acc/org/local_s1.json`, meta('s1', '/w/proj-a', now - 30_000, '整理访谈记录'))
  fs.files.set(`${ROOT}/acc/org/local_s0.json`, meta('s0', '/w/proj-a', now - 600_000, '更早的会话'))
  assert.equal(await resolvePendingSessions(), 1)
  const args = findCalls.at(-1)!
  assert.deepEqual(args.slice(0, 4), [ROOT, '-name', 'local_*.json', '-mmin'])
  const note = useStore.getState().notes.find((n: { id: string }) => n.id === id)
  assert.equal(note.sent[0].sessionId, 'local_s1')
  assert.equal(await resolvePendingSessions(), 0)
})

test('readSessionInfo：按 id 找到记录文件并读出标题与最后活动时间；记录不在时返回 null', async () => {
  fs.files.set(`${ROOT}/acc/org/local_s9.json`, meta('s9', '/w/b', 5, '另一个会话'))
  const info = await readSessionInfo('local_s9')
  assert.equal(info?.title, '另一个会话')
  assert.equal(info?.lastActivityAt, 1005)
  assert.equal(await readSessionInfo('local_missing'), null)
})
