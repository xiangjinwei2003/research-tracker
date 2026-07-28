import type { StageDef } from '@/lib/types'
import { cn } from '@/lib/cn'

/** Small neutral pill showing a stage's short label — used in dense todo lists. */
export function StageChip({ stage, className }: { stage: StageDef; className?: string }) {
  return (
    <span
      className={cn(
        // Translucent bg so the chip sits naturally on project-tinted cards too.
        'inline-flex shrink-0 items-center rounded border border-white/5 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground',
        className,
      )}
    >
      {stage.shortLabel || stage.name}
    </span>
  )
}
