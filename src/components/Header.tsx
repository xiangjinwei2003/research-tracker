import { LayoutGrid, GanttChartSquare, Download, Upload, Archive, RotateCcw } from 'lucide-react'
import { useRef } from 'react'
import { useStore, exportJSON, importJSON } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Button } from './ui/Button'
import { cn } from '@/lib/cn'

export type Tab = 'dashboard' | 'timeline' | 'archived'

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
}

export function Header({ tab, onTabChange }: Props) {
  const replaceState = useStore((s) => s.replaceState)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const undo = useStore((s) => s.undo)
  const fileRef = useRef<HTMLInputElement>(null)

  const onExport = () => {
    const state = {
      projects: useStore.getState().projects,
      version: useStore.getState().version,
    }
    const blob = new Blob([exportJSON(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const state = importJSON(text)
      if (
        !confirm(
          `导入 ${state.projects.length} 个项目，这将替换当前所有数据。继续？`,
        )
      )
        return
      replaceState(state)
      toast({
        message: `已导入 ${state.projects.length} 个项目`,
        action: { label: '撤销', onClick: () => undo() },
      })
    } catch (e) {
      alert(`导入失败：${(e as Error).message}`)
    }
  }

  const onReset = () => {
    if (confirm('恢复演示数据将清除当前所有项目。继续？')) {
      resetToSeed()
      toast({
        message: '已恢复演示数据',
        action: { label: '撤销', onClick: () => undo() },
      })
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <span className="text-sm font-bold">R</span>
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
              Research Tracker
            </div>
            <div className="text-[11px] leading-tight text-neutral-500">
              本地版 · 数据存于浏览器
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
          <TabButton active={tab === 'dashboard'} onClick={() => onTabChange('dashboard')}>
            <LayoutGrid size={14} /> 总览
          </TabButton>
          <TabButton active={tab === 'timeline'} onClick={() => onTabChange('timeline')}>
            <GanttChartSquare size={14} /> 时间线
          </TabButton>
          <TabButton active={tab === 'archived'} onClick={() => onTabChange('archived')}>
            <Archive size={14} /> 归档
          </TabButton>
        </nav>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onExport} title="导出 JSON 备份">
            <Download size={14} /> 导出
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileRef.current?.click()}
            title="从 JSON 文件导入"
          >
            <Upload size={14} /> 导入
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset} title="恢复演示数据">
            <RotateCcw size={14} />
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
    </header>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
        active
          ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
          : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
      )}
    >
      {children}
    </button>
  )
}
