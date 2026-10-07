import { handleCalendarRequest, type CalendarEnv } from '../../src/server/calendarApi.js'
import { createRedisStore } from '../../src/server/redisStore.js'

/**
 * Vercel Function (Node runtime) for /api/calendar/:id and /api/calendar/:id.ics.
 * The Upstash integration from the Vercel Marketplace sets these two variables.
 */
const URL_VAR = 'KV_REST_API_URL'
const TOKEN_VAR = 'KV_REST_API_TOKEN'

function env(): CalendarEnv {
  const url = process.env[URL_VAR]
  const token = process.env[TOKEN_VAR]
  const missing = [!url && URL_VAR, !token && TOKEN_VAR].filter((x): x is string => !!x)
  if (missing.length) return { missing }
  return { store: createRedisStore(url!, token!) }
}

const handle = (req: Request) => handleCalendarRequest(req, env())

export const GET = handle
export const PUT = handle
export const DELETE = handle
