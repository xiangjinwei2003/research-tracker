import { Redis } from '@upstash/redis'
import type { CalendarStore } from './calendarApi.js'

/**
 * Upstash Redis implementation of CalendarStore. Key `cal:<id>`, value
 * `<64 hex hash>\n<json>`. put and remove are Lua scripts so the ownership
 * check and the write are one atomic command each; read is one GETEX.
 */

const PUT_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur and string.sub(cur, 1, 64) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[1] .. '\\n' .. ARGV[2], 'EX', ARGV[3])
return 1
`

const REMOVE_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if not cur then return -1 end
if string.sub(cur, 1, 64) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`

const keyOf = (id: string) => `cal:${id}`

export function createRedisStore(url: string, token: string): CalendarStore {
  // Values are opaque strings; without this the client would JSON-parse them.
  const redis = new Redis({ url, token, automaticDeserialization: false })
  return {
    async put(id, hash, value, ttlSec) {
      const r = await redis.eval<string[], number>(PUT_SCRIPT, [keyOf(id)], [hash, value, String(ttlSec)])
      return Number(r) === 1 ? 'ok' : 'forbidden'
    },
    async read(id, ttlSec) {
      const cur = await redis.getex<string>(keyOf(id), { ex: ttlSec })
      if (cur === null || cur === undefined) return null
      return String(cur).slice(65)
    },
    async remove(id, hash) {
      const r = Number(await redis.eval<string[], number>(REMOVE_SCRIPT, [keyOf(id)], [hash]))
      return r === 1 ? 'ok' : r === 0 ? 'forbidden' : 'missing'
    },
  }
}
