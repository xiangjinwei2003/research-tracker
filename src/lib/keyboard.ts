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
 * 单键快捷键（N、/、1 到 4）是否应当响应：没有修饰键、不在输入中、
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

/** 页面上是否有打开的对话框或菜单（Radix 浮层带这些 role）。 */
export function overlayIsOpen(doc: Document): boolean {
  return !!doc.querySelector('[role="dialog"], [role="menu"], [role="alertdialog"]')
}
