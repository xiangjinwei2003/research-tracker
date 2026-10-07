import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcs, escapeText, eventUid, foldLine, icsDate } from './ics.ts'
import type { CalendarSnapshot, CalendarTodo } from './calendarSnapshot.ts'

const STAMP = new Date('2026-10-07T08:30:00.000Z')

function todo(over: Partial<CalendarTodo> = {}): CalendarTodo {
  return {
    id: 't1',
    projectId: 'p1',
    project: 'CHI 论文',
    title: '改 discussion',
    due: '2026-10-20',
    done: false,
    ...over,
  }
}

function snap(...todos: CalendarTodo[]): CalendarSnapshot {
  return { v: 1, todos }
}

/** Undo RFC 5545 folding so assertions can look at logical lines. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n')
}

const byteLen = (s: string) => new TextEncoder().encode(s).byteLength

test('escapeText escapes backslash, semicolon, comma and newlines', () => {
  assert.equal(escapeText('a\\b;c,d\ne\r\nf'), 'a\\\\b\\;c\\,d\\ne\\nf')
})

test('escaped summary appears in the calendar', () => {
  const lines = unfold(buildIcs(snap(todo({ title: 'a, b; c\\d\ne' })), STAMP))
  assert.ok(lines.includes('SUMMARY:[CHI 论文] a\\, b\\; c\\\\d\\ne'))
})

test('every line ends with CRLF and no bare LF remains', () => {
  const ics = buildIcs(snap(todo()), STAMP)
  assert.ok(ics.endsWith('\r\n'))
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false)
})

test('foldLine keeps ASCII lines at 75 octets', () => {
  const folded = foldLine('X'.repeat(200)).split('\r\n')
  assert.equal(folded[0].length, 75)
  for (const l of folded) assert.ok(byteLen(l) <= 75)
  for (const l of folded.slice(1)) assert.equal(l[0], ' ')
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), 'X'.repeat(200))
})

test('foldLine counts UTF-8 bytes and never splits a Chinese character', () => {
  const line = 'SUMMARY:' + '中文标题'.repeat(20)
  const folded = foldLine(line).split('\r\n')
  assert.ok(folded.length > 1)
  for (const l of folded) {
    assert.ok(byteLen(l) <= 75, `line is ${byteLen(l)} bytes`)
    assert.equal(l.includes('�'), false)
  }
  // First line: 8 ASCII bytes + 22 characters × 3 bytes = 74; a 23rd would be 77.
  assert.equal(byteLen(folded[0]), 74)
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), line)
})

test('foldLine handles 4 byte characters', () => {
  const folded = foldLine('😀'.repeat(40)).split('\r\n')
  for (const l of folded) assert.ok(byteLen(l) <= 75)
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), '😀'.repeat(40))
})

test('UID is built from project id and todo id and survives a date change', () => {
  const a = unfold(buildIcs(snap(todo({ due: '2026-10-20' })), STAMP))
  const b = unfold(buildIcs(snap(todo({ due: '2026-11-03', title: '改 intro' })), new Date()))
  const uid = `UID:${eventUid('p1', 't1')}`
  assert.ok(a.includes(uid))
  assert.ok(b.includes(uid))
  assert.equal(eventUid('p1', 't1'), eventUid('p1', 't1'))
  assert.notEqual(eventUid('p1', 't1'), eventUid('p2', 't1'))
})

test('todos without a valid due date are excluded', () => {
  const ics = buildIcs(
    snap(todo({ id: 'a', due: '' }), todo({ id: 'b', due: '2026-02-30' }), todo({ id: 'c', due: 'soon' })),
    STAMP,
  )
  assert.equal(ics.includes('BEGIN:VEVENT'), false)
})

test('done todos are excluded', () => {
  const ics = buildIcs(snap(todo({ done: true })), STAMP)
  assert.equal(ics.includes('BEGIN:VEVENT'), false)
})

test('all day events use VALUE=DATE with an exclusive next day DTEND', () => {
  const lines = unfold(buildIcs(snap(todo({ due: '2026-12-31' })), STAMP))
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20261231'))
  assert.ok(lines.includes('DTEND;VALUE=DATE:20270101'))
  assert.ok(lines.includes('DTSTAMP:20261007T083000Z'))
})

test('icsDate rejects impossible dates', () => {
  assert.equal(icsDate('2026-02-29'), null)
  assert.equal(icsDate('2028-02-29'), '20280229')
})

test('calendar header carries name and refresh hints', () => {
  const lines = unfold(buildIcs(snap(), STAMP))
  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.ok(lines.includes('X-WR-CALNAME:Research Tracker'))
  assert.ok(lines.includes('REFRESH-INTERVAL;VALUE=DURATION:PT5M'))
  assert.ok(lines.includes('X-PUBLISHED-TTL:PT5M'))
  assert.equal(lines.at(-2), 'END:VCALENDAR')
})

test('summary uses [project] title with fallbacks for empty names', () => {
  const lines = unfold(buildIcs(snap(todo({ project: '', title: '' })), STAMP))
  assert.ok(lines.includes('SUMMARY:[未命名项目] 未命名'))
})
