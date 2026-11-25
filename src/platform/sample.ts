/**
 * sample 能力：用查看者自己的 Claude 账号调用 Claude，计入套餐用量。启动时取一次，组件同步读取。
 * 网页版和没有这个能力的环境为 null，界面里不显示 AI 整理。
 */
export type SampleFn = ClaudeCapabilityMap['sample']

let current: SampleFn | null = null

export function setSample(sample: SampleFn | null): void {
  current = sample
}

export function getSample(): SampleFn | null {
  return current
}
