import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '@/lib/store'
import { indentLevel, noteDayLabel as dayLabel, notesOfDay } from '@/lib/notes'
import { uid } from '@/lib/id'
import { toast } from '@/lib/toast'
import type { NoteEntry } from '@/lib/types'
import { cn } from '@/lib/cn'
import { NoteRow, type NoteRowHandlers } from './NoteRow'
import { PromptComposer } from './PromptComposer'
import { takeTodayNoteFocus } from './focus'

interface Props {
  /** 要显示的日期，今天在最前。 */
  days: string[]
  today: string
  /** 右侧栏：字号小一档，今天不再显示日期标题。 */
  compact?: boolean
  /** App 收到「记一条笔记」时递增。 */
  focusTick?: number
}

type FocusRequest = { id: string; caret: number | 'end' }

function virtualNote(id: string, date: string): NoteEntry {
  return { id, date, text: '', level: 0, createdAt: '', updatedAt: '' }
}

function placeCaret(el: HTMLTextAreaElement, caret: FocusRequest['caret']) {
  el.focus()
  const pos = caret === 'end' ? el.value.length : Math.min(caret, el.value.length)
  el.setSelectionRange(pos, pos)
}

const plainKey = (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && !e.altKey

/**
 * 一组日期的笔记。今天没有笔记时显示一行预留的输入框，它的 id 在第一次输入时成为新笔记的 id，
 * 所以输入框不会重新挂载。键盘行为参照 Lody 的每日笔记：Enter 拆分，Shift+Enter 换行，
 * Tab 与 Shift+Tab 改缩进，行首退格删除空行或并入上一条，上下方向键在条目之间移动。
 */
export function NotesView({ days, today, compact = false, focusTick = 0 }: Props) {
  const notes = useStore((s) => s.notes)
  const [ghostSeed] = useState(uid)
  const [composing, setComposing] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const pending = useRef<FocusRequest | null>(null)
  const view = useRef({ days, today })

  useLayoutEffect(() => {
    view.current = { days, today }
  }, [days, today])

  const sections = days.map((date) => {
    const entries = notesOfDay(notes, date)
    if (entries.length === 0 && date === today) {
      const id = `${ghostSeed}-${date}`
      return { date, entries: [virtualNote(id, date)], ghost: id }
    }
    return { date, entries, ghost: null as string | null }
  })

  // 新条目要等下一次渲染才有输入框；每次渲染后检查一次待聚焦的条目。
  useLayoutEffect(() => {
    const req = pending.current
    if (!req) return
    const el = refs.current.get(req.id)
    if (!el) return
    pending.current = null
    placeCaret(el, req.caret)
  })

  const handlers = useMemo<NoteRowHandlers>(() => {
    const focusEntry = (req: FocusRequest) => {
      const el = refs.current.get(req.id)
      if (el) placeCaret(el, req.caret)
      else pending.current = req
    }
    /** 当前显示的全部条目（含预留行）的 id，按屏幕上的先后。 */
    const visibleIds = () => {
      const { days: shown, today: now } = view.current
      const all = useStore.getState().notes
      return shown.flatMap((date) => {
        const entries = notesOfDay(all, date)
        return entries.length === 0 && date === now ? [`${ghostSeed}-${date}`] : entries.map((n) => n.id)
      })
    }

    return {
      register: (id, el) => {
        if (el) refs.current.set(id, el)
        else refs.current.delete(id)
      },

      onText: (entry, text, ghost) => {
        const state = useStore.getState()
        if (ghost && !state.notes.some((n) => n.id === entry.id)) {
          if (text !== '') state.addNote({ id: entry.id, date: entry.date, text })
        } else {
          state.updateNote(entry.id, { text })
        }
      },

      onKey: (entry, e) => {
        const el = e.currentTarget
        if (e.key === 'Escape') {
          el.blur()
          return
        }
        // 输入法组字期间的 Enter、Tab、退格交给输入法。
        if (e.nativeEvent.isComposing || e.keyCode === 229) return
        const state = useStore.getState()
        const note = state.notes.find((n) => n.id === entry.id)
        const { selectionStart: start, selectionEnd: end, value } = el

        // ⌘↩（Windows 上 Ctrl+Enter）：转为提示词。
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          if (note?.text.trim()) setComposing(note.id)
          return
        }

        if (e.key === 'Enter' && !e.shiftKey && plainKey(e)) {
          e.preventDefault()
          if (!note) return
          if (value === '' && note.level > 0) {
            state.updateNote(note.id, { level: note.level - 1 })
            return
          }
          if (start !== end) state.updateNote(note.id, { text: value.slice(0, start) + value.slice(end) })
          const id = state.splitNote(note.id, start)
          if (id) focusEntry({ id, caret: 0 })
          return
        }

        if (e.key === 'Tab' && plainKey(e)) {
          e.preventDefault()
          if (!note) return
          if (e.shiftKey) {
            if (note.level > 0) state.updateNote(note.id, { level: note.level - 1 })
            return
          }
          const day = notesOfDay(state.notes, note.date)
          const at = day.findIndex((n) => n.id === note.id)
          const next = indentLevel(note.level, at > 0 ? day[at - 1].level : null)
          if (next !== note.level) state.updateNote(note.id, { level: next })
          return
        }

        if (e.key === 'Backspace' && start === 0 && end === 0 && plainKey(e)) {
          if (!note) return
          if (value === '') {
            e.preventDefault()
            const ids = visibleIds()
            const at = ids.indexOf(note.id)
            const target = at > 0 ? { id: ids[at - 1], caret: 'end' as const } : ids[at + 1] ? { id: ids[at + 1], caret: 0 } : null
            state.removeNote(note.id)
            if (target) focusEntry(target)
            return
          }
          if (note.level > 0) {
            e.preventDefault()
            state.updateNote(note.id, { level: note.level - 1 })
            return
          }
          const merged = state.mergeNoteUp(note.id)
          if (merged) {
            e.preventDefault()
            focusEntry({ id: merged.id, caret: merged.caret })
          }
          return
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && plainKey(e) && start === end) {
          const up = e.key === 'ArrowUp'
          // 只在第一行按上、最后一行按下时跨到相邻条目。
          const atEdge = up ? !value.slice(0, start).includes('\n') : !value.slice(end).includes('\n')
          if (!atEdge) return
          const ids = visibleIds()
          const target = ids[ids.indexOf(entry.id) + (up ? -1 : 1)]
          if (!target) return
          e.preventDefault()
          focusEntry({ id: target, caret: up ? 'end' : 0 })
        }
      },

      onLink: (entry, link) => {
        const { updateNote } = useStore.getState()
        if (link) updateNote(entry.id, { projectId: link.projectId, todoId: link.todoId })
        else updateNote(entry.id, { projectId: undefined, todoId: undefined })
      },

      onDelete: (entry) => {
        const { removeNote, undo } = useStore.getState()
        const token = removeNote(entry.id, { undoable: true })
        if (token) toast({ message: '已删除笔记', action: { label: '撤销', onClick: () => undo(token) } })
      },

      onCompose: (entry) => setComposing(entry.id),
    }
  }, [ghostSeed])

  // 「记一条笔记」：今天最后一条有内容时新建一条空行，否则直接把光标放到最后。
  useEffect(() => {
    const { days: shown, today: now } = view.current
    if (!shown.includes(now) || !takeTodayNoteFocus()) return
    const state = useStore.getState()
    const todays = notesOfDay(state.notes, now)
    const last = todays[todays.length - 1]
    const id = !last ? `${ghostSeed}-${now}` : last.text.trim() ? state.addNote({ date: now }) : last.id
    const el = refs.current.get(id)
    if (el) placeCaret(el, 'end')
    else pending.current = { id, caret: 'end' }
  }, [focusTick, ghostSeed])

  return (
    <div className={cn('grid', compact ? 'gap-6' : 'gap-10')}>
      {sections.map(({ date, entries, ghost }) => (
        <section key={date} aria-label={date === today ? '今天' : dayLabel(date)}>
          {compact && date === today ? null : (
            <h2 className="mb-2 flex items-baseline gap-2 text-sm">
              <span className="font-semibold text-foreground">{date === today ? '今天' : dayLabel(date)}</span>
              {date === today ? <span className="text-muted-foreground">{dayLabel(date)}</span> : null}
            </h2>
          )}
          <ul className={cn('grid', compact ? 'gap-0.5' : 'gap-1')}>
            {entries.map((entry) => (
              <NoteRow
                key={entry.id}
                entry={entry}
                ghost={entry.id === ghost}
                compact={compact}
                placeholder={entry.id === ghost ? '记点什么' : undefined}
                handlers={handlers}
              />
            ))}
          </ul>
        </section>
      ))}
      {composing ? <PromptComposer noteId={composing} onClose={() => setComposing(null)} /> : null}
    </div>
  )
}
