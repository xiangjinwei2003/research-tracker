/**
 * End-of-countdown reminder: a short chime plus a system notification, so a
 * finished focus block is noticed even when the tab isn't the one in front.
 * The in-app toast fires regardless — this module is the part that reaches the
 * user when they've looked away.
 */

const PREF_KEY = 'rt-focus-reminder'

export function reminderEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== '0'
  } catch {
    // Preference unreadable (private mode): reminders stay on, which is the
    // safe default — a missed cue is worse than an extra one.
    return true
  }
}

export function setReminderEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0')
  } catch (err) {
    console.warn('[research-tracker] 提醒开关未能保存，下次打开会恢复默认。', err)
  }
}

/* ---------- Chime (Web Audio, no asset) ---------- */

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  // Autoplay policy parks fresh contexts in 'suspended' until a gesture.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/**
 * Unlock audio inside the click that starts a countdown. Without this the
 * chime 30 minutes later would be blocked by the autoplay policy, silently.
 */
export function primeChime(): void {
  audioContext()
}

/** Two soft descending tones — audible without being a shock. */
export function playChime(): void {
  const ac = audioContext()
  if (!ac) {
    console.warn('[research-tracker] 此浏览器不支持 Web Audio，专注结束不会响铃。')
    return
  }
  const t0 = ac.currentTime
  for (const [i, freq] of [880, 1174.66].entries()) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const at = t0 + i * 0.18
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.16, at + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(at)
    osc.stop(at + 0.65)
  }
}

/* ---------- System notification ---------- */

export type NotifyState = NotificationPermission | 'unsupported'

export function notifyState(): NotifyState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Ask once, from a user gesture. Returns the resulting (or existing) state. */
export async function requestNotifyPermission(): Promise<NotifyState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return await Notification.requestPermission()
}

export function notifyFocusDone(body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    // `tag` collapses repeats instead of stacking one banner per session.
    new Notification('专注完成', { body, tag: 'rt-focus-done', icon: '/logo-mark.svg' })
  } catch (err) {
    // Android Chrome only allows notifications through a service worker.
    console.warn('[research-tracker] 系统通知发送失败，已改用页面内提示。', err)
  }
}
