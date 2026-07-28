# 暗夜工作台 UI 重设计 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-07-28-dark-workbench-redesign-design.md` 把 Research Tracker 的全部 UI 重设计为「暗夜工作台」（深色专属、电紫蓝主色、上下卷轴布局），功能 1:1 保持不变。

**Architecture:** 纯视觉/结构重设计。`lib/`（store/focus/date/reminder/id/cn）一律不动；`types.ts` 仅改 `PRIORITY_META` 的样式类名。策略是「令牌先行」：先重写 `index.css` 设计令牌层（dark-only），然后自底向上换肤 UI 原语 → 逐视图重写组件类名（collapse 所有 light/dark 成对类为单一深色值），最后收尾清理。

**Tech Stack:** Vite 8 · React 19 · TypeScript · Tailwind CSS 4（`@theme` + 语义令牌）· shadcn/ui (Radix) · zustand (persist) · sonner。

**项目无测试框架**（scripts 只有 dev/build/lint/preview）。每个任务的验证 = `npm run build`（tsc -b 严格模式）+ `npm run lint` 全绿 + 计划末尾的人工走查清单。

**执行纪律：**
- 每个任务结束必须 build + lint 全绿才能 commit；中途视觉可以先不对，最后总量一起对。
- 中间提交里部分组件会处于「旧类名 + 新令牌」的过渡视觉状态，属正常；不要为此回头改计划外的文件。
- 不改功能逻辑（store 调用、事件处理、拖拽协议 `application/x-rt-todo`、aria/快捷键），只动类名与 JSX 结构（结构改动仅限本计划明确写出的位置）。
- 通用查找/替换词典在**附录 A**，各任务只写该文件特有的改动。

---

### Task 1: 设计令牌层重写 + 移除主题系统

**Files:**
- Rewrite: `src/index.css`
- Modify: `index.html`
- Modify: `src/components/ui/sonner.tsx`
- Modify: `src/components/Header.tsx`（仅移除 ThemeToggle 引用，完整重设计在 Task 3）
- Delete: `src/lib/theme.ts`
- Delete: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: 重写 `src/index.css` 为深色专属令牌层**

完整替换为：

