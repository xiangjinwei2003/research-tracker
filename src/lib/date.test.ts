import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, fmtMinutes, daysBetween, weekdayLabel } from './date.ts'

test('parse maps a date only ISO string onto the local calendar', () => {
  const d = parse('2026-03-10')
  assert.ok(d)
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 2)
  assert.equal(d.getDate(), 10)
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 0)
})

test('parse of empty or invalid returns null', () => {
  assert.equal(parse(''), null)
  assert.equal(parse('not-a-date'), null)
})

test('fmtMinutes formats under an hour, mixed, and whole hours', () => {
  assert.equal(fmtMinutes(45), '45 分钟')
  assert.equal(fmtMinutes(90), '1.5 小时')
  assert.equal(fmtMinutes(120), '2 小时')
})

test('weekdayLabel names this week, next week, and the week after', () => {
  assert.equal(weekdayLabel('2026-09-10', '2026-09-07'), '本周四')
  assert.equal(weekdayLabel('2026-09-17', '2026-09-07'), '下周四')
  assert.equal(weekdayLabel('2026-09-24', '2026-09-07'), '下下周四')
})

test('daysBetween returns 0 when either side cannot be parsed', () => {
  assert.equal(daysBetween('2026-09-07', 'nope'), 0)
  assert.equal(daysBetween('2026-09-07', '2026-09-10'), 3)
})
