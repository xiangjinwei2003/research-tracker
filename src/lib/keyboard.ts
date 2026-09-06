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
