import {
  Archive,
  CalendarDays,
  CircleCheck,
  Download,
  Ellipsis,
  Plus,
  Timer,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { ProgressPie } from "./ProgressPie";
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
// 导航图标各有固定颜色，用于区分分区；其余界面保持灰阶。
const TABS = [
  { id: "dashboard", label: "任务", icon: CircleCheck, tint: "text-ring" },
  { id: "timeline", label: "日历", icon: CalendarDays, tint: "text-destructive" },
  { id: "review", label: "专注回顾", icon: Timer, tint: "text-success" },
  { id: "archived", label: "归档", icon: Archive, tint: "text-faint" },
] satisfies { id: Tab; label: string; icon: typeof Archive; tint: string }[];
const MEMO_KEY = "research-tracker.memo";
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

  const dataMenu = (
    <DropdownMenuContent align="start">
      <DropdownMenuLabel>数据只保存在此浏览器</DropdownMenuLabel>
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
  );

  return (
    <div className="app-shell">
      <aside className="app-sidebar z-40 bg-sidebar">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-5 max-[68.74rem]:justify-center max-[68.74rem]:px-0">
          <img src="/logo-mark.svg" alt="" className="size-6 rounded-md" />
          <span className="hidden truncate text-[13px] font-semibold text-secondary-foreground min-[68.75rem]:block">
            Research Tracker
          </span>
        </div>
        <nav className="space-y-px px-3 pt-2" aria-label="主导航">
          {TABS.map(({ id, label, icon: Icon, tint }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={tab === id ? "page" : undefined}
              aria-label={label}
              title={label}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-2.5 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[68.75rem]:justify-start",
                tab === id
                  ? "bg-white/[.08] font-medium text-foreground"
                  : "text-secondary-foreground hover:bg-hover",
              )}
            >
              <Icon size={17} strokeWidth={2.1} className={tint} />
              <span className="hidden min-[68.75rem]:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-6 hidden min-h-0 flex-1 overflow-y-auto px-3 min-[68.75rem]:block">
          {active.length ? (
            <ul className="space-y-px" aria-label="进行中项目">
              {active.map((p) => {
                const total = p.todos.length;
                const done = p.todos.filter((todo) => todo.done).length;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      title={p.title || "未命名项目"}
                      className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-secondary-foreground transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ProgressPie
                        color={p.color}
                        value={total ? done / total : 0}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {p.title || "未命名项目"}
                      </span>
                      {total - done > 0 ? (
                        <span className="shrink-0 text-xs tabular-nums text-faint">
                          {total - done}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="mt-auto shrink-0 px-3 pb-3 pt-2">
          <textarea
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value);
              writeMemo(e.target.value);
            }}
            placeholder="便签"
            aria-label="便签"
            rows={2}
            className="mb-2 hidden w-full resize-none rounded-md bg-transparent px-2.5 py-1.5 text-xs leading-5 text-muted-foreground outline-none transition-colors placeholder:text-faint hover:bg-hover focus:bg-hover focus:text-foreground min-[68.75rem]:block"
          />
          <div className="flex items-center gap-1 max-[68.74rem]:flex-col">
            <button
              type="button"
              onClick={onNew}
              aria-label="新建项目"
              title="新建项目"
              className="flex h-8 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[68.75rem]:justify-start"
            >
              <Plus size={16} />
              <span className="hidden min-[68.75rem]:inline">新建项目</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover"
                aria-label="数据管理"
                title="数据管理"
              >
                <Ellipsis size={16} />
              </DropdownMenuTrigger>
              {dataMenu}
            </DropdownMenu>
          </div>
        </div>
      </aside>
      <div className="app-main" data-app-main>
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
          <div className="flex min-h-12 min-w-0 max-w-full flex-wrap items-center gap-2 px-4 py-1.5 sm:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo-mark.svg" alt="" className="size-6 rounded-md" />
            </div>
            <nav
              className="order-3 flex w-full gap-1 md:hidden"
              aria-label="主导航"
            >
              {TABS.map(({ id, label, icon: Icon, tint }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  aria-label={label}
                  aria-current={tab === id ? "page" : undefined}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs",
                    tab === id
                      ? "bg-white/[.08] font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon size={15} className={tint} />
                  <span className="max-[380px]:hidden">{label}</span>
                </button>
              ))}
            </nav>
            <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1">
              <FocusTimer />
              <button
                type="button"
                onClick={onNew}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground md:hidden"
                aria-label="新建项目"
              >
                <Plus size={17} />
              </button>
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover"
                    aria-label="数据管理"
                  >
                    <Ellipsis size={17} />
                  </DropdownMenuTrigger>
                  {dataMenu}
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
