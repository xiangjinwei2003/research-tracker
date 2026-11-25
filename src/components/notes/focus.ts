/**
 * 「记一条笔记」（快捷键 M）的焦点请求。App 先决定由笔记页还是右侧栏接收，
 * 再递增 focusTick；接收方挂载或收到新的 tick 时取走请求，把光标放到今天最后一条末尾。
 * 用模块变量是因为笔记页可能在请求之后才挂载。
 */
let pending = false

export function requestTodayNoteFocus(): void {
  pending = true
}

export function takeTodayNoteFocus(): boolean {
  const had = pending
  pending = false
  return had
}
