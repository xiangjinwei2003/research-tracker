import { useSyncExternalStore } from 'react'

/**
 * sample 能力：用查看者自己的 Claude 账号调用 Claude，计入套餐用量。启动时异步取得，
 * 取得之前和网页版、没有这个能力的环境都为 null，界面里不显示调用 Claude 的操作。
 * 组件用 useSample 订阅，取得后自动重新渲染。
 */
export type SampleFn = ClaudeCapabilityMap['sample']

let current: SampleFn | null = null
const listeners = new Set<() => void>()

export function setSample(sample: SampleFn | null): void {
  current = sample
  for (const fn of listeners) fn()
}

export function getSample(): SampleFn | null {
  return current
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useSample(): SampleFn | null {
  return useSyncExternalStore(subscribe, getSample, () => null)
}
