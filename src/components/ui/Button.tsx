import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * shadcn/ui Button internals, kept on this project's variant vocabulary
 * (primary / secondary / ghost / danger · sm / md) so no call site changes.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 btn-glow',
        secondary:
          'border border-border bg-panel shadow-xs hover:bg-secondary hover:text-secondary-foreground',
        ghost: 'hover:bg-accent/60 hover:text-accent-foreground',
        danger:
          'border border-destructive/30 text-destructive hover:bg-destructive/10',
      },
      size: {
        sm: 'h-8 gap-1.5 px-2.5 has-[>svg]:px-2',
        md: 'h-9 px-3.5 has-[>svg]:px-3',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

interface Props
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant, size, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    />
  )
})

export { buttonVariants }
