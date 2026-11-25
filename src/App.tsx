import { useCallback, useEffect, useState } from "react";
import { Header, type Tab } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { Board } from "@/components/Board";
import { Timeline } from "@/components/Timeline";
import { Review } from "@/components/Review";
import { Notes } from "@/components/Notes";
import { NotesPane } from "@/components/NotesPane";
import { requestTodayNoteFocus } from "@/components/notes/focus";
import { ProjectDialog } from "@/components/ProjectDialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { startCalendarSync } from "@/lib/calendarSync";
import { IN_ARTIFACT } from "@/platform/runtime";
import { isBareShortcut, overlayIsOpen } from "@/lib/keyboard";
import { legacyMemoText } from "@/lib/notes";
import { today } from "@/lib/date";
import type { Project } from "@/lib/types";

/** 右侧固定笔记栏是否打开：本机界面偏好，读不到时按未固定处理。 */
const PIN_KEY = "research-tracker.notes-pinned";
/** Schema 8 之前侧栏便签的存储键，以及迁移完成的标记。 */
const MEMO_KEY = "research-tracker.memo";
const MEMO_MIGRATED_KEY = "research-tracker.memo-migrated";
/** 右侧栏出现的窗口宽度，与 index.css 的 .notes-pane 一致。 */
const PANE_MIN_WIDTH = 1100;

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(readPinned);
  const [noteFocusTick, setNoteFocusTick] = useState(0);

  const undo = useStore((s) => s.undo);
  const addNote = useStore((s) => s.addNote);

  const togglePinned = useCallback(() => {
    setPinned((was) => {
      const next = !was;
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        // 界面偏好写不进去时只影响下次打开，不提示。
      }
      return next;
    });
  }, []);

  // 网页版的侧栏便签（Schema 8 之前）迁移为今天的一条笔记。先写标记再建笔记，
  // 标记写不进去时不建，避免每次打开都重复一条。原便签内容保留在原来的键里。
  useEffect(() => {
    if (IN_ARTIFACT) return;
    let memo: string | null;
    let migrated: boolean;
    try {
      memo = localStorage.getItem(MEMO_KEY);
      migrated = localStorage.getItem(MEMO_MIGRATED_KEY) === "1";
      if (!migrated) localStorage.setItem(MEMO_MIGRATED_KEY, "1");
    } catch {
      return;
    }
    const text = legacyMemoText(memo, migrated);
    if (!text) return;
    addNote({ date: today(), text });
    toast({ message: "侧栏便签已移到今天的笔记" });
  }, [addNote]);

  // 苹果日历同步走同源的 Vercel 接口，只在网页版运行。
  useEffect(() => {
    if (!IN_ARTIFACT) startCalendarSync();
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

  // 1 到 5 切换分区，顺序与侧栏一致；M 记一条笔记（右侧栏可见时在栏里，否则打开笔记页）。
  useEffect(() => {
    const order: Tab[] = ["dashboard", "notes", "timeline", "review", "archived"];
    const onKey = (e: KeyboardEvent) => {
      if (!isBareShortcut(e, overlayIsOpen(document))) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        requestTodayNoteFocus();
        const paneVisible = pinned && tab !== "notes" && window.innerWidth >= PANE_MIN_WIDTH;
        if (!paneVisible) setTab("notes");
        setNoteFocusTick((n) => n + 1);
        return;
      }
      const index = Number(e.key) - 1;
      if (!Number.isInteger(index) || !order[index]) return;
      e.preventDefault();
      setTab(order[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, tab]);

  // Stable across renders so memoized cards (ProjectCard) don't re-render every
  // time the dialog's live project updates on a keystroke.
  const openEdit = useCallback((p: Project) => setEditingId(p.id), []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-full bg-background text-foreground">
        <Toaster position="bottom-right" />
        <Header
          tab={tab}
          onTabChange={setTab}
          aside={
            pinned && tab !== "notes" ? (
              <NotesPane
                onUnpin={togglePinned}
                onOpenPage={() => setTab("notes")}
                focusTick={noteFocusTick}
              />
            ) : null
          }
        >
          {tab === "dashboard" ? (
            <Board onEdit={openEdit} />
          ) : tab === "notes" ? (
            <Notes pinned={pinned} onTogglePin={togglePinned} focusTick={noteFocusTick} />
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
