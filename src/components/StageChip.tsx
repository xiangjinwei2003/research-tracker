import type { StageDef } from '@/lib/types'
import { cn } from '@/lib/cn'

/** Small neutral pill showing a stage's short label — used in dense todo lists. */
export function StageChip({ stage, className }: { stage: StageDef; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
        className,
      )}
    >
      {stage.shortLabel || stage.name}
    </span>
  )
}
