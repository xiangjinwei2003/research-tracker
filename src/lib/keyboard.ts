/** True when Enter should commit, not confirm an IME candidate. */
export function isSubmitEnter(e: {
  key: string
  keyCode?: number
  nativeEvent: { isComposing?: boolean; keyCode?: number }
}): boolean {
  if (e.key !== 'Enter') return false
  if (e.nativeEvent.isComposing) return false
  if (e.nativeEvent.keyCode === 229 || e.keyCode === 229) return false
  return true
}

/**
 * 单键快捷键（N、/、M、1 到 5）是否应当响应：没有修饰键、不在输入中、
 * 页面上没有打开的对话框或菜单。
 */
export function isBareShortcut(e: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  isComposing?: boolean
  target: unknown
}, overlayOpen: boolean): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false
  if (overlayOpen) return false
  const target = e.target as { tagName?: string; isContentEditable?: boolean } | null
  const tag = target?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return false
  if (target?.isContentEditable) return false
  return true
}

/** 打开中的对话框或菜单。Radix 的浮层关闭后会带着 data-state="closed" 留在页面上播完退场动画，不算打开。 */
export const OPEN_OVERLAY_SELECTOR = ['dialog', 'menu', 'alertdialog']
  .map((role) => `[role="${role}"]:not([data-state="closed"])`)
  .join(', ')

/** 页面上是否有打开的对话框或菜单（Radix 浮层带这些 role）。 */
export function overlayIsOpen(doc: Pick<Document, 'querySelector'>): boolean {
  return !!doc.querySelector(OPEN_OVERLAY_SELECTOR)
}
