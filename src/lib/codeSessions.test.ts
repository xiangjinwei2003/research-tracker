import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MATCH_WINDOW_MS, continueSessionUrl, matchSessions, parseSessionMeta, type CodeSessionInfo } from './codeSessions.ts'

const ID = 'local_0b6f5c2e-1d2a-4c3b-9e8f-1234567890ab'

test('parseSessionMeta：只认合规的会话 id 与必要字段，最后活动时间缺省为创建时间', () => {
  const meta = parseSessionMeta(
    JSON.stringify({ sessionId: ID, cwd: '/w/a', createdAt: 100, lastActivityAt: 200, title: '整理记录', isArchived: false, other: 1 }),
  )
  assert.deepEqual(meta, { sessionId: ID, cwd: '/w/a', createdAt: 100, lastActivityAt: 200, title: '整理记录', isArchived: false })
  assert.equal(parseSessionMeta(JSON.stringify({ sessionId: 'abc', cwd: '/w', createdAt: 1 })), null)
  assert.equal(parseSessionMeta(JSON.stringify({ sessionId: ID, createdAt: 1 })), null)
  assert.equal(parseSessionMeta('{坏的'), null)
  assert.equal(parseSessionMeta(JSON.stringify({ sessionId: ID, cwd: '/w', createdAt: 5 }))?.lastActivityAt, 5)
})

test('continueSessionUrl：合规 id 拼出 claude://code/continue，不合规时报错', () => {
  assert.equal(continueSessionUrl(ID), `claude://code/continue?session=${ID}`)
  assert.throws(() => continueSessionUrl('local_../x'), /格式不对/)
})

const s = (id: string, cwd: string, createdAt: number): CodeSessionInfo => ({
  sessionId: `local_${id}`,
  cwd,
  createdAt,
  lastActivityAt: createdAt,
  title: id,
  isArchived: false,
})

test('matchSessions：同一目录、发送之后建立的最早会话；已配过的不再配；同一目录连发按先后配对', () => {
  const sessions = [s('old', '/w/a', 900), s('b1', '/w/a', 1_010_000), s('other', '/w/b', 1_005_000), s('b2', '/w/a', 1_020_000), s('used', '/w/a', 1_001_000)]
  const pending = [
    { noteId: 'n2', at: 1_015_000, folder: '/w/a' },
    { noteId: 'n1', at: 1_000_000, folder: '/w/a' },
  ]
  assert.deepEqual(matchSessions(pending, sessions, new Set(['local_used'])), [
    { noteId: 'n1', at: 1_000_000, sessionId: 'local_b1' },
    { noteId: 'n2', at: 1_015_000, sessionId: 'local_b2' },
  ])
})

test('matchSessions：超出时间窗口或目录不同的不配', () => {
  const pending = [{ noteId: 'n', at: 1_000_000, folder: '/w/a' }]
  assert.deepEqual(matchSessions(pending, [s('late', '/w/a', 1_000_000 + MATCH_WINDOW_MS + 1)], new Set()), [])
  assert.deepEqual(matchSessions(pending, [s('x', '/w/b', 1_000_100)], new Set()), [])
  // 时钟误差 5 秒以内仍算发送之后。
  assert.equal(matchSessions(pending, [s('early', '/w/a', 997_000)], new Set()).length, 1)
})
