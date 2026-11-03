import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { hourProfile, manualSpan, projectShare, recentLabels, resolveSession, streakDays, sessionMinutes } from './focus.ts'
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

test('manualSpan ends today at now and starts past days at midnight', () => {
  const M = 60_000
  const now = new Date(2026, 10, 2, 10, 0).getTime()
  assert.deepEqual(manualSpan({ iso: '2026-11-02', minutes: 45, now }), {
    startedAt: now - 45 * M,
    endedAt: now,
  })
  const past = new Date(2026, 9, 30).getTime()
  assert.deepEqual(manualSpan({ iso: '2026-10-30', minutes: 90, now }), {
    startedAt: past,
    endedAt: past + 90 * M,
  })
  assert.deepEqual(manualSpan({ iso: '2026-11-02', minutes: 11 * 60, now }), {
    error: '超过今天已经过去的时长',
  })
  assert.deepEqual(manualSpan({ iso: '2026-11-03', minutes: 30, now }), { error: '不能补记未来的日子' })
  assert.deepEqual(manualSpan({ iso: '2026-11-02', minutes: 0, now }), { error: '请选择时长' })
  assert.deepEqual(manualSpan({ iso: '', minutes: 30, now }), { error: '请选择日期' })
})

test('custom labels resolve as their own item and their own share row', () => {
  const a = { ...sess('a', 1000), label: '英语' }
  const b = { ...sess('b', 2000), label: '英语' }
  const c = { ...sess('c', 3000), label: '健身' }
  const r = [a, b, c].map((s) => resolveSession(s, new Map()))
  assert.equal(r[0].label, '英语')
  assert.equal(r[0].projectTitle, '英语')
  assert.deepEqual(
    projectShare(r).map((x) => [x.name, x.minutes]),
    [['英语', 60], ['健身', 30]],
  )
  assert.deepEqual(recentLabels([a, b, c]), ['健身', '英语'])
})

test('projectShare 按任务汇总，只有未关联任务时不列任务', () => {
  const t0 = new Date(2026, 10, 2, 9).getTime()
  const p = (id: string, todoId?: string, todoTitle?: string): FocusSession => ({
    ...sess(id, t0),
    projectId: 'p1',
    projectTitle: '论文',
    todoId,
    todoTitle,
  })
  const q: FocusSession = { ...sess('q', t0), projectId: 'p2', projectTitle: '综述' }
  const share = projectShare(
    [p('a', 't1', '问卷分析'), p('b', 't1', '问卷分析'), p('c', 't2', '写引言'), p('d'), q].map((s) =>
      resolveSession(s, new Map()),
    ),
  )
  assert.deepEqual(
    share[0].tasks.map((t) => [t.title, t.minutes]),
    [['问卷分析', 60], ['写引言', 30], ['未关联任务', 30]],
  )
  assert.deepEqual(share[1].tasks, [])
})

test('hourProfile 跨整点拆分，补记不计入', () => {
  const start = new Date(2026, 10, 2, 9, 40).getTime()
  const a: FocusSession = { ...sess('a', start), endedAt: start + 40 * 60_000 }
  const m: FocusSession = { ...sess('m', start), manual: true }
  const hours = hourProfile([a, m].map((s) => resolveSession(s, new Map())))
  assert.equal(hours[9], 20)
  assert.equal(hours[10], 20)
  assert.equal(hours.reduce((x, y) => x + y, 0), 40)
})
