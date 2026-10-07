import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleCalendarRequest, MAX_BODY_BYTES, TTL_SECONDS, sha256Hex, type CalendarStore } from './calendarApi.ts'
import type { CalendarSnapshot } from '../lib/calendarSnapshot.ts'

/** Same value layout and ownership rules as the Redis store: `<hash>\n<json>`. */
class MemoryStore implements CalendarStore {
  data = new Map<string, string>()
  ttl = new Map<string, number>()
  async put(id: string, hash: string, value: string, ttlSec: number) {
    const cur = this.data.get(id)
    if (cur !== undefined && cur.slice(0, 64) !== hash) return 'forbidden' as const
    this.data.set(id, `${hash}\n${value}`)
    this.ttl.set(id, ttlSec)
    return 'ok' as const
  }
  async read(id: string, ttlSec: number) {
    const cur = this.data.get(id)
    if (cur === undefined) return null
    this.ttl.set(id, ttlSec)
    return cur.slice(65)
  }
  async remove(id: string, hash: string) {
    const cur = this.data.get(id)
    if (cur === undefined) return 'missing' as const
    if (cur.slice(0, 64) !== hash) return 'forbidden' as const
    this.data.delete(id)
    this.ttl.delete(id)
    return 'ok' as const
  }
}

const ID = 'A'.repeat(43)
const KEY = 'k'.repeat(43)
const OTHER_KEY = 'z'.repeat(43)
const BASE = 'https://example.test/api/calendar/'
const NOW = () => new Date('2026-10-07T08:30:00.000Z')

const SNAP: CalendarSnapshot = {
  v: 1,
  todos: [
    { id: 't1', projectId: 'p1', project: 'CHI 论文', title: '改 discussion', due: '2026-10-20', done: false },
    { id: 't2', projectId: 'p1', project: 'CHI 论文', title: '已交', due: '2026-10-21', done: true },
  ],
}

function put(body: string, key = KEY, id = ID) {
  return new Request(BASE + id, {
    method: 'PUT',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body,
  })
}

const get = (id = ID) => new Request(`${BASE}${id}.ics`)

test('PUT then GET returns the calendar', async () => {
  const env = { store: new MemoryStore() }
  const w = await handleCalendarRequest(put(JSON.stringify(SNAP)), env, NOW)
  assert.equal(w.status, 200)
  assert.deepEqual(await w.json(), { url: `https://example.test/api/calendar/${ID}.ics` })

  const r = await handleCalendarRequest(get(), env, NOW)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('content-type'), 'text/calendar; charset=utf-8')
  const ics = (await r.text()).replace(/\r\n /g, '')
  assert.ok(ics.includes('SUMMARY:[CHI 论文] 改 discussion'))
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261020'))
  assert.ok(ics.includes('DTSTAMP:20261007T083000Z'))
  assert.equal(ics.includes('已交'), false)
})

test('only the hash of the key is stored', async () => {
  const store = new MemoryStore()
  await handleCalendarRequest(put(JSON.stringify(SNAP)), { store }, NOW)
  const value = store.data.get(ID)!
  assert.equal(value.slice(0, 64), await sha256Hex(KEY))
  assert.equal(value.includes(KEY), false)
})

test('snapshot fields outside the whitelist are dropped', async () => {
  const store = new MemoryStore()
  const body = { v: 1, todos: [{ ...SNAP.todos[0], notes: 'secret' }] }
  await handleCalendarRequest(put(JSON.stringify(body)), { store }, NOW)
  assert.equal(store.data.get(ID)!.includes('secret'), false)
})

test('PUT with a different key after registration returns 401', async () => {
  const env = { store: new MemoryStore() }
  assert.equal((await handleCalendarRequest(put(JSON.stringify(SNAP)), env, NOW)).status, 200)
  const r = await handleCalendarRequest(put(JSON.stringify({ v: 1, todos: [] }), OTHER_KEY), env, NOW)
  assert.equal(r.status, 401)
  // The original snapshot is untouched.
  const ics = await (await handleCalendarRequest(get(), env, NOW)).text()
  assert.ok(ics.includes('BEGIN:VEVENT'))
})

test('PUT without a bearer key returns 401', async () => {
  const req = new Request(BASE + ID, { method: 'PUT', body: JSON.stringify(SNAP) })
  const r = await handleCalendarRequest(req, { store: new MemoryStore() }, NOW)
  assert.equal(r.status, 401)
})

