import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { manualSessionError, resolveSession, streakDays, sessionMinutes } from './focus.ts'
import type { FocusSession } from './types.ts'

function sess(id: string, startedAt: number): FocusSession {
  return {
    id,
    plannedMin: 30,
    startedAt,
    endedAt: startedAt + 30 * 60_000,
    completed: true,
  }
}

test('longest streak counts two adjacent local calendar days', () => {
  const a = new Date(2026, 2, 10, 15, 0, 0).getTime()
  const b = new Date(2026, 2, 11, 9, 0, 0).getTime()
  const now = new Date(2026, 2, 11, 18, 0, 0)
  const { longest, current } = streakDays([sess('1', a), sess('2', b)], now)
  assert.equal(longest, 2)
  assert.equal(current, 2)
})

test('longest streak of adjacent days is 2 west of UTC', () => {
  const focusUrl = new URL('./focus.ts', import.meta.url).href
  const r = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
      import assert from 'node:assert/strict'
      import { streakDays } from ${JSON.stringify(focusUrl)}
      const sess = (id, t) => ({
        id,
        plannedMin: 30,
        startedAt: t,
        endedAt: t + 30 * 60000,
        completed: true,
      })
      const a = new Date(2026, 2, 10, 15, 0, 0).getTime()
      const b = new Date(2026, 2, 11, 9, 0, 0).getTime()
      const now = new Date(2026, 2, 11, 18, 0, 0)
      assert.equal(streakDays([sess('1', a), sess('2', b)], now).longest, 2)
      `,
    ],
    { encoding: 'utf8', env: { ...process.env, TZ: 'America/Los_Angeles' } },
  )
  assert.equal(r.status, 0, `${r.stderr || ''}${r.stdout || ''}`)
})

test('longest streak does not span a gap', () => {
  const a = new Date(2026, 2, 10, 12, 0, 0).getTime()
  const b = new Date(2026, 2, 11, 12, 0, 0).getTime()
  const c = new Date(2026, 2, 13, 12, 0, 0).getTime()
  const now = new Date(2026, 2, 13, 18, 0, 0)
  const { longest } = streakDays([sess('1', a), sess('2', b), sess('3', c)], now)
  assert.equal(longest, 2)
})

test('a bound session with an empty title is not free focus', () => {
  const startedAt = new Date(2026, 8, 24, 9, 0, 0).getTime()
  const session: FocusSession = {
    id: 's',
    plannedMin: 30,
    startedAt,
    endedAt: startedAt + 30 * 60_000,
    completed: true,
    projectId: 'p1',
    projectTitle: '',
  }
  const projects = new Map([
    ['p1', { id: 'p1', title: '   ' } as never],
  ])
  const resolved = resolveSession(session, projects)
  assert.equal(resolved.projectTitle, '未命名项目')
  assert.equal(resolved.label, '未命名项目')
  const unbound = resolveSession({ ...session, projectId: undefined, projectTitle: undefined }, projects)
  assert.equal(unbound.projectTitle, '自由专注')
})

test('sessionMinutes floors at 1', () => {
  assert.equal(
    sessionMinutes({
      id: 's',
      plannedMin: 30,
      startedAt: 1_000,
      endedAt: 1_000 + 10_000,
      completed: false,
    }),
    1,
  )
})

test('manualSessionError rejects reversed, short, future and overlapping spans', () => {
  const M = 60_000
  const base = { sessions: [sess('a', 100 * M)], now: 1000 * M }
  assert.equal(manualSessionError({ ...base, startedAt: 10 * M, endedAt: 5 * M }), '结束时间需晚于开始时间')
  assert.equal(manualSessionError({ ...base, startedAt: 10 * M, endedAt: 10 * M + 30_000 }), '时长不足 1 分钟')
  assert.equal(manualSessionError({ ...base, startedAt: 990 * M, endedAt: 1001 * M }), '结束时间晚于现在')
  assert.match(manualSessionError({ ...base, startedAt: 120 * M, endedAt: 140 * M }) ?? '', /重叠/)
  // 首尾相接不算重叠。
  assert.equal(manualSessionError({ ...base, startedAt: 130 * M, endedAt: 160 * M }), null)
  assert.equal(manualSessionError({ ...base, startedAt: 70 * M, endedAt: 100 * M }), null)
  assert.equal(
    manualSessionError({ ...base, startedAt: 500 * M, endedAt: 600 * M, activeStartedAt: 550 * M }),
    '与正在进行的专注重叠',
  )
  assert.equal(manualSessionError({ ...base, startedAt: NaN, endedAt: 600 * M }), '请填写开始和结束时间')
})
