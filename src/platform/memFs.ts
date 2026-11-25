import type { DataFs } from './fileStore'

/**
 * 测试用的内存文件系统，行为对齐 desktop.fs 中用到的部分：路径原样作键，
 * 不存在时报 ENOENT。log 记录写入顺序，用于检查先写临时文件再 rename。
 */
export class MemFs implements DataFs {
  files = new Map<string, string>()
  dirs = new Set<string>()
  mtimes = new Map<string, number>()
  log: string[] = []
  /** 接下来这么多次 writeFile 会失败。 */
  failWrites = 0
  /** 设置后，writeFile 等这个 Promise 完成才返回，用来制造“写入进行中”。 */
  gate: Promise<void> | null = null

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path)
  }

  async readFile(path: string): Promise<string> {
    const text = this.files.get(path)
    if (text === undefined) throw new Error(`ENOENT: ${path}`)
    return text
  }

  async writeFile(path: string, data: string): Promise<void> {
    if (this.gate) await this.gate
    if (this.failWrites > 0) {
      this.failWrites--
      throw new Error(`EIO: ${path}`)
    }
    this.files.set(path, data)
    this.log.push(`write ${path}`)
  }

  async readdir(path: string): Promise<{ name: string; isFile: boolean; isDirectory: boolean; isSymbolicLink: boolean }[]> {
    const prefix = `${path}/`
    const names = [...this.files.keys()]
      .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map((k) => k.slice(prefix.length))
    if (!names.length && !this.dirs.has(path)) throw new Error(`ENOENT: ${path}`)
    return names.map((name) => ({ name, isFile: true, isDirectory: false, isSymbolicLink: false }))
  }

  async stat(path: string): Promise<{ mtimeMs: number }> {
    if (!this.files.has(path)) throw new Error(`ENOENT: ${path}`)
    return { mtimeMs: this.mtimes.get(path) ?? 0 }
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path)
  }

  async rename(from: string, to: string): Promise<void> {
    const text = this.files.get(from)
    if (text === undefined) throw new Error(`ENOENT: ${from}`)
    this.files.delete(from)
    this.files.set(to, text)
    this.log.push(`rename ${from} -> ${to}`)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const text = this.files.get(from)
    if (text === undefined) throw new Error(`ENOENT: ${from}`)
    this.files.set(to, text)
    this.log.push(`copy ${from} -> ${to}`)
  }

  async rm(path: string): Promise<void> {
    this.files.delete(path)
    this.log.push(`rm ${path}`)
  }
}
