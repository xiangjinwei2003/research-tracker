import { useEffect, useState } from 'react'
import { Header, type Tab } from '@/components/Header'
import { Dashboard } from '@/components/Dashboard'
import { Board } from '@/components/Board'
import { Timeline } from '@/components/Timeline'
import { ProjectDialog } from '@/components/ProjectDialog'
import { Toaster } from '@/components/Toaster'
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

  const openNew = () => {
    setEditingId(null)
    setDialogOpen(true)
  }
  const openEdit = (p: Project) => {
    setEditingId(p.id)
    setDialogOpen(true)
  }

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Header tab={tab} onTabChange={setTab} onNew={openNew} />
      {tab === 'dashboard' ? (
        <Board onNew={openNew} onEdit={openEdit} />
      ) : tab === 'timeline' ? (
        <Timeline onEdit={openEdit} />
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
      <Toaster />
    </div>
  )
}