```css
@import "tailwindcss";
@import "tw-animate-css";

/* 深色专属设计：令牌即最终色值（无 .dark 翻转层）。
   过渡期保留 @custom-variant，旧 dark: 类继续可编译；
   收尾任务（Task 10）移除所有 dark: 后，本行一并删除。 */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* 电紫蓝主色 ramp（品牌色；500 为基准）。工具类名沿用 brand-* 不变。 */
  --color-brand-50: #eef0ff;
  --color-brand-100: #e0e4ff;
  --color-brand-200: #c3cbff;
  --color-brand-300: #9aa4ff;
  --color-brand-400: #8190ff;
  --color-brand-500: #6b7cff;
  --color-brand-600: #5b5fff;
  --color-brand-700: #4a4fe8;
  --color-brand-800: #3d41b8;
  --color-brand-900: #33378f;
  --color-brand-950: #1e2154;

  /* Overlay / dialog / menu open motion */
  --animate-overlay-in: overlay-in 0.18s ease-out;
  --animate-content-in: content-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  --animate-menu-in: menu-in 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  --animate-toast-in: toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

/* shadcn/ui 语义令牌 → Tailwind 工具类 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-faint: var(--faint);
  --color-warn: var(--warn);
  --color-success: var(--success);
  --color-panel: var(--panel);
}

:root {
  color-scheme: dark;

  /* 明度递进代替阴影分层 */
  --background: #0b0c10;   /* App 底 */
  --foreground: #e6e8f0;
  --card: #14161d;         /* 看板任务卡 / 弹层 */
  --card-foreground: #e6e8f0;
  --popover: #181a22;      /* 菜单/弹层（略高于 card） */
  --popover-foreground: #e6e8f0;
  --panel: #101218;        /* 项目池卡 / 输入底 / 侧条 */
  --primary: #6b7cff;
  --primary-foreground: #ffffff;
  --secondary: #1a1d26;
  --secondary-foreground: #dfe2ec;
  --muted: #1a1d26;
  --muted-foreground: #8b8fa3;
  --faint: #5c6072;        /* 微标签 / 占位 */
  --accent: #23263a;       /* hover/选中底（电紫蓝着色） */
  --accent-foreground: #c3cbff;
  --destructive: #f26d6d;
  --destructive-foreground: #ffffff;
  --warn: #f0a03f;         /* 今天 / 临期 */
  --success: #4cc38a;
  --border: rgba(255, 255, 255, 0.07);
  --input: rgba(255, 255, 255, 0.09);
  --ring: #6b7cff;
  --radius: 0.375rem;      /* 控件 6px；卡片用 rounded-lg(8px)/rounded-xl(12px) */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

html, body, #root {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;             /* 工作台基准字号 */
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="checkbox"],
input[type="radio"] {
  accent-color: var(--primary);
}

/* 原生 date input 的日历图标在深色下反色 */
input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0.7);
}

/* 拖拽期间锁定选择 + 抓手光标 */
body.is-dragging {
  cursor: grabbing;
  user-select: none;
}

/* 微标签（section kicker）：全大写 + 拉开字距 */
.kicker {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
}

/* 等宽数字（日期/倒计时/统计） */
.mono {
  font-family: var(--font-mono);
  font-size: 0.92em;
  font-variant-numeric: tabular-nums;
}

/* 主按钮微辉光 */
.btn-glow {
  box-shadow: 0 0 0 1px rgba(124, 138, 255, 0.35), 0 4px 16px rgba(91, 95, 255, 0.25);
}

/* 阶段徽标：色相来自 --stage（数据色，主题无关） */
.stage-badge {
  background: color-mix(in oklab, var(--stage) 24%, transparent);
  border-color: color-mix(in oklab, var(--stage) 48%, transparent);
  color: color-mix(in oklab, var(--stage) 74%, white);
}

/* 项目卡辉光（数据色，--proj 由内联提供） */
.proj-card {
  background-color: var(--panel);
  background-image: radial-gradient(
    135% 115% at 100% 0%,
    color-mix(in oklab, var(--proj) 42%, transparent),
    transparent 60%
  );
  border-color: var(--border);
}

@supports (color: oklch(from red 0.5 0.1 h)) {
  .proj-card {
    background-image: radial-gradient(
      135% 115% at 100% 0%,
      oklch(from var(--proj) 0.62 0.15 h / 0.5) 0%,
      oklch(from var(--proj) 0.55 0.12 h / 0) 60%
    );
    border-color: oklch(from var(--proj) 0.44 0.06 h);
  }
  .proj-card:hover {
    border-color: oklch(from var(--proj) 0.56 0.1 h);
  }
}

/* 滚动条（暗色，细） */
* {
  scrollbar-width: thin;
  scrollbar-color: #2a2d38 transparent;
}

/* prefers-reduced-motion：全部动效瞬时化 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes content-in {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes menu-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

- [ ] **Step 2: `index.html` 移除主题预初始化脚本并固定深色**

把 `<head>` 里的整段 `<script>...</script>`（`rt-theme` 那段）删除；`<meta name="color-scheme" content="light dark" />` 改为 `<meta name="color-scheme" content="dark" />`；`<html lang="zh-CN">` 改为 `<html lang="zh-CN" class="dark">`（固定挂 dark 类，使存量 `dark:` 类在过渡期仍然生效）。

- [ ] **Step 3: `src/components/ui/sonner.tsx` 固定 dark**

删除 `import { useTheme } from '@/lib/theme'` 和 `const theme = useTheme()`;`theme={theme as ToasterProps['theme']}` 改为 `theme="dark"`。

- [ ] **Step 4: `src/components/Header.tsx` 临时摘除 ThemeToggle**

删除 `import { ThemeToggle } from './ThemeToggle'` 与 JSX 里的 `<ThemeToggle />` 一处。其余不动（Task 3 整体重做）。

- [ ] **Step 5: 删除文件**

```bash
rm src/lib/theme.ts src/components/ThemeToggle.tsx
```

- [ ] **Step 6: 验证**

Run: `npm run build && npm run lint`
Expected: 全绿（0 errors）。若报某文件还引用 theme/ThemeToggle，回到对应 Step 补删。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "ui: 深色专属令牌层（电紫蓝 brand ramp）+ 移除主题切换系统"
```

---

### Task 2: UI 原语换肤

**Files:**
- Modify: `src/components/ui/Button.tsx` / `Card.tsx` / `Input.tsx` / `Badge.tsx` / `Collapsible.tsx` / `tabs.tsx` / `Dialog.tsx` / `DropdownMenu.tsx` / `ContextMenu.tsx` / `Container.tsx` / `calendar.tsx`

**原则：不改任何导出的 API（props/组件名/签名），只改内部 className。** popover / tooltip / switch / select 已全 token 驱动，新令牌下自动正确，无需改动。

- [ ] **Step 1: `Container.tsx`**

`max-w-7xl` → `max-w-6xl`。

- [ ] **Step 2: `Button.tsx`（cva variants 替换）**

- `primary`: `'bg-primary text-primary-foreground hover:bg-primary/90 btn-glow'`
- `secondary`: `'border border-border bg-panel shadow-xs hover:bg-secondary hover:text-secondary-foreground'`（删 dark:border-input 等——dark: 折叠为唯一值，下同）
- `ghost`: `'hover:bg-accent/60 hover:text-accent-foreground'`
- `danger`: `'border border-destructive/30 text-destructive hover:bg-destructive/10'`
- size `md`: `h-9 px-3.5` 保持；`sm` 保持 `h-8`。

- [ ] **Step 3: `Card.tsx`**

`'rounded-xl border bg-card text-card-foreground shadow-sm'` → `'rounded-xl border bg-card text-card-foreground'`（暗色不要用阴影分层）。

- [ ] **Step 4: `Input.tsx`**

fieldCls 改为：
`'flex w-full min-w-0 rounded-md border border-input bg-panel px-3 py-1 text-sm outline-none transition-[color,box-shadow] placeholder:text-faint selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20'`
（去掉 shadow-xs 与 `dark:bg-input/30`；placeholder 用 faint。）
`Label`: `text-muted-foreground` → `text-[11px] font-medium text-muted-foreground`（其余不变）。

- [ ] **Step 5: `Badge.tsx` / `Collapsible.tsx`**

