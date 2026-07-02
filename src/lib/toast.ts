import { create } from 'zustand'
import { uid } from './id'

export interface Toast {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
  /** Auto-dismiss in ms; default 6000. 0 = no auto-dismiss. */
  durationMs?: number
}

interface ToastStore {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

/** Cap how many toasts stack at once so a burst can't cover the viewport. */
const MAX_TOASTS = 4

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (t) => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts, { id, ...t }].slice(-MAX_TOASTS) }))
    const ms = t.durationMs ?? 6000
    if (ms > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
      }, ms)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(t: Omit<Toast, 'id'>) {
  return useToastStore.getState().show(t)
}
