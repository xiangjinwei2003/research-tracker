import { toast as sonnerToast } from 'sonner'

export interface ToastOptions {
  message: string
  action?: { label: string; onClick: () => void }
  /** Auto-dismiss in ms; default 6000. */
  durationMs?: number
}

/**
 * App-wide toast, backed by Sonner. Same call shape the app already uses:
 *   toast({ message, action: { label, onClick } })
 * The <Toaster /> is mounted once in App.tsx (from ui/sonner).
 */
export function toast({ message, action, durationMs }: ToastOptions) {
  return sonnerToast(message, {
    duration: durationMs ?? 6000,
    action: action ? { label: action.label, onClick: () => action.onClick() } : undefined,
  })
}
