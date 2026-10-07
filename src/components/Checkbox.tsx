import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** 任务勾选框：圆角方框，勾选后填充强调色。 */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-[background-color,border-color,transform] duration-150 ease-out active:scale-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-faint/80 text-transparent hover:border-ring',
        className,
      )}
    >
      <Check size={11} strokeWidth={3.5} />
    </button>
  )
}
