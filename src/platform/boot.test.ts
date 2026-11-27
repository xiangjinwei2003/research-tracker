/**
 * 桌面版启动流程与 store 的配合。store 在模块加载时按运行环境选择存储，
 * 所以先注入 window.claude，再动态导入 store（node:test 每个测试文件单独一个进程）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemFs } from './memFs.ts'

;(globalThis as unknown as { claude: { use: () => Promise<null> } }).claude = {
  use: async () => null,
}

const { useStore, SCHEMA_VERSION, importJSON } = await import('../lib/store.ts')
const { openData, createData, findBackups, requestFileAccess } = await import('./boot.ts')
const { DATA_FILE, fileBackend } = await import('./fileStore.ts')
const { IN_ARTIFACT } = await import('./runtime.ts')

const fakeDesktop = (fs: MemFs) => ({ fs }) as unknown as ClaudeDesktop

const exported = (title: string, version = 7) =>
  JSON.stringify({
    projects: [{ id: 'p1', title, stage: 'design', todos: [{ id: 't1', title: '整理访谈', endDate: '' }] }],
    sessions: [],
    version,
  })

const saved = (fs: MemFs) =>
  JSON.parse(fs.files.get(DATA_FILE)!) as {
    version: number
    state: { projects: { title: string; todos: { title: string }[] }[] }
  }

test('注入 window.claude 后判定为 Artifact，store 跳过模块加载时的水合', () => {
  assert.equal(IN_ARTIFACT, true)
  assert.equal(useStore.persist.hasHydrated(), false)
})

test('数据文件不存在：进入首次运行页，水合前后的改动都不会建文件', async () => {
  const fs = new MemFs()
  useStore.setState({ projects: [] })
  const phase = await openData(fakeDesktop(fs))
  assert.equal(phase.kind, 'first-run')
  useStore.setState({ projects: [] })
  await fileBackend()!.flush()
  assert.equal(fs.files.has(DATA_FILE), false)
})

test('从备份导入：建文件后水合，水合前的内存状态被文件内容替换，之后的改动写回文件', async () => {
  const fs = new MemFs()
  // 模拟水合前误触发的状态：不能进入文件。
  useStore.setState({ sessions: [{ id: 's0', plannedMin: 30, startedAt: 1, endedAt: 2, completed: true }] })
  const phase = await createData(fakeDesktop(fs), importJSON(exported('proj-a')))
  assert.equal(phase.kind, 'ready')
  assert.deepEqual(
    useStore.getState().projects.map((p) => p.title),
    ['proj-a'],
  )
  assert.deepEqual(useStore.getState().sessions, [])

  useStore.getState().addTodo('p1', { title: '写方法部分', priority: 'high' })
  await fileBackend()!.flush()
  const file = saved(fs)
  assert.equal(file.version, SCHEMA_VERSION)
  assert.deepEqual(
    file.state.projects[0].todos.map((t) => t.title),
    ['整理访谈', '写方法部分'],
  )
})

test('旧版本的数据文件：水合时迁移，并按当前版本补写一次', async () => {
  const fs = new MemFs()
  const old = JSON.parse(exported('旧版本的项目', 5))
  fs.files.set(DATA_FILE, JSON.stringify({ state: { ...old, activeTimer: null }, version: 5 }))
  const phase = await openData(fakeDesktop(fs))
  assert.equal(phase.kind, 'ready')
  await fileBackend()!.flush()
  assert.equal(saved(fs).version, SCHEMA_VERSION)
  assert.equal(saved(fs).state.projects[0].title, '旧版本的项目')
})

test('水合时出错：停在 failed，文件保持原样', async () => {
  const fs = new MemFs()
  const original = JSON.stringify({ state: { ...JSON.parse(exported('另一个项目', 3)), activeTimer: null }, version: 3 })
  fs.files.set(DATA_FILE, original)
  const migrate = useStore.persist.getOptions().migrate
  useStore.persist.setOptions({
    migrate: () => {
      throw new Error('迁移失败')
    },
  })
  try {
    const phase = await openData(fakeDesktop(fs))
    assert.equal(phase.kind, 'failed')
    useStore.setState({ projects: [] })
    await fileBackend()!.flush()
    assert.equal(fs.files.get(DATA_FILE), original)
  } finally {
    useStore.persist.setOptions({ migrate })
  }
})

test('数据文件读不出：停在 unreadable，文件保持原样', async () => {
  const fs = new MemFs()
  fs.files.set(DATA_FILE, '{broken')
  const phase = await openData(fakeDesktop(fs))
  assert.equal(phase.kind, 'unreadable')
  assert.equal(fs.files.get(DATA_FILE), '{broken')
})

test('首次运行页列出下载文件夹里网页版导出的备份，按修改时间从新到旧，最多 3 个', async () => {
  const fs = new MemFs()
  const add = (name: string, mtime: number) => {
    fs.files.set(`~/Downloads/${name}`, '{}')
    fs.mtimes.set(`~/Downloads/${name}`, mtime)
  }
  add('research-tracker-2026-11-20.json', 10)
  add('research-tracker-2026-11-25.json', 30)
  add('research-tracker-2026-11-25 (1).json', 40)
  add('research-tracker-2026-11-01.json', 5)
  add('research-tracker-unreadable-2026-11-25.json', 50)
  add('其他文件.json', 60)
  assert.deepEqual(
    (await findBackups(fs as unknown as ClaudeDesktop.Fs)).map((b) => b.name),
    ['research-tracker-2026-11-25 (1).json', 'research-tracker-2026-11-25.json', 'research-tracker-2026-11-20.json'],
  )
})

const deniedFs = (message: string) => ({
  stat: async () => {
    throw new Error(message)
  },
})

test('权限读到 unavailable：用一次只读调用取得平台给出的原因', async () => {
  const msg = 'ENOSYS: Your organization doesn\u2019t allow full access for apps.'
  const desktop = {
    fs: deniedFs(msg),
    permissions: { request: async () => ({ 'full-access': 'unavailable' }) },
  } as unknown as ClaudeDesktop
  const phase = await requestFileAccess(desktop)
  assert.equal(phase.kind, 'permission')
  assert.equal(phase.kind === 'permission' && phase.reason, msg)
})

test('请求权限本身失败：失败原因显示在权限页', async () => {
  const desktop = {
    fs: deniedFs('不应调用'),
    permissions: {
      request: async () => {
        throw new Error('ENOTSUP: window hidden')
      },
    },
  } as unknown as ClaudeDesktop
  const phase = await requestFileAccess(desktop)
  assert.equal(phase.kind === 'permission' && phase.reason, 'ENOTSUP: window hidden')
})

test('权限被拒绝（denied）：不做探测调用，没有附加原因', async () => {
  const desktop = {
    fs: deniedFs('不应调用'),
    permissions: { request: async () => ({ 'full-access': 'denied' }) },
  } as unknown as ClaudeDesktop
  const phase = await requestFileAccess(desktop)
  assert.equal(phase.kind === 'permission' && phase.state, 'denied')
  assert.equal(phase.kind === 'permission' && phase.reason, undefined)
})
