import type { StageDef } from '@/lib/types'
import { Badge } from './ui/Badge'

export function StageBadge({ stage }: { stage: StageDef }) {
  return <Badge color={stage.color}>{stage.name}</Badge>
}