- Badge 不动（`.stage-badge` 已在新令牌里）。
- Collapsible：`border-border` 保持；header 行 `py-3` → `py-2.5`；展开内容 `pb-4 pl-6 pr-1` 不变；title 加 `text-[13px]`。

- [ ] **Step 6: `tabs.tsx`（分段页签）**

读文件，把：
- TabsList: `bg-muted` → `bg-panel border border-border`，`h-9` → `h-8`，rounded 保持 `rounded-lg`。
- TabsTrigger: `text-sm` → `text-xs`；active 态（`data-[state=active]:`）→ `bg-accent text-accent-foreground shadow-none`；移除 `dark:text-muted-foreground dark:hover:text-foreground` 折叠为 `text-muted-foreground hover:text-foreground`。
- 其余逻辑/ARIA 不动。

- [ ] **Step 7: `Dialog.tsx`**

- Content: `rounded-lg` → `rounded-xl`；加 `shadow-2xl`；`bg-popover` 保持（新令牌下已是深色）。
- Overlay: `bg-black/50 backdrop-blur-sm` → `bg-black/60`。
- 头部 `px-5 py-4` 保持；Title `text-base` → `text-[15px]`。

- [ ] **Step 8: `DropdownMenu.tsx` / `ContextMenu.tsx`**

- Content 类：`rounded-md`→`rounded-lg`，`shadow-md`→`shadow-xl`；item `rounded-sm`→`rounded-md`，`py-1.5`→`py-1.5 px-2` 保持，`text-sm`→`text-[13px]`。
- destructive 项保持 token 表达（`text-destructive data-[highlighted]:bg-destructive/10`）。

- [ ] **Step 9: `calendar.tsx`**

文件内 `buttonVariants` 引用与 day button 保持 token；仅把选中态 `bg-primary text-primary-foreground` 圆角确认 `rounded-md`，today 态 `bg-accent text-accent-foreground`（token 自动正确）。无 neutral/white/black 字样则不改。

- [ ] **Step 10: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿。

```bash
git add -A
git commit -m "ui: 原语层按新令牌换肤（Button/Input/Card/tabs/Dialog/菜单/Container）"
```

---

### Task 3: 顶栏 + Logo + favicon

**Files:**
- Rewrite: `src/components/Header.tsx`
- Rewrite: `src/components/Logo.tsx`
- Rewrite: `public/favicon.svg`

- [ ] **Step 1: 重写 `Logo.tsx`**

```tsx
import { cn } from '@/lib/cn'

/** Brand mark: 电紫蓝渐变方块 + 上升折线（项目推进阶段）。size 单位 px。 */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-md', className)}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #8b93ff 0%, #5b5fff 55%, #4540d6 100%)',
        boxShadow: '0 0 12px rgba(107,124,255,.35)',
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16.5 L9.5 11 L13 14 L20 6.5" />
        <path d="M15.5 6.5 L20 6.5 L20 11" />
      </svg>
    </span>
  )
}
```

- [ ] **Step 2: `public/favicon.svg`**

读取当前文件了解形状，重写为同一图形语言：圆角方块渐变（`#8b93ff→#4540d6`）+ 白色上升折线两 path（viewBox 24）。

- [ ] **Step 3: 重写 `Header.tsx`（保留全部数据管理逻辑与 TabNav 结构）**

行为全保留：导出/导入/清空、file input、toast。只换结构与类名。关键 JSX 骨架：

```tsx
<header className="sticky top-0 z-30 border-b border-border bg-[#0e1015]/95 backdrop-blur-md">
  <Container>
    <div className="flex h-12 items-center gap-2.5">
      <Logo size={20} />
      <div className="text-[13px] font-semibold tracking-tight text-foreground">
        Research Tracker
        <span className="ml-2 hidden text-[10.5px] font-normal text-faint sm:inline">本地 · 数据存于浏览器</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <TabNav ... className="hidden sm:block" />
        {/* 数据管理 DropdownMenu：trigger 改为图标按钮类
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40' */}
        <Button variant="primary" size="sm" onClick={onNew} aria-label="新建项目">
          <Plus size={15} /> <span className="hidden sm:inline">新建</span>
        </Button>
        {/* 隐藏 file input 原样保留 */}
      </div>
    </div>
    <div className="pb-2 sm:hidden">
      <TabNav ... full />
    </div>
  </Container>
</header>
```

TabNav 里 `TabsTrigger` 自定义类 `gap-1.5 px-2.5 text-xs data-[state=active]:text-primary` 删掉（交给 Task 2 的原语样式）。`TABS` 图标尺寸 14 → 13。

- [ ] **Step 4: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿。

```bash
git add -A
git commit -m "ui: 顶栏重做（46px 细栏 + 分段页签 + 电紫蓝 Logo/favicon）"
```

---

### Task 4: 总览页上半 · 本周重点看板（Board.tsx）

**Files:**
- Modify: `src/components/Board.tsx`

行为全保留（拖拽改优先级、从项目池拖入、右键专注、undone pin、toast）。仅视觉与区头结构。

- [ ] **Step 1: hero 区头**

`section aria-label="本周重点"` 内的头部（现在 flex 包 h2+p+FocusTimer）改为：

