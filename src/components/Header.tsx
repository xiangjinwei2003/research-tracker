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
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
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

/** Segmented view switcher (Radix Tabs as a controlled selector; App renders the body). */
function TabNav({
  tab,
  onTabChange,
  className,
  full,
}: Props & { className?: string; full?: boolean }) {
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as Tab)}
      className={className}
    >
      <TabsList className={cn(full && 'w-full')}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="gap-1.5 px-2.5 text-xs data-[state=active]:text-primary dark:data-[state=active]:text-primary"
          >
            <Icon size={14} /> {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

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

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <Container>
        <div className="flex items-center gap-3 py-2.5">
          <Logo size={30} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight text-foreground">
              Research Tracker
            </div>
            <div className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
              本地版 · 数据存于浏览器
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <TabNav tab={tab} onTabChange={onTabChange} onNew={onNew} className="hidden sm:block" />

            <ThemeToggle />

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    aria-label="数据管理"
                  >
                    <Database size={17} />
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>数据管理</TooltipContent>
              </Tooltip>
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
        <div className="pb-2.5 sm:hidden">
          <TabNav tab={tab} onTabChange={onTabChange} onNew={onNew} full />
        </div>
      </Container>
    </header>
  )
}
