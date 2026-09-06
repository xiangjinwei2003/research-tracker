import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { streakDays, sessionMinutes } from './focus.ts'
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
