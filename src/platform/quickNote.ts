/**
 * 「记一条笔记」的入口：全局快捷键、菜单栏菜单、应用菜单都派发同一个事件，
 * App 收到后在右侧栏、笔记页或置顶小窗里新建一条并把光标放进去。
 */
export const QUICK_NOTE_EVENT = 'rt:quick-note'

/** 全局快捷键：⌃⌥N。避开 ⌃Space（常用于切换输入法）和 ⌘⇧N（浏览器无痕窗口）。 */
export const QUICK_NOTE_ACCELERATOR = 'Control+Alt+N'
export const QUICK_NOTE_KEYS = '⌃⌥N'

export function requestQuickNote(): void {
  window.dispatchEvent(new CustomEvent(QUICK_NOTE_EVENT))
}

/** 注册全局快捷键。按下时先把窗口拿到前面（快捷键按下后窗口才能拿到键盘），再派发事件。 */
export async function enableQuickNoteShortcut(desktop: ClaudeDesktop): Promise<boolean> {
  return desktop.globalShortcut.register(QUICK_NOTE_ACCELERATOR, () => {
    void desktop.window.show().finally(requestQuickNote)
  })
}

export async function disableQuickNoteShortcut(desktop: ClaudeDesktop): Promise<void> {
  await desktop.globalShortcut.unregister(QUICK_NOTE_ACCELERATOR)
}