test('DELETE needs the registered key and removes the data', async () => {
  const env = { store: new MemoryStore() }
  await handleCalendarRequest(put(JSON.stringify(SNAP)), env, NOW)
  const del = (key: string) =>
    new Request(BASE + ID, { method: 'DELETE', headers: { authorization: `Bearer ${key}` } })
  assert.equal((await handleCalendarRequest(del(OTHER_KEY), env, NOW)).status, 401)
  assert.equal((await handleCalendarRequest(del(KEY), env, NOW)).status, 204)
  assert.equal((await handleCalendarRequest(get(), env, NOW)).status, 404)
})

test('body over the limit returns 413', async () => {
  const big = JSON.stringify({ v: 1, todos: [], pad: 'x'.repeat(MAX_BODY_BYTES) })
  const r = await handleCalendarRequest(put(big), { store: new MemoryStore() }, NOW)
  assert.equal(r.status, 413)
})

test('body over the limit without content-length is still rejected', async () => {
  const chunk = new TextEncoder().encode('x'.repeat(64 * 1024))
  let sent = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      if (sent++ < 8) c.enqueue(chunk)
      else c.close()
    },
  })
  const req = new Request(BASE + ID, {
    method: 'PUT',
    headers: { authorization: `Bearer ${KEY}` },
    body: stream,
    duplex: 'half',
  } as RequestInit)
  const r = await handleCalendarRequest(req, { store: new MemoryStore() }, NOW)
  assert.equal(r.status, 413)
})

test('missing environment variables return 503 with the names', async () => {
  const r = await handleCalendarRequest(get(), { missing: ['URL_VAR', 'TOKEN_VAR'] }, NOW)
  assert.equal(r.status, 503)
  const body = (await r.json()) as { error: string; missing: string[] }
  assert.equal(body.error, 'storage-not-configured')
  assert.deepEqual(body.missing, ['URL_VAR', 'TOKEN_VAR'])
})

test('storage failure returns 502 with the error message', async () => {
  const store = new MemoryStore()
  store.read = async () => {
    throw new Error('connection refused')
  }
  const r = await handleCalendarRequest(get(), { store }, NOW)
  assert.equal(r.status, 502)
  const body = (await r.json()) as { error: string; message: string }
  assert.equal(body.error, 'storage-failed')
  assert.equal(body.message, 'connection refused')
})

test('unknown id returns 404, not an empty calendar', async () => {
  const r = await handleCalendarRequest(get(), { store: new MemoryStore() }, NOW)
  assert.equal(r.status, 404)
})

test('short id returns 400 and wrong method returns 405', async () => {
  const env = { store: new MemoryStore() }
  assert.equal((await handleCalendarRequest(get('short'), env, NOW)).status, 400)
  const r = await handleCalendarRequest(new Request(BASE + ID), env, NOW)
  assert.equal(r.status, 405)
})

test('malformed snapshot returns 400', async () => {
  const r = await handleCalendarRequest(
    put(JSON.stringify({ v: 1, todos: [{ id: 1 }] })),
    { store: new MemoryStore() },
    NOW,
  )
  assert.equal(r.status, 400)
})

test('writes and reads both refresh the expiry', async () => {
  const store = new MemoryStore()
  await handleCalendarRequest(put(JSON.stringify(SNAP)), { store }, NOW)
  assert.equal(store.ttl.get(ID), TTL_SECONDS)
  store.ttl.set(ID, 1)
  await handleCalendarRequest(get(), { store }, NOW)
  assert.equal(store.ttl.get(ID), TTL_SECONDS)
})

test('DELETE of an id that was never written returns 204', async () => {
  const req = new Request(BASE + ID, { method: 'DELETE', headers: { authorization: `Bearer ${KEY}` } })
  assert.equal((await handleCalendarRequest(req, { store: new MemoryStore() }, NOW)).status, 204)
})

test('PUT returns the subscription URL on the public host when one is set', async () => {
  const env = { store: new MemoryStore(), publicHost: 'prod.example.test' }
  const w = await handleCalendarRequest(put(JSON.stringify(SNAP)), env, NOW)
  assert.deepEqual(await w.json(), { url: `https://prod.example.test/api/calendar/${ID}.ics` })
})
