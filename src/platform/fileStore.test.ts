import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKUP_DIR,
  BACKUP_KEEP,
  DATA_DIR,
  DATA_FILE,
  FileBackend,
  TMP_FILE,
} from './fileStore.ts'
import { MemFs } from './memFs.ts'
import { getPersistHealth, unlockPersistWrites } from '../lib/persist.ts'

const envelope = (title: string, version = 7) => ({
  state: {
    projects: [{ id: 'p1', title }],
    sessions: [],
    activeTimer: null,
    version,
  },
  version,
})

// FileBackend 的写入接收 zustand 的 StorageValue；测试里的项目只放了必要字段。
type Value = Parameters<FileBackend['write']>[0]
const value = (title: string) => envelope(title) as unknown as Value

const readTitle = (fs: MemFs, path = DATA_FILE) =>
  (JSON.parse(fs.files.get(path)!) as ReturnType<typeof envelope>).state.projects[0].title

test('文件不存在：open 返回 missing，之后的写入一律丢弃，不建文件', async () => {
  const fs = new MemFs()
  const backend = new FileBackend(fs)
  assert.deepEqual(await backend.open(), { kind: 'missing' })
  backend.write(value('不该写入'))
  backend.markReady()
  await backend.flush()
  // markReady 之前的写入已经丢弃，之后没有新的写入。
  assert.equal(fs.files.size, 0)
})

test('create：先写临时文件再改名；文件已存在时报错且不覆盖', async () => {
  const fs = new MemFs()
  const backend = new FileBackend(fs)
  await backend.create(value('导入的数据'))
  assert.ok(fs.dirs.has(DATA_DIR))
  assert.deepEqual(fs.log, [`write ${TMP_FILE}`, `rename ${TMP_FILE} -> ${DATA_FILE}`])
  assert.equal(readTitle(fs), '导入的数据')
  await assert.rejects(() => backend.create(value('第二次')), /已存在/)
  assert.equal(readTitle(fs), '导入的数据')
})

test('open 成功后，markReady 之前的写入丢弃，之后的写入落盘；takeOpened 只能取一次', async () => {
  const fs = new MemFs()
  fs.files.set(DATA_FILE, JSON.stringify(envelope('原有数据')))
  const backend = new FileBackend(fs)
  const opened = await backend.open()
  assert.equal(opened.kind, 'ok')
  assert.equal(backend.takeOpened()?.state.projects.length, 1)
  assert.equal(backend.takeOpened(), null)

  backend.write(value('水合前的空状态'))
  await backend.flush()
  assert.equal(readTitle(fs), '原有数据')

  backend.markReady()
  backend.write(value('改过的数据'))
  await backend.flush()
  assert.equal(readTitle(fs), '改过的数据')
})

test('写入进行中再来多次改动，只按最新的一份补写一次', async () => {
  const fs = new MemFs()
  fs.files.set(DATA_FILE, JSON.stringify(envelope('v0')))
  const backend = new FileBackend(fs, () => new Date('2026-11-25T09:00:00'))
  await backend.open()
  backend.markReady()

  // 第一次写入卡在 writeFile 里时，再来两次改动。
  let release!: () => void
  fs.gate = new Promise<void>((r) => (release = r))
  backend.write(value('v1'))
  backend.write(value('v2'))
  backend.write(value('v3'))
  release()
  await backend.flush()
  fs.gate = null

  const writes = fs.log.filter((l) => l === `write ${TMP_FILE}`)
  assert.equal(writes.length, 2)
  assert.equal(readTitle(fs), 'v3')
})

test('文件不是 JSON 或没有 projects：返回 unreadable，不写入', async () => {
  for (const [text, reason] of [
    ['{not json', /不是有效的 JSON/],
    [JSON.stringify({ hello: 1 }), /没有 projects/],
  ] as const) {
    unlockPersistWrites()
    const fs = new MemFs()
    fs.files.set(DATA_FILE, text)
    const backend = new FileBackend(fs)
    const result = await backend.open()
    assert.equal(result.kind, 'unreadable')
    assert.match((result as { reason: string }).reason, reason)
    assert.equal(getPersistHealth(), 'unreadable')
    backend.write(value('覆盖'))
    await backend.flush()
    assert.equal(fs.files.get(DATA_FILE), text)
  }
  unlockPersistWrites()
})

test('每天第一次写入前备份旧文件，只保留最新的 30 份', async () => {
  const fs = new MemFs()
  fs.files.set(DATA_FILE, JSON.stringify(envelope('昨天的数据')))
  // 已有 31 份旧备份，外加一个不符合命名规则的文件（不应被删除）。
  for (let i = 1; i <= 31; i++) {
    const day = `2026-10-${String(i).padStart(2, '0')}`
    fs.files.set(`${BACKUP_DIR}/research-tracker-${day}.json`, '{}')
  }
  fs.files.set(`${BACKUP_DIR}/手动保存.json`, '{}')
  fs.dirs.add(BACKUP_DIR)

  let now = new Date('2026-11-25T09:00:00')
  const backend = new FileBackend(fs, () => now)
  await backend.open()
  backend.markReady()

  backend.write(value('今天第一次'))
  await backend.flush()
  assert.equal(readTitle(fs, `${BACKUP_DIR}/research-tracker-2026-11-25.json`), '昨天的数据')
  const backups = [...fs.files.keys()].filter((k) => /research-tracker-\d{4}-\d{2}-\d{2}\.json$/.test(k))
  assert.equal(backups.length, BACKUP_KEEP)
  assert.ok(!fs.files.has(`${BACKUP_DIR}/research-tracker-2026-10-01.json`))
  assert.ok(!fs.files.has(`${BACKUP_DIR}/research-tracker-2026-10-02.json`))
  assert.ok(fs.files.has(`${BACKUP_DIR}/手动保存.json`))

  // 同一天再写，不再复制。
  const copies = () => fs.log.filter((l) => l.startsWith('copy ')).length
  backend.write(value('今天第二次'))
  await backend.flush()
  assert.equal(copies(), 1)
  assert.equal(readTitle(fs, `${BACKUP_DIR}/research-tracker-2026-11-25.json`), '昨天的数据')

  // 第二天第一次写入，备份的是前一天最后的内容。
  now = new Date('2026-11-26T08:00:00')
  backend.write(value('明天'))
  await backend.flush()
  assert.equal(readTitle(fs, `${BACKUP_DIR}/research-tracker-2026-11-26.json`), '今天第二次')
})

test('写入失败：状态变为 write-failed，保留改动，retry 后写入并恢复', async () => {
  unlockPersistWrites()
  const fs = new MemFs()
  fs.files.set(DATA_FILE, JSON.stringify(envelope('原有')))
  const backend = new FileBackend(fs, () => new Date('2026-11-25T09:00:00'))
  await backend.open()
  backend.markReady()

  fs.failWrites = 1
  backend.write(value('新内容'))
  await backend.flush()
  assert.equal(getPersistHealth(), 'write-failed')
  assert.equal(readTitle(fs), '原有')

  backend.retry()
  await backend.flush()
  assert.equal(getPersistHealth(), 'ok')
  assert.equal(readTitle(fs), '新内容')
})
