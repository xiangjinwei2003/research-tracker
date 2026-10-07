import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * shadcn/ui Button internals, kept on this project's variant vocabulary
 * (primary / secondary / ghost / danger · sm / md) so no call site changes.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-brand-400/90 active:bg-brand-600',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-input/70',
        ghost: 'text-muted-foreground hover:bg-hover hover:text-foreground',
        danger:
          'text-destructive hover:bg-destructive/12',
      },
      size: {
        sm: 'h-7 gap-1.5 px-2.5 text-[13px] has-[>svg]:pl-2',
        md: 'h-8 px-3 has-[>svg]:pl-2.5',
        icon: 'size-8',
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
