import { cn } from '@/lib/cn'

/**
 * Brand mark: a rounded square with a stylised upward "research" path on a
 * brand-indigo gradient. Sized via the `size` prop (px).
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-white/10',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* rising trend line — a project advancing through its stages */}
        <path d="M4 16.5 L9.5 11 L13 14 L20 6.5" />
        <path d="M15.5 6.5 L20 6.5 L20 11" />
      </svg>
    </span>
  )
}
