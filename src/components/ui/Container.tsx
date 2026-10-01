import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Shared page container so the header and every view share one width + gutter. */
export function Container({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full min-w-0 px-4 sm:px-6 lg:px-8', className)} {...rest} />
}
