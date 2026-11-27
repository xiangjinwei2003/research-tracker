import { Sparkles } from 'lucide-react'
import { IN_ARTIFACT } from '@/platform/runtime'
import { useSample } from '@/platform/sample'
import { DropdownMenuItem, DropdownMenuSeparator } from './ui/DropdownMenu'
import { ContextMenuItem, ContextMenuSeparator } from './ui/ContextMenu'

/**
 * 任务菜单里的「生成提示词」。只在 Claude 的 Artifact 里出现（网页版不能调用 Claude）；
 * Claude 还没有就绪或没有授权时显示为不可用。
 */
export function PromptMenuItem({
  kind,
  onSelect,
  separator = true,
}: {
  kind: 'dropdown' | 'context'
  onSelect: () => void
  /** 后面还有别的菜单项时加一条分隔线。 */
  separator?: boolean
}) {
  const sample = useSample()
  if (!IN_ARTIFACT) return null
  const Item = kind === 'dropdown' ? DropdownMenuItem : ContextMenuItem
  const Separator = kind === 'dropdown' ? DropdownMenuSeparator : ContextMenuSeparator
  return (
    <>
      <Item onSelect={onSelect} disabled={!sample}>
        <Sparkles /> 生成提示词
      </Item>
      {separator ? <Separator /> : null}
    </>
  )
}
