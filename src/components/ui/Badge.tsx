import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface Props extends HTMLAttributes<HTMLSpanElement> {
  /** A CSS color (any valid color or `var(--…)`). */
  color?: string
}

export function Badge({ color, className, style, children, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        color && 'stage-badge',
        className,
      )}
      style={{
        ...(color ? ({ '--stage': color } as CSSProperties) : undefined),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  )
}
