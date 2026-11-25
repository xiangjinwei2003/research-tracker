import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/cn'

export interface NoteLink {
  projectId: string
  todoId?: string
}

interface Option extends NoteLink {
  key: string
  label: string
  color: string
  kind: 'project' | 'todo'
}

interface Props {
  current?: NoteLink
  onSelect: (link: NoteLink | null) => void
}

/** 关联到项目或其中一项未完成的任务。可输入筛选，上下键移动，回车选中。 */
export function NoteLinkPicker({ current, onSelect }: Props) {
  const projects = useStore((s) => s.projects)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (text: string) => !q || text.toLowerCase().includes(q)
    const out: Option[] = []
    for (const p of projects) {
      if (p.archived) continue
      const projectLabel = p.title || '未命名项目'
      const todos = p.todos.filter((t) => !t.done && hit(t.title || '未命名任务'))
      if (!hit(projectLabel) && todos.length === 0) continue
      out.push({ key: p.id, projectId: p.id, label: projectLabel, color: p.color, kind: 'project' })
      for (const t of todos) {
        out.push({
          key: `${p.id}/${t.id}`,
          projectId: p.id,
          todoId: t.id,
          label: t.title || '未命名任务',
          color: p.color,
          kind: 'todo',
        })
      }
    }
    return out
  }, [projects, query])

  const choose = (o: Option | undefined) => {
    if (o) onSelect({ projectId: o.projectId, todoId: o.todoId })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next =
        options.length === 0
          ? 0
          : (active + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length
      setActive(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[active])
    }
  }

  return (
    <div className="grid gap-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        placeholder="搜索项目或任务"
        aria-label="搜索项目或任务"
        className="h-8 w-full rounded-md bg-input px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      {current ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="h-7 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          取消关联
        </button>
      ) : null}
      {options.length ? (
        <ul ref={listRef} role="listbox" aria-label="项目与任务" className="-mx-1 max-h-72 overflow-y-auto">
          {options.map((o, i) => {
            const selected = current?.projectId === o.projectId && current?.todoId === o.todoId
            return (
              <li key={o.key} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2 rounded-md py-1 pr-2 text-left text-sm',
                    o.kind === 'project' ? 'pl-2 font-medium text-foreground' : 'pl-6 text-secondary-foreground',
                    i === active && 'bg-hover',
                  )}
                >
                  {o.kind === 'project' ? (
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: o.color }} />
                  ) : null}
                  <span className="truncate">{o.label}</span>
                  {selected ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">已关联</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-2 py-1 text-sm text-muted-foreground">没有匹配的项目或任务</p>
      )}
    </div>
  )
}
