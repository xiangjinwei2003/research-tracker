import { useCallback, useEffect, useState } from "react";
import { Header, type Tab } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { Board } from "@/components/Board";
import { Timeline } from "@/components/Timeline";
import { Review } from "@/components/Review";
import { ProjectDialog } from "@/components/ProjectDialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { startCalendarSync } from "@/lib/calendarSync";
import type { Project } from "@/lib/types";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const undo = useStore((s) => s.undo);

  useEffect(() => {
    startCalendarSync();
  }, []);

  // Global Cmd/Ctrl+Z to undo last destructive action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isUndo =
        (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndo) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        // Let the field handle its own undo.
        return;
      }
      const entry = undo();
      if (entry) {
        e.preventDefault();
        toast({ message: `已撤销：${entry.label}` });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // Stable across renders so memoized cards (ProjectCard) don't re-render every
  // time the dialog's live project updates on a keystroke.
  const openEdit = useCallback((p: Project) => setEditingId(p.id), []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-full bg-background text-foreground">
        <Toaster position="bottom-right" />
        <Header tab={tab} onTabChange={setTab}>
          {tab === "dashboard" ? (
            <Board onEdit={openEdit} />
          ) : tab === "timeline" ? (
            <Timeline onEdit={openEdit} />
          ) : tab === "review" ? (
            <Review onGoBoard={() => setTab("dashboard")} />
          ) : (
            <Dashboard showArchived onEdit={openEdit} />
          )}
        </Header>
        {editingId ? (
          <ProjectDialog
            key={editingId}
            projectId={editingId}
            onClose={() => setEditingId(null)}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
