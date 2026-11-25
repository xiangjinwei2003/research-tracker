import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { MemFs } from './memFs.ts'
import { setDesktop } from './desktop.ts'
import { CALENDAR_API_BASE, curlRequest, parseCurlOutput } from './calendarDesktop.ts'

// calendarSync 会加载 store（网页版用 localStorage），先补上最小实现。
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}
const { outcomeOf, parseCalendarSettings } = await import('../lib/calendarSync.ts')

const fs = new MemFs()
let next: { code: number; stdout: string; stderr: string } = { code: 0, stdout: '', stderr: '' }
const calls: { command: string; args: string[]; stdin: string; authAtSpawn: string | undefined }[] = []

setDesktop({
  fs,
  os: { homedir: async () => '/Users/me' },
  childProcess: {
    spawn: (command: string, args: string[]) => {
      const authPath = args[args.indexOf('-K') + 1]
      const call = { command, args, stdin: '', authAtSpawn: fs.files.get(authPath) }
      calls.push(call)
      const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: {
          write: async (data: string) => void (call.stdin += data),
          end: async () => {
            setTimeout(() => {
              child.stdout.emit('data', next.stdout)
              if (next.stderr) child.stderr.emit('data', next.stderr)
              child.emit('close', next.code, null)
            }, 0)
          },
        },
      })
      return child
    },
  },
} as unknown as ClaudeDesktop)

test('parseCurlOutput：正文与追加的状态码分开', () => {
  assert.deepEqual(parseCurlOutput('{"url":"https://x"}\n@@status@@200'), { status: 200, text: '{"url":"https://x"}' })
  assert.throws(() => parseCurlOutput('没有状态码'), /没有返回状态码/)
})

test('curlRequest：密钥只在临时配置文件里，正文从标准输入传入，请求结束删除配置文件', async () => {
  next = { code: 0, stdout: '{"url":"https://example.vercel.app/api/calendar/abc.ics"}\n@@status@@200', stderr: '' }
  const res = await curlRequest('PUT', 'abc', 'SECRETKEY', '{"todos":[]}')
  assert.deepEqual(res, { status: 200, text: '{"url":"https://example.vercel.app/api/calendar/abc.ics"}' })
  const call = calls.at(-1)!
  assert.equal(call.command, '/usr/bin/curl')
  assert.ok(!call.args.join(' ').includes('SECRETKEY'))
  assert.equal(call.authAtSpawn, 'header = "Authorization: Bearer SECRETKEY"\n')
  assert.equal(call.args.at(-1), `${CALENDAR_API_BASE}/api/calendar/abc`)
  assert.ok(call.args.includes('--data-binary'))
  assert.equal(call.stdin, '{"todos":[]}')
  assert.equal([...fs.files.keys()].some((k) => k.includes('.calendar-auth')), false)
})

test('curlRequest：curl 失败时报错并带上原因，配置文件同样删除', async () => {
  next = { code: 6, stdout: '', stderr: 'curl: (6) Could not resolve host' }
  await assert.rejects(() => curlRequest('DELETE', 'abc', 'K'), /curl 退出码 6：curl: \(6\) Could not resolve host/)
  assert.equal(calls.at(-1)!.args.includes('--data-binary'), false)
  assert.equal([...fs.files.keys()].some((k) => k.includes('.calendar-auth')), false)
})

test('outcomeOf：成功、缺少地址、删除、未配置存储、带说明的错误、非 JSON 的错误页', () => {
  assert.deepEqual(outcomeOf('PUT', { status: 200, text: '{"url":"https://a/b.ics"}' }), { kind: 'ok', icsUrl: 'https://a/b.ics' })
  assert.deepEqual(outcomeOf('PUT', { status: 200, text: '{}' }), { kind: 'error', message: '服务端响应缺少订阅地址' })
  assert.deepEqual(outcomeOf('DELETE', { status: 204, text: '' }), { kind: 'ok' })
  assert.deepEqual(outcomeOf('PUT', { status: 503, text: '{"error":"storage-not-configured","message":"缺少 KV_REST_API_URL"}' }), {
    kind: 'unconfigured',
    message: '缺少 KV_REST_API_URL',
  })
  assert.deepEqual(outcomeOf('PUT', { status: 401, text: '{"error":"forbidden","message":"写入密钥不对"}' }), {
    kind: 'error',
    message: 'HTTP 401：写入密钥不对',
  })
  assert.deepEqual(outcomeOf('PUT', { status: 404, text: '<html>Not Found</html>' }), { kind: 'error', message: 'HTTP 404' })
})

test('parseCalendarSettings：缺少 id 或 key、不是 JSON 时当作没有设置', () => {
  assert.equal(parseCalendarSettings(null), null)
  assert.equal(parseCalendarSettings('{坏的'), null)
  assert.equal(parseCalendarSettings('{"id":"a"}'), null)
  assert.deepEqual(parseCalendarSettings('{"id":"a","key":"b","enabled":true,"lastSyncAt":"x"}'), {
    enabled: true,
    id: 'a',
    key: 'b',
    lastSyncAt: null,
    uploadedHash: null,
    icsUrl: null,
  })
})
