import type { HTMLAttributes } from 'react'
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
        className,
      )}
      style={{
        ...(color
          ? {
              borderColor: color,
              backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
              color: `color-mix(in oklab, ${color} 85%, black)`,
            }
          : undefined),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  )
}
