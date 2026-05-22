import { X } from 'lucide-react'
import { useToastStore } from '@/lib/toast'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
        >
          <span className="flex-1 text-neutral-800 dark:text-neutral-100">{t.message}</span>
          {t.action ? (
            <button
              onClick={() => {
                t.action!.onClick()
                dismiss(t.id)
              }}
              className="rounded px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
            >
              {t.action.label}
            </button>
          ) : null}
          <button
            onClick={() => dismiss(t.id)}
            aria-label="关闭"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
