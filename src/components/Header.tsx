import {
  LayoutGrid,
  GanttChartSquare,
  CalendarClock,
  Download,
  Upload,
  Archive,
  Database,
  Sparkles,
  Trash2,
  Plus,
} from 'lucide-react'
import { useRef } from 'react'
import { useStore, exportJSON, importJSON } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Button } from './ui/Button'
import { Container } from './ui/Container'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/DropdownMenu'
import { cn } from '@/lib/cn'

export type Tab = 'dashboard' | 'timeline' | 'review' | 'archived'

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
  onNew: () => void
}

const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'dashboard', label: '总览', icon: LayoutGrid },
  { id: 'timeline', label: '时间线', icon: GanttChartSquare },
  { id: 'review', label: '回顾', icon: CalendarClock },
  { id: 'archived', label: '归档', icon: Archive },
]

export function Header({ tab, onTabChange, onNew }: Props) {
  const replaceState = useStore((s) => s.replaceState)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const undo = useStore((s) => s.undo)
  const fileRef = useRef<HTMLInputElement>(null)

  const onExport = () => {
    const state = {
      projects: useStore.getState().projects,
      sessions: useStore.getState().sessions,
      version: useStore.getState().version,
    }
    const blob = new Blob([exportJSON(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ message: '已导出 JSON 备份' })
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const state = importJSON(text)
      if (!confirm(`导入 ${state.projects.length} 个项目，这将替换当前所有数据。继续？`)) return
      const token = replaceState(state)
      toast({
        message: `已导入 ${state.projects.length} 个项目`,
        action: { label: '撤销', onClick: () => undo(token) },
      })
    } catch (e) {
      alert(`导入失败：${(e as Error).message}`)
    }
  }

  const onLoadDemo = () => {
    if (confirm('加载 3 个演示项目会替换当前所有项目。继续？')) {
      const token = resetToSeed()
      toast({
        message: '已加载演示数据',
        action: { label: '撤销', onClick: () => undo(token) },
      })
    }
  }

  const onClearAll = () => {
    const count = useStore.getState().projects.length
    if (count === 0) {
      toast({ message: '当前没有任何数据' })
      return
    }
    if (confirm(`确认清空全部 ${count} 个项目？可在通知里点击撤销。`)) {
      const token = replaceState({
        projects: [],
        sessions: [],
        version: useStore.getState().version,
      })
      toast({
        message: '已清空全部数据',
        action: { label: '撤销', onClick: () => undo(token) },
      })
    }
  }

  const tabNav = (className?: string) => (
    <nav
      className={cn(
        'flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900',
        className,
      )}
      aria-label="视图切换"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              active
                ? 'bg-white text-brand-700 shadow-sm dark:bg-neutral-800 dark:text-brand-300'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
            )}
          >
            <Icon size={14} /> {label}
          </button>
        )
      })}
    </nav>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <Container>
        <div className="flex items-center gap-3 py-2.5">
          <Logo size={30} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
              Research Tracker
            </div>
            <div className="hidden truncate text-[11px] leading-tight text-neutral-500 dark:text-neutral-400 sm:block">
              本地版 · 数据存于浏览器
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {tabNav('hidden sm:flex')}

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                aria-label="数据管理"
                title="数据管理"
              >
                <Database size={17} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>备份</DropdownMenuLabel>
                <DropdownMenuItem onSelect={onExport}>
                  <Download size={15} /> 导出 JSON 备份
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                  <Upload size={15} /> 从文件导入
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>演示 / 重置</DropdownMenuLabel>
                <DropdownMenuItem onSelect={onLoadDemo}>
                  <Sparkles size={15} /> 加载示例数据
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={onClearAll}>
                  <Trash2 size={15} /> 清空全部数据
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="primary" size="sm" onClick={onNew} aria-label="新建项目">
              <Plus size={16} /> <span className="hidden sm:inline">新建</span>
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* Mobile: tabs drop to a full-width row below the brand bar. */}
        {tabNav('flex pb-2.5 sm:hidden')}
      </Container>
    </header>
  )
}
