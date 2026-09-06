import {
  LayoutGrid,
  CalendarDays,
  CalendarClock,
  Download,
  Upload,
  Archive,
  Database,
  Trash2,
  Plus,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore, exportJSON, importJSON } from '@/lib/store'
import { getPersistHealth, subscribePersistHealth, readRawPersistItem } from '@/lib/persist'
import { toast } from '@/lib/toast'
import { FocusTimer } from './FocusTimer'
import { Button } from './ui/Button'
import { Container } from './ui/Container'
import { Input } from './ui/Input'
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
  { id: 'timeline', label: '日历', icon: CalendarDays },
  { id: 'review', label: '回顾', icon: CalendarClock },
  { id: 'archived', label: '归档', icon: Archive },
]

const activeBase = 'data-[state=active]:bg-accent/60 data-[state=active]:text-foreground'
const inactiveBase = 'hover:bg-accent/30'

/** 顶栏常驻メモ的存储键：localStorage 直存（轻量便签，不进 JSON 备份）。 */
const MEMO_KEY = 'research-tracker.memo'

/** Segmented view switcher (Radix Tabs as a controlled selector; App renders the body). */
function TabNav({ tab, onTabChange }: Pick<Props, 'tab' | 'onTabChange'>) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as Tab)}>
      <TabsList>
        {TABS.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className={cn('gap-1.5 px-2.5 text-xs', inactiveBase, activeBase)}
          >
            <Icon size={14} /> <span className="max-sm:hidden">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function readMemo(): string {
  try {
    return localStorage.getItem(MEMO_KEY) ?? ''
  } catch {
    return ''
  }
}

let memoWriteWarned = false

function writeMemo(value: string): void {
  try {
    localStorage.setItem(MEMO_KEY, value)
  } catch (err) {
    console.warn('[research-tracker] メモ未能写入浏览器存储', err)
    if (!memoWriteWarned) {
      memoWriteWarned = true
      toast({ message: 'メモ未能写入浏览器存储' })
    }
  }
}

export function Header({ tab, onTabChange, onNew }: Props) {
  const replaceState = useStore((s) => s.replaceState)
  const clearAll = useStore((s) => s.clearAll)
  const undo = useStore((s) => s.undo)
  const fileRef = useRef<HTMLInputElement>(null)
  const [memo, setMemo] = useState(readMemo)

  useEffect(() => {
    const tell = (h: ReturnType<typeof getPersistHealth>) => {
      if (h === 'unreadable') {
        toast({ message: '本地数据无法读取，原记录未覆盖。请导出原始记录，或清空后继续。' })
      } else if (h === 'write-failed') {
        toast({ message: '本次改动未能写入浏览器存储' })
      }
    }
    tell(getPersistHealth())
    return subscribePersistHealth(tell)
  }, [])

  const onExport = () => {
    const unreadable = getPersistHealth() === 'unreadable'
    const raw = unreadable ? readRawPersistItem() : null
    const dumpRaw = unreadable && raw != null
    const body = dumpRaw
      ? raw
      : exportJSON({
          projects: useStore.getState().projects,
          sessions: useStore.getState().sessions,
          version: useStore.getState().version,
        })
    const blob = new Blob([body], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dumpRaw
      ? `research-tracker-unreadable-${new Date().toISOString().slice(0, 10)}.json`
      : `research-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ message: dumpRaw ? '已导出无法解析的原始记录' : '已导出 JSON 备份' })
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

  const onClearAll = () => {
    const { projects, sessions, activeTimer } = useStore.getState()
    const unreadable = getPersistHealth() === 'unreadable'
    if (!unreadable && projects.length === 0 && sessions.length === 0 && !activeTimer) {
      toast({ message: '当前没有任何数据' })
      return
    }
    if (confirm('确认清空全部数据？可在通知里点击撤销。')) {
      const token = clearAll()
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
          <img src="/logo-mark.svg" alt="" className="h-6 w-6 rounded-md" />
          <div className="min-w-0 max-sm:hidden">
            <div className="truncate text-sm font-semibold leading-tight text-foreground">
              Research Tracker
            </div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              本地版 · 数据存于浏览器
            </div>
          </div>

          <TabNav tab={tab} onTabChange={onTabChange} />

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <FocusTimer />
            <Button variant="primary" size="sm" onClick={onNew} aria-label="新建项目">
              <Plus size={16} /> <span className="max-sm:hidden">新建</span>
            </Button>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
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
                <DropdownMenuLabel>重置</DropdownMenuLabel>
                <DropdownMenuItem destructive onSelect={onClearAll}>
                  <Trash2 size={15} /> 清空全部数据
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              value={memo}
              onChange={(e) => {
                setMemo(e.target.value)
                writeMemo(e.target.value)
              }}
              placeholder="メモ"
              aria-label="メモ"
              className="w-72 max-sm:hidden"
            />

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
      </Container>
    </header>
  )
}
