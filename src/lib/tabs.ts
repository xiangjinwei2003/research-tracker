import { IN_ARTIFACT } from '@/platform/runtime'

export type Tab = 'dashboard' | 'notes' | 'timeline' | 'review' | 'phd' | 'archived'

/**
 * 分区的顺序：侧栏、窄屏导航与数字快捷键 1 到 6 都按它排列。
 * 博士申请要调用 Claude，只在 Claude 的 Artifact 里出现，网页版没有这一项。
 */
export const TAB_ORDER: readonly Tab[] = [
  'dashboard',
  'notes',
  'timeline',
  'review',
  ...(IN_ARTIFACT ? (['phd'] as const) : []),
  'archived',
]
