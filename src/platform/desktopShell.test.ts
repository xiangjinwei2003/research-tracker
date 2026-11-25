/**
 * 桌面集成：设置、窗口模式、全局快捷键、启动时恢复。desktop 能力用内存假实现。
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MemFs } from './memFs.ts'
import { setDesktop } from './desktop.ts'
import { SETTINGS_FILE, currentSettings, parseSettings, readSettings, setCurrentSettings, updateSettings } from './settings.ts'
import { PLACEMENT, applyWindowOptions, switchWindowMode, windowOptions } from './windowMode.ts'
import { QUICK_NOTE_ACCELERATOR, QUICK_NOTE_EVENT, enableQuickNoteShortcut } from './quickNote.ts'

// Node 里没有 window 与 sessionStorage，按页面里的用法补上最小实现。
const session = new Map<string, string>()
;(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => void session.set(k, v),
}
;(globalThis as unknown as { window: EventTarget }).window = new EventTarget()

const fs = new MemFs()
const log: string[] = []
let applied: ClaudeDesktop.WindowOptions = {}
let reloadOnSet = false
let overlayAnswer: ClaudeDesktop.PermissionState = 'granted'
const shortcuts = new Map<string, () => void>()

const desktop = {
  fs,
  os: { homedir: async () => '/Users/me' },
  permissions: {
    request: async (names: string[]) => {
      log.push(`request ${names.join(',')}`)
      return { overlay: overlayAnswer, shortcuts: 'granted', 'menu-bar': 'granted', notifications: 'granted', 'full-access': 'granted' }
    },
    state: async () => ({ overlay: 'granted', shortcuts: 'granted', 'menu-bar': 'prompt', notifications: 'granted', 'full-access': 'granted' }),
  },
  window: {
    getOptions: async () => ({ options: applied, applied }),
    setOptions: async (options: ClaudeDesktop.WindowOptions) => {
      log.push(`setOptions ${JSON.stringify(options)}`)
      applied = options
      return { applied: 'now', reloading: reloadOnSet, options }
    },
    place: async (p: ClaudeDesktop.Placement) => {
      log.push(`place ${JSON.stringify(p)}`)
      return { width: 1, height: 1 }
    },
    show: async () => void log.push('show'),
  },
  globalShortcut: {
    register: async (accel: string, cb: () => void) => {
      if (shortcuts.has(accel)) return false
      shortcuts.set(accel, cb)
      return true
    },
    unregister: async (accel: string) => void shortcuts.delete(accel),
  },
} as unknown as ClaudeDesktop
setDesktop(desktop)

beforeEach(() => {
  log.length = 0
  session.clear()
  reloadOnSet = false
  overlayAnswer = 'granted'
})

test('设置：只保留认识的字段与取值；合并写回时 undefined 表示删除', async () => {
  assert.deepEqual(parseSettings({ planDir: ' /p ', windowMode: 'giant', quickNote: 'yes', menuBar: true, extra: 1 }), {
    planDir: '/p',
    menuBar: true,
  })
  await updateSettings({ quickNote: true, menuBar: true })
  await updateSettings({ menuBar: undefined })
  assert.deepEqual(await readSettings(), { quickNote: true })
  assert.deepEqual(JSON.parse(fs.files.get(SETTINGS_FILE)!), { quickNote: true })
  assert.deepEqual(currentSettings(), { quickNote: true })
})

test('窗口选项只含结构项：完整窗口隐藏标题栏，系统标题栏只留最小尺寸，小窗无边框置顶', () => {
  const full = windowOptions('full', false)
  assert.equal(full.titleBarStyle, 'hiddenInset')
  assert.equal('width' in full || 'height' in full, false)
  assert.deepEqual(windowOptions('full', true), { minWidth: 800, minHeight: 520 })
  assert.deepEqual(windowOptions('compact', false), { frame: false, alwaysOnTop: true, dragHeight: 0, minWidth: 280, minHeight: 320 })
})

test('applyWindowOptions：已经一致时不调用 setOptions；不一致时调用；需要重载时停下', async () => {
  applied = windowOptions('full', false)
  assert.deepEqual(await applyWindowOptions(desktop, {}), { reloading: false })
  assert.equal(log.filter((l) => l.startsWith('setOptions')).length, 0)
  applied = {}
  reloadOnSet = true
  assert.deepEqual(await applyWindowOptions(desktop, {}), { reloading: true })
})

test('applyWindowOptions：15 秒内第 4 次需要重载时不再调用，避免反复重载', async () => {
  reloadOnSet = true
  for (let i = 0; i < 3; i++) {
    applied = {}
    assert.equal((await applyWindowOptions(desktop, {})).reloading, true)
  }
  applied = {}
  const res = await applyWindowOptions(desktop, {})
  assert.equal(res.reloading, false)
  assert.match(res.error ?? '', /停止重试/)
})

test('applyWindowOptions：切换模式后的第一次打开把窗口摆到位置，并清除标记', async () => {
  applied = windowOptions('compact', false)
  await applyWindowOptions(desktop, { windowMode: 'compact', pendingPlace: 'compact' })
  assert.ok(log.includes(`place ${JSON.stringify(PLACEMENT.compact)}`))
  assert.equal((await readSettings()).pendingPlace, undefined)
})

test('switchWindowMode：小窗需要 overlay 权限，被拒绝时报错且不改设置', async () => {
  setCurrentSettings({})
  overlayAnswer = 'denied'
  await assert.rejects(() => switchWindowMode(desktop, 'compact'), /浮动窗口/)
  assert.equal((await readSettings()).windowMode, undefined)
  overlayAnswer = 'granted'
  applied = {}
  reloadOnSet = true
  await switchWindowMode(desktop, 'compact')
  assert.deepEqual(await readSettings(), { quickNote: true, windowMode: 'compact', pendingPlace: 'compact' })
  assert.ok(log.some((l) => l.startsWith('setOptions') && l.includes('"alwaysOnTop":true')))
  // 回到完整窗口不需要权限；平台没有重建时直接摆放并清除标记。
  log.length = 0
  reloadOnSet = false
  await switchWindowMode(desktop, 'full')
  assert.ok(!log.some((l) => l.startsWith('request')))
  assert.ok(log.includes(`place ${JSON.stringify(PLACEMENT.full)}`))
  assert.equal((await readSettings()).pendingPlace, undefined)
})

test('全局快捷键：注册 ⌃⌥N，按下时先拿到窗口再派发记笔记事件；已被占用时返回 false', async () => {
  let fired = 0
  window.addEventListener(QUICK_NOTE_EVENT, () => fired++)
  assert.equal(await enableQuickNoteShortcut(desktop), true)
  assert.equal(await enableQuickNoteShortcut(desktop), false)
  shortcuts.get(QUICK_NOTE_ACCELERATOR)!()
  await new Promise((r) => setTimeout(r, 0))
  assert.ok(log.includes('show'))
  assert.equal(fired, 1)
})
