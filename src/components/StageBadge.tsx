import { STAGE_BY_VALUE, type Stage } from '@/lib/types'
import { Badge } from './ui/Badge'

export function StageBadge({ stage }: { stage: Stage }) {
  const s = STAGE_BY_VALUE[stage]
  return <Badge color={`var(${s.colorVar})`}>{s.label}</Badge>
}
