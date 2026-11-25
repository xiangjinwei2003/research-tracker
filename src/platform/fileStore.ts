import { format } from 'date-fns'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { asEnvelope, markPersistHealth, type Persisted } from '../lib/persist'

/**
 * 桌面版的数据文件。安装为应用的 Artifact 通过 desktop.fs 读写本机文件，
 * 路径可以 `~/` 开头。数据放在用户的文稿目录，Claude Code 会话可以直接读取。
 *
 * 写入规则（防止空数据覆盖文件）：
 * 1. open() 读到文件、store 水合完成、markReady() 之后才写；之前的写入请求直接丢弃。
 *    zustand persist 每次 set 都会调 setItem，水合前也会，所以门控必须在这一层。
 * 2. 文件不存在时不自动建空文件，由首次运行页让用户选择导入或从空白开始（create）。
 * 3. 先写临时文件再 rename；同一时间只有一个写入，期间的改动合并成下一次写入。
 * 4. 每天第一次写入前把旧文件复制到 backups/，保留最近 BACKUP_KEEP 份。
 * 5. 文件读不出或格式不对时不写，交给启动页显示原因。
 */

export const DATA_DIR = '~/Documents/Research Tracker'
export const DATA_FILE = `${DATA_DIR}/research-tracker.json`
export const TMP_FILE = `${DATA_FILE}.tmp`
export const BACKUP_DIR = `${DATA_DIR}/backups`
export const BACKUP_KEEP = 30
const BACKUP_RE = /^research-tracker-\d{4}-\d{2}-\d{2}\.json$/

/** desktop.fs 中本模块用到的部分。测试里用内存实现替代。 */
export interface DataFs {
  readFile(path: string, encoding: 'utf8'): Promise<string>
  writeFile(path: string, data: string, encoding?: 'utf8'): Promise<void>
  readdir(path: string): Promise<{ name: string; isFile: boolean }[]>
  exists(path: string): Promise<boolean>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  rename(from: string, to: string): Promise<void>
  copyFile(from: string, to: string): Promise<void>
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>
}

export type OpenResult =
  | { kind: 'ok'; value: StorageValue<Persisted> }
  | { kind: 'missing' }
  | { kind: 'unreadable'; reason: string }

function reasonOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export class FileBackend {
  private ready = false
  private opened: StorageValue<Persisted> | null = null
  private pending: StorageValue<Persisted> | null = null
  private running: Promise<void> | null = null
  private backedUpDay: string | null = null
  private readonly fs: DataFs
  private readonly now: () => Date
  private readonly onBackupError: (err: unknown) => void

  constructor(
    fs: DataFs,
    now: () => Date = () => new Date(),
    onBackupError: (err: unknown) => void = (err) => console.warn('[research-tracker] 今天的备份没有写成。', err),
  ) {
    this.fs = fs
    this.now = now
    this.onBackupError = onBackupError
  }

  /** 读取并校验数据文件。成功后内容留给 takeOpened()，写入仍然关闭。 */
  async open(): Promise<OpenResult> {
    this.ready = false
    this.opened = null
    let text: string
    try {
      if (!(await this.fs.exists(DATA_FILE))) return { kind: 'missing' }
      text = await this.fs.readFile(DATA_FILE, 'utf8')
    } catch (err) {
      markPersistHealth('unreadable')
      return { kind: 'unreadable', reason: `读取失败：${reasonOf(err)}` }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      markPersistHealth('unreadable')
      return { kind: 'unreadable', reason: '文件内容不是有效的 JSON' }
    }
    const value = asEnvelope(parsed)
    if (!value) {
      markPersistHealth('unreadable')
      return { kind: 'unreadable', reason: '文件里没有 projects 数组' }
    }
    this.opened = value
    markPersistHealth('ok')
    return { kind: 'ok', value }
  }

  /** 首次使用时写入初始数据。文件已存在时报错，不覆盖。 */
  async create(value: StorageValue<Persisted>): Promise<void> {
    if (await this.fs.exists(DATA_FILE)) {
      throw new Error('数据文件已存在，没有覆盖')
    }
    await this.fs.mkdir(DATA_DIR, { recursive: true })
    await this.writeAtomically(value)
  }

  /** zustand persist 的 getItem 取用 open() 读到的内容，只能取一次。 */
  takeOpened(): StorageValue<Persisted> | null {
    const value = this.opened
    this.opened = null
    return value
  }

  /** store 水合完成后调用，之后的写入才会落盘。 */
  markReady(): void {
    this.ready = true
  }

  get isReady(): boolean {
    return this.ready
  }

  /** 有改动就写。未就绪时丢弃；正在写时只保留最新的一份，等这次写完再写。 */
  write(value: StorageValue<Persisted>): void {
    if (!this.ready) return
    this.pending = value
    if (!this.running) this.running = this.drain()
  }

  /** 上次写入失败后重试（窗口重新获得焦点、窗口隐藏时调用）。 */
  retry(): void {
    if (this.ready && this.pending && !this.running) this.running = this.drain()
  }

  /** 等正在进行和排队的写入全部结束。 */
  async flush(): Promise<void> {
    while (this.running) await this.running
  }

  private async drain(): Promise<void> {
    try {
      while (this.pending) {
        const value = this.pending
        this.pending = null
        // 备份失败单独报告，不挡住这次写入；当天不再重试备份。
        try {
          await this.backupOncePerDay()
        } catch (err) {
          this.backedUpDay = format(this.now(), 'yyyy-MM-dd')
          this.onBackupError(err)
        }
        try {
          await this.writeAtomically(value)
          markPersistHealth('ok')
        } catch (err) {
          // 写入失败时保留这份快照，下一次改动或 retry() 再写；比它新的快照优先。
          if (!this.pending) this.pending = value
          markPersistHealth('write-failed')
          console.warn('[research-tracker] 数据文件写入失败，改动暂未保存。', err)
          return
        }
      }
    } finally {
      this.running = null
    }
  }

  private async writeAtomically(value: StorageValue<Persisted>): Promise<void> {
    await this.fs.writeFile(TMP_FILE, JSON.stringify(value), 'utf8')
    await this.fs.rename(TMP_FILE, DATA_FILE)
  }

  private async backupOncePerDay(): Promise<void> {
    const day = format(this.now(), 'yyyy-MM-dd')
    if (this.backedUpDay === day) return
    if (await this.fs.exists(DATA_FILE)) {
      await this.fs.mkdir(BACKUP_DIR, { recursive: true })
      const target = `${BACKUP_DIR}/research-tracker-${day}.json`
      if (!(await this.fs.exists(target))) await this.fs.copyFile(DATA_FILE, target)
      await this.pruneBackups()
    }
    this.backedUpDay = day
  }

  /** 只删本模块按命名规则生成的备份，按日期保留最新的 BACKUP_KEEP 份。 */
  private async pruneBackups(): Promise<void> {
    const names = (await this.fs.readdir(BACKUP_DIR))
      .filter((e) => e.isFile && BACKUP_RE.test(e.name))
      .map((e) => e.name)
      .sort()
    for (const name of names.slice(0, Math.max(0, names.length - BACKUP_KEEP))) {
      await this.fs.rm(`${BACKUP_DIR}/${name}`, { force: true })
    }
  }
}

let attached: FileBackend | null = null

export function attachFileBackend(backend: FileBackend): void {
  attached = backend
}

export function fileBackend(): FileBackend | null {
  return attached
}

/**
 * 桌面版 store 的 persist 存储。getItem 只在启动流程 open() 成功后由 rehydrate 调用；
 * 拿不到已打开的内容说明调用顺序错了，直接报错。
 */
export const fileStorage: PersistStorage<Persisted> = {
  getItem: () => {
    const value = attached?.takeOpened()
    if (!value) throw new Error('[research-tracker] 数据文件尚未打开，不能水合')
    return value
  },
  setItem: (_name, value) => {
    attached?.write(value)
  },
  removeItem: () => {
    throw new Error('[research-tracker] 桌面版不删除数据文件')
  },
}