```tsx
<div className="flex flex-wrap items-end gap-x-3 gap-y-3">
  <div className="min-w-0 flex-1">
    <div className="kicker">Week {format(weekStart(today()), 'ww')} · {rangeLabel}</div>
    <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">本周重点</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">
      {items.length > 0
        ? `${WINDOW_DAYS} 天内到期 · 共 ${items.length} 项 · 右键任务开始专注`
        : `${WINDOW_DAYS} 天内到期会自动出现，也可从下方项目总览拖入`}
    </p>
  </div>
  <FocusTimer />
</div>
```

其中 kicker 行的具体计算（加在现有 `const t = today()` 附近；`weekStart` 签名见 `lib/date.ts`，入参为 Date）：

```tsx
import { addDays, format } from 'date-fns'
import { dateFromToday, daysUntil, weekdayLabel, today, weekStart } from '@/lib/date'
// ...
const ws = weekStart(new Date())
const kickerLabel = `WEEK ${format(ws, 'ww')} · ${format(ws, 'MM.dd')} – ${format(addDays(ws, 6), 'MM.dd')}`
```

JSX 中 kicker 节点为 `<div className="kicker">{kickerLabel}</div>`。渲染示例：`WEEK 31 · 07.27 – 08.02`。

- [ ] **Step 2: 三列看板容器与列头**

- 列容器 `className` 替换为（`cn`）：
  - 基础：`'rounded-lg border p-2 transition-colors border-white/5 bg-white/[0.015]'`
  - isOver：`'border-dashed border-brand-500/70 bg-brand-500/[0.06]'`
- 列头：`<h3>` → `text-[13px] font-semibold text-foreground/90`；计数 span → `mono text-faint`；dot 保持 `meta.dot`（brand-500 已是新色）。
- 空列提示：`text-faint`。
- 拖拽悬停时列头右侧追加提示：`<span className="ml-auto text-[10.5px] text-brand-300">松开设为 {meta.short}</span>`（仅 `isOver` 时渲染）。

- [ ] **Step 3: BoardCard 换肤**

- 卡片类（去掉 `.proj-card`——看板卡不用项目辉光，只用左侧 2px 色条）：
  `'group cursor-grab rounded-md border border-border bg-card p-2.5 pl-3 shadow-[0_1px_2px_rgba(0,0,0,.35)] transition hover:border-white/15 active:cursor-grabbing'`
  不再注入 `--proj` style；改为在卡片内 meta 行用项目色点：
  - 标题行保持 button + `line-clamp-2`；类：`text-[13px] font-medium text-foreground`
  - meta 行：`flex items-center gap-1.5 text-[11px] text-faint`；依次为 `<span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: project.color }} />` + 项目名 truncate + `StageChip` + pin 标 + 右侧 `ml-auto` 的相对日期（`mono`，逾期 `text-warn`→ 用 `text-destructive`、今天 `text-warn`、其余 `text-muted-foreground`）。
  - pin 标类：`'inline-flex shrink-0 items-center gap-0.5 rounded border border-brand-500/40 bg-brand-500/10 px-1 text-[10px] text-brand-300 hover:bg-brand-500/20'`
  - 完成勾选按钮：13px 方角 `'mt-0.5 inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3.5px] border border-[#3a3e4d] text-transparent transition hover:border-brand-400 hover:text-brand-400'`
  - 被拖卡 `dragging && 'opacity-40'` 保持。
  - 相对日期逻辑（rel/overdue/dleft）原样保留。

- [ ] **Step 4: 本周分布条改项目色**

`byProject` 列表项：bar 填充 `className="h-full rounded-full" style={{ width: pct%, background: project.color }}`；标签宽度 `w-28`；百分比 `mono text-faint`；标题 `h3` 改 `kicker` 类；轨道 `bg-muted` → `bg-white/[0.06]`。

- [ ] **Step 5: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿。

```bash
git add -A
git commit -m "ui: 本周重点 hero 看板重做（周编号 kicker + 三列拖拽态 + 任务卡新肤）"
```

---

