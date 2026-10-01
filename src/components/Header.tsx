import {
  Archive,
  CalendarClock,
  CalendarDays,
  Database,
  Download,
  FolderOpen,
  LayoutGrid,
  Moon,
  Plus,
  StickyNote,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { exportJSON, importJSON, useStore } from "@/lib/store";
import {
  getPersistHealth,
  readRawPersistItem,
  subscribePersistHealth,
} from "@/lib/persist";
import { toast } from "@/lib/toast";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/cn";
import { FocusTimer } from "./FocusTimer";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

export type Tab = "dashboard" | "timeline" | "review" | "archived";
interface Props {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onNew: () => void;
  onEdit: (project: Project) => void;
  children: ReactNode;
}
const TABS = [
  { id: "dashboard", label: "任务看板", icon: LayoutGrid },
  { id: "timeline", label: "日历", icon: CalendarDays },
  { id: "review", label: "专注回顾", icon: CalendarClock },
  { id: "archived", label: "归档", icon: Archive },
] satisfies { id: Tab; label: string; icon: typeof LayoutGrid }[];
const MEMO_KEY = "research-tracker.memo";
const THEME_KEY = "research-tracker.theme";
const readMemo = () => {
  try {
    return localStorage.getItem(MEMO_KEY) ?? "";
  } catch {
    return "";
  }
};
let memoWarned = false;
const writeMemo = (value: string) => {
  try {
    localStorage.setItem(MEMO_KEY, value);
  } catch {
    if (!memoWarned) {
      memoWarned = true;
      toast({ message: "便签未能写入浏览器存储" });
    }
  }
};

export function Header({ tab, onTabChange, onNew, onEdit, children }: Props) {
  const projects = useStore((s) => s.projects);
  const replaceState = useStore((s) => s.replaceState);
  const clearAll = useStore((s) => s.clearAll);
  const undo = useStore((s) => s.undo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [memo, setMemo] = useState(readMemo);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const active = projects.filter((p) => !p.archived);
  useEffect(() => {
    const tell = (health: ReturnType<typeof getPersistHealth>) => {
      if (health === "unreadable")
        toast({
          message:
            "本地数据无法读取，原记录未覆盖。请导出原始记录，或清空后继续。",
        });
      else if (health === "write-failed")
        toast({ message: "本次改动未能写入浏览器存储" });
    };
    tell(getPersistHealth());
    return subscribePersistHealth(tell);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* Theme still applies for this session. */
    }
  }, [theme]);
  const onExport = () => {
    const unreadable = getPersistHealth() === "unreadable";
    const raw = unreadable ? readRawPersistItem() : null;
    const dumpRaw = unreadable && raw != null;
    const body = dumpRaw
      ? raw
      : exportJSON({
          projects: useStore.getState().projects,
          sessions: useStore.getState().sessions,
          version: useStore.getState().version,
        });
    const url = URL.createObjectURL(
      new Blob([body], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dumpRaw ? "research-tracker-unreadable" : "research-tracker"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      message: dumpRaw ? "已导出无法解析的原始记录" : "已导出 JSON 备份",
    });
  };
  const onImport = async (file: File) => {
    try {
      const state = importJSON(await file.text());
      if (
        !confirm(
          `导入 ${state.projects.length} 个项目，这将替换当前所有数据。继续？`,
        )
      )
        return;
      const token = replaceState(state);
      toast({
        message: `已导入 ${state.projects.length} 个项目`,
        action: { label: "撤销", onClick: () => undo(token) },
      });
    } catch (error) {
      alert(`导入失败：${(error as Error).message}`);
    }
  };
  const onClear = () => {
    const state = useStore.getState();
    if (
      getPersistHealth() !== "unreadable" &&
      !state.projects.length &&
      !state.sessions.length &&
      !state.activeTimer
    ) {
      toast({ message: "当前没有任何数据" });
      return;
    }
    if (confirm("确认清空全部数据？可在通知里点击撤销。")) {
      const token = clearAll();
      toast({
        message: "已清空全部数据",
        action: { label: "撤销", onClick: () => undo(token) },
      });
    }
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar z-40 border-r bg-[var(--sidebar)]">
        <div className="flex h-16 items-center gap-2.5 border-b px-4">
          <img src="/logo-mark.svg" alt="" className="size-8 rounded-lg" />
          <div className="hidden min-w-0 min-[68.75rem]:block">
            <div className="truncate text-sm font-semibold">
              Research Tracker
            </div>
            <div className="text-[10px] text-muted-foreground">
              本地研究工作台
            </div>
          </div>
        </div>
        <nav className="space-y-1 p-2" aria-label="主导航">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={tab === id ? "page" : undefined}
              aria-label={label}
              title={label}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm font-medium transition min-[68.75rem]:justify-start",
                tab === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={18} />
              <span className="hidden min-[68.75rem]:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mx-3 mt-4 hidden border-t pt-4 min-[68.75rem]:block">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground">
            <span>进行中项目</span>
            <span>{active.length}</span>
          </div>
          <div className="space-y-0.5">
            {active.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onEdit(p)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                style={{ "--proj": p.color } as CSSProperties}
              >
                <span className="proj-name min-w-0">
                  {p.title || "未命名项目"}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-faint">
                  {p.todos.filter((todo) => !todo.done).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-auto space-y-2 border-t p-3">
          <button
            type="button"
            onClick={() =>
              setTheme((value) => (value === "dark" ? "light" : "dark"))
            }
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground min-[68.75rem]:justify-start min-[68.75rem]:px-2"
            aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            <span className="hidden text-xs min-[68.75rem]:inline">
              {theme === "dark" ? "浅色主题" : "深色主题"}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground min-[68.75rem]:justify-start min-[68.75rem]:px-2"
              aria-label="数据管理"
            >
              <Database size={17} />
              <span className="hidden text-xs min-[68.75rem]:inline">
                数据管理
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>本地数据</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onExport}>
                <Download />
                导出 JSON 备份
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                <Upload />
                从文件导入
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onClear}>
                <Trash2 />
                清空全部数据
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden min-[68.75rem]:block">
            <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <StickyNote size={11} />
              便签
            </div>
            <Input
              value={memo}
              onChange={(e) => {
                setMemo(e.target.value);
                writeMemo(e.target.value);
              }}
              placeholder="随手记…"
              aria-label="便签"
              className="h-8 text-xs"
            />
          </div>
          <p className="hidden px-1 text-[10px] leading-4 text-faint min-[68.75rem]:block">
            数据只保存在此浏览器
          </p>
        </div>
      </aside>
      <div className="app-main" data-app-main>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex min-h-16 min-w-0 max-w-full flex-wrap items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <img src="/logo-mark.svg" alt="" className="size-7 rounded-md" />
            <span className="text-sm font-bold max-[420px]:hidden">
              Research Tracker
            </span>
          </div>
          <div className="hidden min-w-0 items-center gap-2 text-[13px] text-muted-foreground md:flex">
            <FolderOpen size={15} aria-hidden="true" />
            <span className="truncate">
              工作区 / {TABS.find((x) => x.id === tab)?.label}
            </span>
          </div>
          <nav className="order-3 flex w-full justify-between rounded-lg bg-muted p-1 md:hidden">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                aria-label={label}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-md",
                  tab === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                <Icon size={16} />
              </button>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
            <FocusTimer />
            <Button
              variant="primary"
              size="sm"
              onClick={onNew}
              aria-label="新建项目"
            >
              <Plus />
              <span className="hidden sm:inline">新建项目</span>
            </Button>
            <button
              type="button"
              onClick={() =>
                setTheme((value) => (value === "dark" ? "light" : "dark"))
              }
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              aria-label={
                theme === "dark" ? "切换到浅色主题" : "切换到深色主题"
              }
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground"
                  aria-label="数据管理"
                >
                  <Database size={17} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={onExport}>
                    <Download />
                    导出备份
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                    <Upload />
                    导入
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={onClear}>
                    <Trash2 />
                    清空全部数据
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = "";
            }}
          />
        </div>
      </header>
      {children}
      </div>
    </div>
  );
}
