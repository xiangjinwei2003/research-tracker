import { useLayoutEffect, type RefObject } from 'react'

/** 文本框高度随内容变化，不出现内部滚动条。Safari 还不支持 field-sizing，所以用脚本量高度。 */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}
