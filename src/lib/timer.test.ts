import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmtCountdown, timerEnd, timerLabel, timerRemaining } from './timer.ts'
import { trayMenu, trayTitle } from './trayMenu.ts'
import type { ActiveTimer } from './types.ts'

const timer: ActiveTimer = { startedAt: 1_000_000, plannedMin: 30, todoTitle: '整理访谈记录', projectTitle: '示例项目', projectId: 'p1' }

test('倒计时文字与剩余时间：夹在 0 与计划时长之间', () => {
  assert.equal(fmtCountdown(309_000), '05:09')
  assert.equal(fmtCountdown(-5), '00:00')
  assert.equal(timerEnd(timer), 1_000_000 + 30 * 60_000)
  assert.equal(timerRemaining(timer, 1_000_000 - 2_000), 30 * 60_000)
  assert.equal(timerRemaining(timer, 1_000_000 + 60_000), 29 * 60_000)
  assert.equal(timerRemaining(timer, 1_000_000 + 31 * 60_000), 0)
})

test('计时名称：任务，否则项目，否则自由专注', () => {
  assert.equal(timerLabel(timer), '整理访谈记录')
  assert.equal(timerLabel({ ...timer, todoTitle: '  ' }), '示例项目')
  assert.equal(timerLabel({ startedAt: 1, plannedMin: 30, projectId: 'p1' }), '未命名项目')
  assert.equal(timerLabel({ startedAt: 1, plannedMin: 30 }), '自由专注')
})

test('菜单栏：空闲时可开始专注，计时中显示任务名、提前结束与取消；标题是剩余时间', () => {
  const calls: string[] = []
  const act = {
    start: (m: number) => calls.push(`start ${m}`),
    finish: () => calls.push('finish'),
    cancel: () => calls.push('cancel'),
    quickNote: () => calls.push('note'),
    open: () => calls.push('open'),
  }
  const idle = trayMenu(null, act)
  assert.deepEqual(idle.map((i) => i.label ?? i.type), ['专注 30 分钟', '专注 1 小时', 'separator', '记一条笔记', '打开 Research Tracker'])
  idle[1].click?.({})
  idle[3].click?.({})
  const running = trayMenu(timer, act)
  assert.deepEqual(running.map((i) => i.label ?? i.type), ['整理访谈记录', '提前结束并记录', '取消（不记录）', 'separator', '记一条笔记', '打开 Research Tracker'])
  assert.equal(running[0].enabled, false)
  running[1].click?.({})
  assert.deepEqual(calls, ['start 60', 'note', 'finish'])
  assert.equal(trayTitle(null, 0), undefined)
  assert.equal(trayTitle(timer, 1_000_000 + 60_000), '29:00')
})