### Task 5: 总览页下半 · 项目任务池 + 优先级标签

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/ProjectCard.tsx`
- Modify: `src/components/StageChip.tsx`
- Modify: `src/components/PriorityButton.tsx`
- Modify: `src/lib/types.ts`（仅 PRIORITY_META 类名字符串）

- [ ] **Step 1: `types.ts` PRIORITY_META 重写（ chip/text/dot 三个字段，语义不变 ）**

```ts
high: {
  label: '本周主攻', short: '主攻', rank: 0,
  chip: 'border-red-500/35 bg-red-500/10 text-red-300',
  text: 'text-red-300',
  dot: 'bg-red-400',
},
normal: {
  label: '一般', short: '一般', rank: 1,
  chip: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  text: 'text-brand-300',
  dot: 'bg-brand-500',
},
low: {
  label: '次要', short: '次要', rank: 2,
  chip: 'border-white/10 bg-white/[0.04] text-neutral-400',
  text: 'text-neutral-400',
  dot: 'bg-neutral-500',
},
```

- [ ] **Step 2: `StageChip.tsx`**

类改为：`'inline-flex shrink-0 items-center rounded border border-white/5 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground'`

- [ ] **Step 3: `PriorityButton.tsx`**

focus ring 折叠为 `focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background`；`meta.chip` 不动（来自 Step 1）；hover `hover:brightness-105` → `hover:brightness-125`。

- [ ] **Step 4: `Dashboard.tsx`**

- `py-6` → `py-5`；h2 → `text-[15px] font-semibold text-foreground`；描述 p → `text-xs text-muted-foreground`（「N 个有 14 天内的截止」强调色 `text-warn`）；新建按钮保持。
- 折叠 chevron 按钮类 → 图标按钮标准类（同 Header 数据管理 trigger）。
- 归档/空态卡：`'rounded-xl border border-dashed border-white/10 bg-panel p-12 text-center'`，内部文字 `text-muted-foreground`/`text-faint`；Logo size 48 保持。
- 网格 `gap-4` → `gap-3`。

- [ ] **Step 5: `ProjectCard.tsx` 全面换肤**

- 卡片：`p-4` → `p-3.5`，删 `hover:shadow-md`，className 保留 `proj-card group flex cursor-pointer flex-col transition`。
- 标题按钮：`text-sm font-semibold text-foreground`；描述：`text-xs text-muted-foreground`。
- venue chip（名称徽标）→ `inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted-foreground`。
- deadline 横幅改为单行等宽式（去掉 tint 底盒）：
  ```tsx
  <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
    <CalendarClock size={13} className={toneCls} />
    <span className={cn('mono', toneCls)}>{cd.text}</span>
    <span className="text-faint">· {nd.label} · {fmtShort(nd.date)}</span>
  </div>
  ```
  toneCls：past→`text-destructive`；urgent→`text-warn`；soon→`text-warn/80`；far→`text-muted-foreground`。
- 进度区：label 行 `text-[11px] text-faint`；track `bg-black/[0.06] dark:bg-white/10` → `bg-white/[0.08]`；填充保持 `currentStage.color`。
- todo 行：字号 `text-xs`；勾选按钮 `h-4 w-4 rounded-[3.5px] border-[#3a3e4d] hover:border-brand-400 hover:text-brand-400`；GripVertical `text-faint`；日期按钮 `mono text-[11px]`（逾期 `text-destructive`，正常 `text-muted-foreground hover:text-brand-300`）。
- 「还有 N 个…」「添加待办」链接色 → `text-faint hover:text-brand-300`。
- waiting 横幅：`rounded-md border border-warn/25 bg-warn/[0.07] px-2.5 py-2 text-[11px] text-warn`（图标保持 Users 14）。
- 「所有待办已完成 🎉」/「还没有待办」→ `text-[11px] text-faint`。
- 归档卡片降饱和：Dashboard 传 showArchived 时 ProjectCard 外层包 `opacity-60 saturate-50 hover:opacity-90 transition`（用 visible/card 层 `cn(showArchivedCls)`；在 ProjectCard 加可选 prop `dimmed?: boolean`，Dashboard 按 showArchived 传入）。

- [ ] **Step 6: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿。

```bash
git add -A
git commit -m "ui: 项目任务池卡片墙重做 + 优先级/阶段标签新肤"
```

---

### Task 6: 专注计时胶囊（FocusTimer.tsx）

**Files:**
- Modify: `src/components/FocusTimer.tsx`

全部计时/通知/持久化/标题栏逻辑不动；只重做两块视觉：空闲态入口 + 运行态胶囊。RING_SIZE 104 → **28**（`RING_R = 10.5`，`strokeWidth = 3`），胶囊内嵌。

- [ ] **Step 1: 空闲态入口**

Trigger 类 → `'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40'`；bell 块保持（Switch+tooltip），图标配色 text-faint。

- [ ] **Step 2: 运行态胶囊**

外层：`'flex shrink-0 items-center gap-2.5 rounded-lg border border-brand-500/40 bg-card px-3 py-1.5 shadow-[0_0_18px_rgba(107,124,255,.12)] max-sm:w-full'`。
结构（左 ring 小，右两行文本，再右控制图标列）：

```tsx
<div className="relative h-7 w-7 shrink-0" aria-hidden>
  <svg width={28} height={28} viewBox="0 0 28 28" className="-rotate-90">
    <circle cx={14} cy={14} r={10.5} fill="none" strokeWidth={3} className="stroke-white/10" />
    <circle cx={14} cy={14} r={10.5} fill="none" stroke={accent} strokeWidth={3}
      strokeLinecap="round" strokeDasharray={RING_C}
      strokeDashoffset={RING_C * (1 - remainingPct / 100)}
      className="transition-[stroke-dashoffset] duration-500 ease-linear" />
  </svg>
</div>
<div className="min-w-0">
  <div className="mono text-[15px] font-semibold leading-none text-brand-200">{fmtCountdown(remaining)}</div>
  <div className="mt-0.5 max-w-[150px] truncate text-[10.5px] leading-tight text-muted-foreground">{label}</div>
</div>
<div className="flex items-center gap-0.5">
  {bell}
  <幽灵图标按钮 Check title="提前结束并记录本次专注" />
  <幽灵图标按钮 X（text-faint hover:text-destructive）title="取消（不记录）" />
</div>
```

- 删去项目色 ambient glow div 与「专注中」大环文字；`remaining <= 60_000 && 'animate-pulse'` 移到外层胶囊 className 里。
- `accent` 默认 `'var(--color-brand-500)'` 保持可用（brand-500 已新色）。
- RING 常量、`sub` 文案在胶囊里只用 label 一行，删 sub 渲染（保留 plannedMin 信息在 tooltip/title 里：`title={`${sub} · ${fmtCountdown(remaining)}`}` 挂在胶囊外层）。

- [ ] **Step 3: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿；`npm run dev` 手动右键任务启动 30 分钟专注，确认胶囊出现、倒计时走字、`document.title` 更新。

```bash
git add -A
git commit -m "ui: 专注计时改为紧凑胶囊（小进度环 + 等宽倒计时）"
```

---

### Task 7: 日历页（Timeline + DeadlineCalendar）

**Files:**
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/DeadlineCalendar.tsx`

机制全保留（拖动改期 / 月份跳转 / 置灰 / DayDetail 在同一文件的 EventChip 体系；`ui/calendar.tsx` 已在 Task 2 处理）。

- [ ] **Step 1: `Timeline.tsx`**

h2 → `text-lg font-bold tracking-tight`；副文 `text-xs text-muted-foreground`；无项目空态 → `'rounded-xl border border-dashed border-white/10 bg-panel p-12 text-center text-sm text-muted-foreground'`。

- [ ] **Step 2: `DeadlineCalendar.tsx` 骨架**

- 外层 section 高度逻辑不动。
- 月份导航按钮（prev/next）→ 图标按钮标准类（`h-8 w-8 rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40`）。
- 月份标题按钮 → `text-[15px] font-semibold tabular-nums hover:bg-accent/60`。
- 网格容器：`rounded-xl border bg-card` → `rounded-lg border border-border bg-panel`。
- 周日 header cell：`text-[11px] font-medium text-faint`。
- 今天日期数字：保留实心圆，类 → `bg-brand-500 text-white`（bg-primary/text-primary-foreground token 等价，可直接保留，确认渲染色 = #6b7cff）。
- 今天格底 `bg-primary/5` → `bg-brand-500/[0.06]`；dragOver → `bg-brand-500/[0.09] ring-1 ring-inset ring-brand-400/60`。
- 非本月数字 `text-muted-foreground/40`、过去 `text-muted-foreground/55` 保持 token 即可（新 muted 已适配）。

- [ ] **Step 3: EventChip 三色重定**

- deadline：`border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15` → 保持（token 已新）；`rounded` → `rounded-[4px]`，字号 `text-[11px]`。
- rebuttal：`amber-500/amber-600` 系列 → `border-warn/30 bg-warn/10 text-warn`，`rounded-[4px] text-[11px]`。
- todo：`hover:bg-accent` → `hover:bg-white/[0.05]`；字号 `text-[11px]`；阶段色点保持内联 style。
- DayWithDot：`bg-destructive`（deadline 点）保持；`bg-muted-foreground` → `bg-faint`。

- [ ] **Step 4: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿。

```bash
git add -A
git commit -m "ui: 截止月历深色仪器面板化（今天 accent 环 + 事件 chip 语义色）"
```

---

### Task 8: 回顾页（Review + FocusBars + DayDetail + FocusStats）

**Files:**
- Modify: `src/components/Review.tsx`
- Modify: `src/components/FocusBars.tsx`
- Modify: `src/components/DayDetail.tsx`
- Modify: `src/components/FocusStats.tsx`

统计与交互逻辑全保留。

- [ ] **Step 1: `Review.tsx` 区头与切换器**

- h2 → `text-lg font-bold tracking-tight`；副文 `text-xs text-muted-foreground`。
- 周/月切换器：容器 `rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900` → `rounded-lg border border-border bg-panel p-1`；选中按钮 → `bg-accent text-accent-foreground shadow-none`；未选中 → `text-muted-foreground hover:text-foreground`；字号 `text-xs` 保持；ring 折叠 `focus-visible:ring-brand-500`。
- 前后翻页按钮 → 图标按钮标准类；`min-w-[9.5rem]` 期间标签 → `mono text-xs text-muted-foreground`。
- 空态 → 同 Timeline 空态样式 + 「去总览开始专注」secondary 按钮保持。

- [ ] **Step 2: `FocusBars.tsx`**

- 选中列底 `bg-neutral-100/70 dark:bg-neutral-900/50` → `bg-white/[0.045]`；hover → `bg-white/[0.025]`。
- 柱：`bg-brand-500 dark:bg-brand-400` → `bg-brand-400`；未选中 `bg-brand-500/45 ...` → `bg-brand-500/40 group-hover:bg-brand-400/60`；空 day 占位 `bg-neutral-200 dark:bg-neutral-800` → `bg-white/[0.08]`（选中 `bg-brand-700`）。
- 标签色：选中 `text-brand-300 font-semibold`；今天 dot `bg-brand-400`。

- [ ] **Step 3: `DayDetail.tsx`**

- 「今天」徽标 → `rounded border border-brand-500/40 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-300`。
- 24h track：`bg-neutral-100 dark:bg-neutral-900` → `bg-panel border border-border`；刻度线 `bg-white/[0.06]`；now 线 `bg-brand-400` + `shadow-[0_0_6px_rgba(107,124,255,.8)]`。
- session 行 hover `hover:bg-white/[0.03]`；删除按钮 hover `hover:text-destructive`；时间段/时长列 `mono text-faint`。
- 占比条（shares）保持项目色内联 style。

- [ ] **Step 4: `FocusStats.tsx` 仪表卡片化**

- Tile：`'rounded-xl bg-neutral-100/70 p-4 dark:bg-neutral-900/50'` → `'rounded-lg border border-border bg-panel p-3.5'`；label → `text-[11px] text-faint`；大数字 → `mono text-[22px] font-semibold text-foreground`；sub → `text-[11px] text-faint`。
- Delta：涨 `text-success`；跌 `text-warn`。
- 区块标题（专注统计/项目占比/专注热力图）→ `kicker` 类。
- 热力格：无记录 `bg-white/[0.05]`；梯度 `bg-brand-950 → bg-brand-800 → bg-brand-600 → bg-brand-400`（四档）；圆角 `rounded-[3px]`，尺寸 `h-3 w-3` 保持。
- 环图（donut）：保持；中心数字 `mono`；图例文字 `text-xs text-muted-foreground`+`mono` 数值。
- 累计行 → `text-[11px] text-faint`。

- [ ] **Step 5: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿。

```bash
git add -A
git commit -m "ui: 回顾页仪表化（KPI 卡 / 项目色堆叠柱 / 电紫蓝热力图）"
```

---

### Task 9: 项目对话框（ProjectDialog.tsx，编辑双栏 + 全表单换肤）

**Files:**
- Modify: `src/components/ui/Dialog.tsx`（size 新增 `xl`）
- Modify: `src/components/ProjectDialog.tsx`

功能一字不动（即时保存、批次操作、阶段编辑、撤销 toast、confirm/alert）。结构改动只在 EditDialog 顶层：单栏 → 双栏。

- [ ] **Step 1: `Dialog.tsx` size 扩展**

`sizeCls` 加 `xl: 'sm:max-w-[880px]'`；Props union 加 `'xl'`。

- [ ] **Step 2: EditDialog 顶层改双栏**

`<Dialog size="xl" ...>`。body 里现在的单列 `<div className="space-y-4">` 改为：

```tsx
<div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-[290px_minmax(0,1fr)]">
  <div className="space-y-4">  {/* 身份栏 */}
    {/* 项目名称(色板+Input) / 一句话描述 / 当前阶段+起始日期 → 改为单列堆叠（不再 sm:grid-cols-2） */}
    {/* Collapsible 投稿目标（原样移入此栏） */}
  </div>
  <div className="space-y-4">  {/* 工作栏 */}
    {/* 待办区（h3 + 批量菜单 + QuickAddTodo + TodoList）原样移入 */}
    {/* Collapsible 研究阶段 / 合作者 / 备注 原样移入 */}
  </div>
</div>
```

栏间视觉：左栏加 `lg:border-r lg:border-border lg:pr-6`。底部操作条（归档/删除/自动保存注）保持在 Dialog 根部、双栏之外。

- [ ] **Step 3: 文本/控件换肤（该文件内全部做）**

- 节标题「待办」h3 → `text-[13px] font-semibold text-foreground`；计数 `mono text-faint`。
- venueSummary 剩余天数色：`text-red-600 dark:text-red-400` → `text-destructive`；`text-orange-600 dark:text-orange-400` → `text-warn`。
- 说明小字：`text-neutral-500 dark:text-neutral-500` → `text-faint`。
- 「移除投稿目标」幽灵钮：`text-red-600 hover:bg-red-50 dark:...` → `text-destructive hover:bg-destructive/10`。
- StageRow / TodoRow 落点高亮：`border-brand-400 bg-brand-50/50 dark:bg-brand-950/30` → `border-brand-500/60 bg-brand-500/[0.06]`。
- TodoRow 完成勾选钮：done → `border-success bg-success text-[#0b0c10]`；未 done → `border-[#3a3e4d] text-faint hover:border-white/25`。
- 阶段选择 chip（label 内 select）：`bg-neutral-100 ... dark:bg-neutral-800` → `border border-white/10 bg-panel text-muted-foreground hover:bg-secondary`。
- 已完成折叠钮：`text-neutral-500 hover:text-neutral-800 dark:...` → `text-faint hover:text-foreground`。
- 网格参数（CollaboratorRow 的 col-span）不动。
- CreateDialog：保持单栏，`Dialog size` 默认；底部按钮行 border-t 色 token 已正确；主按钮 variant="primary" 自动获得 btn-glow。

- [ ] **Step 4: 验证 + Commit**

Run: `npm run build && npm run lint` → 全绿；`npm run dev` 打开编辑对话框：桌面双栏、窄屏（<1024px）单栏、即时保存、阶段拖拽重排、删除撤销均正常。

```bash
git add -A
git commit -m "ui: 项目对话框重做（编辑态双栏 880px + 全表单深色肤）"
```

---

### Task 10: 收尾清理 + 文档 + 全量人工走查

**Files:**
- Modify: `src/index.css`（删 @custom-variant）
- Modify: `README.md`
- Modify: `uix.lock.json`
- 全项目 grep 清理

- [ ] **Step 1: 清除残留旧体系类名**

```bash
grep -rn "dark:" src --include="*.tsx" --include="*.ts" | grep -v "outline" || true
grep -rn "brand-50\b\|brand-100\|brand-950/50\|bg-white\b\|bg-neutral-50\|text-neutral-900" src --include="*.tsx" --include="*.ts" || true
```

- 预期：全部为空。若命中，按附录 A 词典折叠为深色唯一值后重跑。
- 全空后删除 `src/index.css` 里的 `@custom-variant dark ...` 一行，并从 `index.html` 的 `<html>` 去掉 `class="dark"`。

- [ ] **Step 2: `README.md` 更新**

- 「其它」里删除「深色 / 浅色 / 跟随系统主题。」一条（功能移除）。
- 「数据与隐私」：`rt-theme` 键名描述删除。
- 其余不动。

- [ ] **Step 3: `uix.lock.json` 更新**

`preset` → `"electric-violet-dark-only"`；`presetNote` → `"暗夜工作台：深色专属令牌层（#0b0c10 底 + 电紫蓝 brand ramp，#6b7cff 主色），已移除主题切换。布局=上下卷轴（本周重点 hero + 项目任务池）。"`；`tokenFiles` 保持 `["src/index.css", "src/lib/types.ts"]`。

- [ ] **Step 4: 全量验证**

Run: `npm run build && npm run lint` → 全绿。

- [ ] **Step 5: 人工走查**（`npm run dev`）

- 四页签切换；空态（新 localStorage key 或清空后）与有数据态。
- 本周重点：列间拖拽、从项目池拖入（出现 ⇤本周 pin）、点 pin 移出、勾选完成+撤销、右键 30/60 专注（胶囊出现、走字、title 更新）、提前结束/取消。
- 项目池：卡片点击进编辑、行内改日期、grip 拖出、快速添加（Enter 弹日期选择器、Esc 取消）、折叠/展开。
- 日历：拖 event chip 改期、月份跳转 popover、过去置灰、点 chip 进编辑。
- 回顾：周/月切换、翻页、点柱钻取、删除记录+撤销、热力图 hover title。
- 对话框：全字段即时保存、颜色选择器、阶段增删改色重排、对齐阶段、归档/取消归档、删除+撤销；新建（标题空时创建禁用、Enter 创建）。
- Header：导出/导入（确认框+撤销 toast）/清空、⌘N?（无快捷键——确认按钮即可）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ui: 收尾——移除 dark 变体层、更新 README 与 uix.lock"
```

---

## 附录 A · 通用查找/替换词典（折叠 light/dark 对 → 深色唯一值）

| 旧（light ∥ dark 成对） | 新（唯一值） |
|---|---|
| `text-neutral-900` ∥ `dark:text-neutral-100` | `text-foreground` |
| `text-neutral-800/700` ∥ `dark:text-neutral-200/300` | `text-foreground/90` 或 `text-secondary-foreground` |
| `text-neutral-600/500` ∥ `dark:text-neutral-400` | `text-muted-foreground` |
| `text-neutral-400` ∥ `dark:text-neutral-500` | `text-faint` |
| `bg-neutral-50` ∥ `dark:bg-neutral-900/40` | `bg-white/[0.015]` |
| `bg-neutral-100/70` ∥ `dark:bg-neutral-900/50` | `bg-panel` |
| `bg-white` / `hover:bg-neutral-100` ∥ `dark:hover:bg-neutral-800` | `bg-panel` / `hover:bg-accent/60` |
| `border-neutral-200/300` ∥ `dark:border-neutral-800/700` | `border-border` 或 `border-white/10` |
| `border-brand-400 bg-brand-50/60 dark:...`（拖拽落点） | `border-brand-500/60 bg-brand-500/[0.06]` |
| `ring-brand-500 dark:ring-brand-*` | `ring-ring/50` 或 `ring-brand-500` |
| `text-red-600/700` ∥ `dark:text-red-400/300` | `text-destructive` |
| `text-orange-600` ∥ `dark:text-orange-400` | `text-warn` |
| `text-amber-800 bg-amber-50` ∥ `dark:text-amber-300 dark:bg-amber-950/40` | `text-warn bg-warn/[0.07] border-warn/25` |
| `bg-brand-500 dark:bg-brand-400`（图表主色） | `bg-brand-400` |
| `bg-emerald-500`（完成态） | `bg-success` |

**优先级 dot / 柱状图 / 热力图里出现的 `brand-*` 数字阶一律沿用，但按新 ramp 重读（不写死 hex，全部走 `--color-brand-*` 工具类）。**

## 附录 B · 图标按钮标准类（Header 数据管理、月份导航、折叠 chevron 等复用）

```
inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground 
transition-colors hover:bg-accent/60 hover:text-foreground 
focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40
```

## 附录 C · 冻结清单（任何任务不得触碰）

- `src/lib/store.ts`、`src/lib/focus.ts`、`src/lib/date.ts`、`src/lib/reminder.ts`、`src/lib/id.ts`：一个字节都不改（Task 4 只允许从 `lib/date` 和 `date-fns` 增加 import）。
- `src/lib/cn.ts`、`src/lib/toast.ts`：不改。
- `types.ts` 除 `PRIORITY_META` 三个样式字段外不动。
- 拖拽协议字符串 `application/x-rt-todo`、localStorage 键（`research-tracker`、`rt-overview-collapsed`、reminder 键）、sonner `toast({message, action})` 调用形全部保留。
- 所有 aria-label / title / role 属性保留原文。
