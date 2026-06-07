import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'rt-theme'

function read(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 'system'
}

const mql =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** Resolve a theme preference to the concrete mode that should be shown now. */
export function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') return mql?.matches ? 'dark' : 'light'
  return t
}

/** Toggle the `.dark` class on <html> to match the resolved theme. */
function apply(t: Theme) {
  const dark = resolveTheme(t) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

let current: Theme = read()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

// Keep "system" in sync with OS changes while that preference is active.
mql?.addEventListener('change', () => {
  if (current === 'system') {
    apply(current)
    emit()
  }
})

export function setTheme(t: Theme) {
  current = t
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* ignore persistence failures (e.g. private mode) */
  }
  apply(t)
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Reactive hook: returns the saved preference (light | dark | system). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current, () => current)
}
