import { parseSnapshot, type CalendarSnapshot } from '../lib/calendarSnapshot.js'
import { buildIcs } from '../lib/ics.js'

/**
 * Request handling for the Apple Calendar subscription, independent of Vercel
 * and of Redis so tests can drive it with `new Request(...)` and an in-memory
 * store. api/calendar/[id].ts wires it to Upstash.
 *
 *   PUT    /api/calendar/:id       Authorization: Bearer <key>, JSON snapshot
 *                                  → 200 { url } (https URL of the .ics)
 *   DELETE /api/calendar/:id       Authorization: Bearer <key>
 *   GET    /api/calendar/:id.ics   text/calendar
 *
 * Only the SHA-256 of the write key is stored. The first PUT registers it;
 * afterwards a different key gets 401.
 *
 * Runtime imports use `.js` specifiers because the Vercel function runs this
 * file as Node ESM.
 */

/**
 * One key per id. The stored value is the 64 character SHA-256 hex of the write
 * key, a newline, then the JSON of {@link Stored}. Ownership checks and writes
 * happen inside the store in one round trip (a Lua script on Redis), so each
 * request costs one command.
 */
export interface CalendarStore {
  /**
   * Write `value` unless a different hash owns the id. Refreshes the expiry.
   * 'forbidden' = another key registered first.
   */
  put(id: string, hash: string, value: string, ttlSec: number): Promise<'ok' | 'forbidden'>
  /** Read the JSON part and slide the expiry forward. Null when absent. */
  read(id: string, ttlSec: number): Promise<string | null>
  /** Delete when `hash` owns the id. */
  remove(id: string, hash: string): Promise<'ok' | 'forbidden' | 'missing'>
}

export type CalendarEnv =
  | {
      store: CalendarStore
      /**
       * Host the subscription URL should use. On Vercel this is the production
       * domain: other deployment URLs can sit behind Vercel Authentication,
       * which Apple Calendar cannot pass. Absent = the host of the request.
       */
      publicHost?: string
    }
  | { missing: string[] }

export const MAX_BODY_BYTES = 256 * 1024

/**
 * Data expires 180 days after the last read or write. Apple Calendar polling
 * keeps a live subscription alive; an address nobody polls or writes to any
 * more is dropped without manual cleanup.
 */
export const TTL_SECONDS = 180 * 24 * 60 * 60

/** 128 bits or more of base64url. The client generates 43 characters (256 bits). */
const ID_RE = /^[A-Za-z0-9_-]{22,128}$/
const KEY_RE = /^[A-Za-z0-9_-]{22,128}$/

interface Stored {
  updatedAt: string
  snapshot: CalendarSnapshot
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function bearer(req: Request): string | null {
  const m = /^Bearer (\S+)$/.exec(req.headers.get('authorization') ?? '')
  return m && KEY_RE.test(m[1]) ? m[1] : null
}

/** Reads the body, stopping as soon as it exceeds `limit` bytes. Null = too large. */
async function readLimited(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    all.set(c, off)
    off += c.byteLength
  }
  return new TextDecoder().decode(all)
}

/** Last path segment after /api/calendar/. */
function segment(req: Request): string {
  const path = new URL(req.url).pathname
  const prefix = '/api/calendar/'
  return path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length)) : ''
}

class StorageError extends Error {}

async function storage<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (err) {
    throw new StorageError(errorMessage(err))
  }
}

export async function handleCalendarRequest(
  req: Request,
  env: CalendarEnv,
  now: () => Date = () => new Date(),
): Promise<Response> {
  const seg = segment(req)
  const isIcs = seg.endsWith('.ics')
  const id = isIcs ? seg.slice(0, -4) : seg
  if (!ID_RE.test(id)) return json(400, { error: 'invalid-id' })

  const method = req.method.toUpperCase()
  if (isIcs ? method !== 'GET' : method !== 'PUT' && method !== 'DELETE') {
    return json(405, { error: 'method-not-allowed' })
  }

  if ('missing' in env) {
    return json(503, {
      error: 'storage-not-configured',
      message: `Missing environment variables: ${env.missing.join(', ')}`,
      missing: env.missing,
    })
  }
  const { store } = env
  const publicHost = env.publicHost || new URL(req.url).host

  try {
    if (method === 'GET') {
      const raw = await storage(() => store.read(id, TTL_SECONDS))
      if (raw === null) return json(404, { error: 'not-found' })
      const stored = JSON.parse(raw) as Stored
      return new Response(buildIcs(stored.snapshot, new Date(stored.updatedAt)), {
        status: 200,
        headers: {
          'content-type': 'text/calendar; charset=utf-8',
          'cache-control': 'no-cache, max-age=0',
        },
      })
    }

    const key = bearer(req)
    if (!key) return json(401, { error: 'unauthorized' })
    const hash = await sha256Hex(key)

    if (method === 'DELETE') {
      const r = await storage(() => store.remove(id, hash))
      if (r === 'forbidden') return json(401, { error: 'unauthorized' })
      // 'missing': nothing was stored under this id, so it is already deleted.
      return new Response(null, { status: 204 })
    }

    // PUT
    const text = await readLimited(req, MAX_BODY_BYTES)
    if (text === null) return json(413, { error: 'payload-too-large', limitBytes: MAX_BODY_BYTES })
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return json(400, { error: 'invalid-json' })
    }
    const parsed = parseSnapshot(body)
    if (!parsed.ok) return json(400, { error: 'invalid-snapshot', message: parsed.reason })

    const stored: Stored = { updatedAt: now().toISOString(), snapshot: parsed.snapshot }
    const r = await storage(() => store.put(id, hash, JSON.stringify(stored), TTL_SECONDS))
    if (r === 'forbidden') return json(401, { error: 'unauthorized' })
    return json(200, { url: `https://${publicHost}/api/calendar/${id}.ics` })
  } catch (err) {
    if (err instanceof StorageError) {
      return json(502, { error: 'storage-failed', message: err.message })
    }
    return json(500, { error: 'internal-error', message: errorMessage(err) })
  }
}
