import { useCallback, useEffect, useState } from 'react'
import { Header, type Tab } from '@/components/Header'
import { Dashboard } from '@/components/Dashboard'
import { Board } from '@/components/Board'
import { Timeline } from '@/components/Timeline'
import { Review } from '@/components/Review'
import { ProjectDialog } from '@/components/ProjectDialog'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import type { Project } from '@/lib/types'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Use the live project from store so it reflects external edits / undo.
  const editing = useStore((s) =>
    editingId ? s.projects.find((p) => p.id === editingId) ?? null : null,
  )
  const undo = useStore((s) => s.undo)

  // Global Cmd/Ctrl+Z to undo last destructive action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isUndo =
        (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
      if (!isUndo) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        // Let the field handle its own undo.
        return
      }
      const entry = undo()
      if (entry) {
        e.preventDefault()
        toast({ message: `已撤销：${entry.label}` })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // Stable across renders so memoized cards (ProjectCard) don't re-render every
  // time the dialog's live project updates on a keystroke.
  const openNew = useCallback(() => {
    setEditingId(null)
    setDialogOpen(true)
  }, [])
  const openEdit = useCallback((p: Project) => {
    setEditingId(p.id)
    setDialogOpen(true)
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-full bg-background text-foreground">
        <Toaster position="bottom-right" />
        <Header tab={tab} onTabChange={setTab} onNew={openNew} />
        {tab === 'dashboard' ? (
          <Board onNew={openNew} onEdit={openEdit} />
        ) : tab === 'timeline' ? (
          <Timeline onEdit={openEdit} />
        ) : tab === 'review' ? (
          <Review onGoBoard={() => setTab('dashboard')} />
        ) : (
          <Dashboard showArchived onNew={openNew} onEdit={openEdit} />
        )}
        <ProjectDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o)
            if (!o) setEditingId(null)
          }}
          project={editing}
        />
      </div>
    </TooltipProvider>
  )
}
