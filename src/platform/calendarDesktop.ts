import { DATA_DIR } from './fileStore'
import { getDesktop } from './desktop'
import { expandHome } from './folders'

/**
 * 苹果日历订阅在桌面版的传输与存储。页面不能访问网络，所以请求用 full-access 的子进程运行 curl，
 * 发到部署的生产域名（另一个域名开了 Vercel 访问保护，接口会被重定向到登录页）。
 * 订阅设置存在数据目录的 calendar-sync.json，不进项目数据，也不随导出走。
 */
export const CALENDAR_API_BASE = 'https://research-tracker-gamma.vercel.app'
export const CALENDAR_SYNC_FILE = `${DATA_DIR}/calendar-sync.json`
/** 写入密钥放在这个临时配置文件里交给 curl，不出现在命令行参数中；请求结束即删除。 */
const AUTH_FILE = `${DATA_DIR}/.calendar-auth.curlrc`
const STATUS_MARK = '\n@@status@@'

export interface HttpResult {
  status: number
  text: string
}

/** curl 用 `-w` 在正文后面追加状态码，这里拆开。 */
export function parseCurlOutput(stdout: string): HttpResult {
  const at = stdout.lastIndexOf(STATUS_MARK)
  if (at === -1) throw new Error('curl 没有返回状态码')
  const status = Number(stdout.slice(at + STATUS_MARK.length).trim())
  if (!Number.isInteger(status)) throw new Error('curl 返回的状态码无法识别')
  return { status, text: stdout.slice(0, at) }
}

function requireDesktop(): ClaudeDesktop {
  const desktop = getDesktop()
  if (!desktop) throw new Error('只有桌面版通过 curl 同步日历')
  return desktop
}

export async function readCalendarFile(): Promise<string | null> {
  const desktop = requireDesktop()
  if (!(await desktop.fs.exists(CALENDAR_SYNC_FILE))) return null
  return desktop.fs.readFile(CALENDAR_SYNC_FILE, 'utf8')
}

export async function writeCalendarFile(text: string): Promise<void> {
  const desktop = requireDesktop()
  await desktop.fs.mkdir(DATA_DIR, { recursive: true })
  await desktop.fs.writeFile(`${CALENDAR_SYNC_FILE}.tmp`, text, 'utf8')
  await desktop.fs.rename(`${CALENDAR_SYNC_FILE}.tmp`, CALENDAR_SYNC_FILE)
}

/** 发一次请求。curl 自身失败（网络不通、域名解析失败）时报错，HTTP 错误码照常返回给调用方判断。 */
export async function curlRequest(method: 'PUT' | 'DELETE', id: string, key: string, body?: string): Promise<HttpResult> {
  const desktop = requireDesktop()
  const authFile = await expandHome(AUTH_FILE)
  await desktop.fs.mkdir(DATA_DIR, { recursive: true })
  await desktop.fs.writeFile(authFile, `header = "Authorization: Bearer ${key}"\n`, 'utf8')
  try {
    const args = ['-sS', '-X', method, '-K', authFile, '-w', `${STATUS_MARK}%{http_code}`, '--max-time', '30']
    if (body !== undefined) args.push('-H', 'Content-Type: application/json', '--data-binary', '@-')
    args.push(`${CALENDAR_API_BASE}/api/calendar/${id}`)
    const { code, stdout, stderr } = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = desktop.childProcess.spawn('/usr/bin/curl', args)
        let out = ''
        let err = ''
        child.stdout.on('data', (chunk) => (out += chunk))
        child.stderr.on('data', (chunk) => (err += chunk))
        child.on('error', reject)
        child.on('close', (exit) => resolve({ code: exit, stdout: out, stderr: err }))
        if (body !== undefined) void child.stdin.write(body).then(() => child.stdin.end())
        else void child.stdin.end()
      },
    )
    if (code !== 0) throw new Error(`curl 退出码 ${code}${stderr.trim() ? `：${stderr.trim().slice(0, 200)}` : ''}`)
    return parseCurlOutput(stdout)
  } finally {
    await desktop.fs.rm(authFile, { force: true }).catch(() => undefined)
  }
}
