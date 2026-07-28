import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** shadcn/ui field styling (tokens + focus ring), shared by input-like controls. */
const fieldCls =
  'flex w-full min-w-0 rounded-md border border-input bg-panel px-3 py-1 text-sm outline-none transition-[color,box-shadow] ' +
  'placeholder:text-faint selection:bg-primary selection:text-primary-foreground ' +
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} data-slot="input" className={cn(fieldCls, 'h-9', className)} {...rest} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(fieldCls, 'min-h-16 py-2 field-sizing-content resize-y', className)}
      {...rest}
    />
  )
})

/**
 * Native <select> kept as a lightweight fallback for the few remaining plain
 * pickers; the primary selects use the Radix `Select` in ui/select.tsx.
 */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} data-slot="native-select" className={cn(fieldCls, 'h-9 pr-8', className)} {...rest}>
        {children}
      </select>
    )
  },
)

export function Label({
  className,
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground select-none',
        className,
      )}
      {...rest}
    />
  )
}
