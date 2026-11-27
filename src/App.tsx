import { useCallback, useEffect, useState } from "react";
import { Header, type Tab } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { Board } from "@/components/Board";
import { Timeline } from "@/components/Timeline";
import { Review } from "@/components/Review";
import { PhdReview } from "@/components/PhdReview";
import { TAB_ORDER } from "@/lib/tabs";
import { Notes } from "@/components/Notes";
import { NotesPane } from "@/components/NotesPane";
import { requestTodayNoteFocus } from "@/components/notes/focus";
import { CompactNotes } from "@/components/CompactNotes";
import { useFocusCompletion } from "@/components/useFocusCompletion";
import { ProjectDialog } from "@/components/ProjectDialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { startCalendarSync } from "@/lib/calendarSync";
import { IN_ARTIFACT } from "@/platform/runtime";
import { getDesktop } from "@/platform/desktop";
import { currentSettings } from "@/platform/settings";
import { QUICK_NOTE_EVENT } from "@/platform/quickNote";
import { startDesktopIntegration, takeNotices } from "@/platform/desktopIntegration";
import { bumpSessionsTick, resolvePendingSessions } from "@/platform/claudeSessions";
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
  useFocusCompletion();
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

  // 苹果日历同步：网页版走同源接口，桌面版用 curl 发到生产域名。
  useEffect(() => {
    startCalendarSync();
  }, []);

  // 桌面版：图标、应用菜单、恢复全局快捷键与菜单栏项；启动时积下的提示一并显示。
  useEffect(() => {
    const desktop = getDesktop();
    if (!desktop) return;
    for (const message of takeNotices()) toast({ message });
    startDesktopIntegration(desktop).then(
      (problems) => {
        for (const message of problems) toast({ message });
      },
      (err: unknown) => toast({ message: `桌面功能没有全部启动：${err instanceof Error ? err.message : String(err)}` }),
    );
    // 从笔记发出的提示词配到 Claude Code 会话：打开时找一次，之后每次回到窗口（多半是从 Claude 回来）再找，
    // 并刷新笔记上显示的会话信息。会话记录是 Claude 应用的内部文件，读取失败时只提示一次。
    let warned = false;
    const refreshSessions = () => {
      resolvePendingSessions()
        .then(bumpSessionsTick)
        .catch((err: unknown) => {
          if (warned) return;
          warned = true;
          toast({ message: `读取 Claude Code 会话记录失败：${err instanceof Error ? err.message : String(err)}` });
        });
    };
    refreshSessions();
    window.addEventListener("focus", refreshSessions);
    return () => window.removeEventListener("focus", refreshSessions);
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

  // 记一条笔记：右侧栏可见时在栏里，否则打开笔记页。M、全局快捷键、菜单栏菜单都走这里。
  const quickNote = useCallback(() => {
    requestTodayNoteFocus();
    const paneVisible = pinned && tab !== "notes" && window.innerWidth >= PANE_MIN_WIDTH;
    if (!paneVisible) setTab("notes");
    setNoteFocusTick((n) => n + 1);
  }, [pinned, tab]);

  useEffect(() => {
    window.addEventListener(QUICK_NOTE_EVENT, quickNote);
    return () => window.removeEventListener(QUICK_NOTE_EVENT, quickNote);
  }, [quickNote]);

  // 数字键切换分区，顺序与侧栏一致；M 记一条笔记。
  useEffect(() => {
    const order = TAB_ORDER;
    const onKey = (e: KeyboardEvent) => {
      if (!isBareShortcut(e, overlayIsOpen(document))) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        quickNote();
        return;
      }
      const index = Number(e.key) - 1;
      if (!Number.isInteger(index) || !order[index]) return;
      e.preventDefault();
      setTab(order[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickNote]);

  // Stable across renders so memoized cards (ProjectCard) don't re-render every
  // time the dialog's live project updates on a keystroke.
  const openEdit = useCallback((p: Project) => setEditingId(p.id), []);

  // 置顶小窗只显示今天的笔记；计时结束的处理在上面的 useFocusCompletion，照常生效。
  if (getDesktop() && currentSettings().windowMode === "compact") {
    return (
      <TooltipProvider delayDuration={200}>
        <Toaster position="bottom-right" />
        <CompactNotes />
      </TooltipProvider>
    );
  }

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
          ) : tab === "phd" ? (
            <PhdReview />
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
