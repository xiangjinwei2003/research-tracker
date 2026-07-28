# Research Tracker 前端全面重设计 · 设计文档

日期：2026-07-28
状态：已定稿（经用户确认风格方向 A、布局 1、仅深色、电紫蓝主色）

## 0. 背景与目标

Research Tracker 是一个本地优先的科研项目追踪应用（React 19 + Vite + Tailwind 4 + zustand persist，数据存 localStorage，UI 为中文）。本次任务：**保持全部功能不变，重新设计所有 UI**，不受现有 UI（标准 shadcn 靛蓝风）影响。

用户的核心工作流（决策依据）：

1. 在项目里写任务 → 2. 拖入「本周重点」三列看板（主攻/一般/次要）→ 3. 配合日历页看截止、回顾页看专注投入。

## 1. 已确认的方向决策

| 维度 | 决定 | 说明 |
|---|---|---|
| 风格气质 | **A · 暗夜工作台**（Linear/Raycast 系） | 深色打底、细边框、较高密度、工程仪器感；颜色只留给数据与语义 |
| 布局骨架 | **方案 1 · 上下卷轴** | 顶栏 → 本周重点 hero 看板（上）→ 项目总览任务池（下，可折叠），拖拽动线不变 |
| 主题模式 | **仅深色** | 移除 ThemeToggle 与 light token 层；主题切换功能明确放弃（用户选择） |
| 界面主色 | **电紫蓝** `#6b7cff` | 仅用于交互件：主按钮、激活页签、拖放高亮、focus 环、计时器、选择态 |

参考样稿见 `.superpowers/brainstorm/79104-1785224747/content/`（`style-directions.html` / `layout-options.html` / `accent-options.html` / `dashboard-composed.html`）。

## 2. 设计令牌（重写 `src/index.css`）

**全部按深色唯一主题定义，不再有 `.dark` 变体层。**

### 2.1 色彩

- 底色层（明度递进代替阴影分层）：
  - `--background: #0b0c10`（App 底）
  - `--card: #14161d`（看板卡 / 弹层）
  - `--panel: #101218`（项目池卡、侧条、输入底）
  - `--topbar: #0e1015`（顶栏）
- 文字：`--foreground: #e6e8f0`；`--muted-foreground: #8b8fa3`；`--faint: #5c6072`（微标签/占位）
- 边框：`--border: rgba(255,255,255,0.07)`；hover 强化 `rgba(255,255,255,0.14)`
- 主色 ramp（电紫蓝，供 `accent-*` 工具类使用）：50→950 一阶，基准 500=`#6b7cff`、600=`#5b5fff`；`--ring` 同族
- 语义色：`--danger: #f26d6d`（逾期/主攻列点/删除）、`--warn: #f0a03f`（今天/临期）、`--success: #4cc38a`
- 数据色（**不动**）：`types.ts` 的 `PROJECT_COLOR_PRESETS`、`STAGE_COLOR_PRESETS`、`defaultStages()` 原样保留；`.stage-badge`、`.proj-card`（项目色辉光）机制保留并按新底色微调 color-mix 参数

### 2.2 字排

- 基准 UI 字号 13px；元信息 12px；微标签（section kicker）10.5px 全大写 + `letter-spacing: .14em`
- 数字族：日期、倒计时、统计数值、`D-xx` 一律等宽（ui-monospace 栈）+ `tabular-nums`
- 标题：h1 19px/700，区段标题 13px/650

### 2.3 圆角 / 阴影 / 动效

- 圆角：控件 6px、任务卡 8px、面板/项目卡 12px（比现状收紧）
- 阴影极轻：`0 1px 2px rgba(0,0,0,.35)`；对话框/菜单加一档
- 动效：120–200ms `cubic-bezier(0.16,1,0.3,1)`；保留 `prefers-reduced-motion` 全局降级；保留 overlay/menu/toast 入场关键帧

## 3. 各视图重设计

### 3.1 顶栏（`Header.tsx`）

- 46px 高、`--topbar` 底 + 发丝下边框，sticky 保留
- 左：重绘 Logo（电紫蓝渐变圆角方块 + 微辉光）+ `Research Tracker` + 本地存储小字注
- 中：四页签分段控件（Radix Tabs 保留，激活态 = `#23263a` 底 + accent 内描边）
- 右：数据管理菜单（导出/导入/清空，行为不变）、「＋ 新建 ⌘N」主按钮（accent 实底 + 微辉光）
- **移除** ThemeToggle；移动端页签照旧落到第二行整宽

### 3.2 总览页（`Board.tsx` + `Dashboard.tsx` + `ProjectCard.tsx`）

上下卷轴，两区一注：

1. **本周重点（hero）**
   - 区头：周编号微标签（`WEEK 31 · 07.27 – 08.02`）+ h1 + 说明行（7 天内到期自动出现 · 拖入/右键专注）
   - **专注计时胶囊**常驻区头右侧：进度环 + 等宽倒计时 + 绑定任务名；无计时器时显示启动入口（现有 FocusTimer 行为不变，仅换壳）
   - 三列看板（主攻红/一般电紫蓝/次要灰 蓝点）：列间拖动改优先级；拖放悬停列 = 1.5px 虚线 accent 描边 + 列头提示「⇣ 松开设为 ×」；被拖卡 `opacity .4`、落点卡保留
   - 任务卡：13px 标题（2 行截断）、完成框 13px 方角、meta 行 = 项目色点 + 项目名 + 阶段 pill（数据色）+ 右侧等宽相对日期（今天=琥珀、逾期=红、其余灰）；手动加入的带 `⇤ 本周` pin 标（点击移出）；右键 30/60 分钟专注菜单不变；完成卡片 55% 透明度 + 划线
2. **本周分布**：微标签 + 按项目色填充的超细比例条（4px）+ 百分比等宽数字（现状为单色条，改项目色呼应归属）
3. **项目总览（任务池）**：分隔线 + 区头（标题 + 项目数 chip + 折叠 chevron）；卡片网格 3 列（桌面），卡片 = 项目色点+标题+阶段 pill、venue 行（等宽 `▲ CHI 2026 · D-21`，近 deadline 琥珀强调）、等待人行（琥珀棕 `↻ 等 X：…`）、迷你 todo 列表（可拖出，payload 协议不变 `application/x-rt-todo`）、底部注（本周专注时长 · 待办数）
   - 空态、无项目态保留现有文案逻辑

### 3.3 日历页（`Timeline.tsx` + `DeadlineCalendar.tsx` + `DayDetail.tsx`）

- 机制全保留：整屏月视图、周日为首列、待办/▲投稿截止/◆Rebuttal 落格、拖动改期、月份跳转 popover、过去置灰、点日出 DayDetail
- 重设计：深色仪器面板——月头（上年月下导航 + 月份跳转）、格内线高对比分隔、今天格 = accent 细描边 + 点标记；事件 chip 用阶段色 pill + 等宽日序；拖拽中格 = accent 虚线高亮

### 3.4 回顾页（`Review.tsx` + `FocusBars.tsx` + `FocusStats.tsx` + `DayDetail.tsx`）

- 逻辑全保留：周/月切换、前后导航、点击柱钻取当日明细、删除 session + 撤销
- 重设计：每日专注柱按项目色堆叠；16 周热力格改电紫蓝明度渐变；连续天数/总时长/项目拆分做成 3–4 张仪表小卡（等宽大数字 + 微标签）

### 3.5 归档页（`Dashboard.tsx` showArchived）

- 同一卡片规格的降饱和态（纱罩 + 灰化），保留恢复/进入编辑操作

### 3.6 项目对话框（`ProjectDialog.tsx`，编辑 + 新建）

- 功能一字不动：标题/描述/颜色选择器、当前阶段选择、待办（增删改/勾选/优先级按钮/截止日）、投稿目标 Collapsible（venue 预设/自定义、截止日、rebuttal 开关+日期、移除）、研究阶段 Collapsible（改名/改色/增删/拖拽重排/重置默认 9 阶段/删除保护）、合作者 Collapsible（添加/角色/等待事/移除）、备注、归档/取消归档、删除、自动保存提示、即时保存
- 视觉重组：
  - 加深 Dialog（`--card` 底 + 1px 边 + 大投影），桌面端加宽至 ≈880px
  - 编辑态双栏：左栏 = 身份区（标题/描述/颜色/当前阶段/投稿目标），右栏 = 工作区（待办列表、研究阶段、合作者、备注）；窄屏回退单栏
  - 所有 Collapsible 的分节标题改为微标签字排；底部操作条（归档/删除左置，自动保存注右置）
  - 表单控件全部换新令牌（输入底 `--panel`、focus 环 accent、错误红字）

## 4. UI 原语层（`src/components/ui/`）

统一按新令牌换肤，**保留现有 API**（调用点不改签名）：Button、Input(Textarea/Label)、select、Dialog、DropdownMenu、ContextMenu、Card、Collapsible、tabs、popover、tooltip、switch、sonner（固定 dark 主题）、Badge、calendar、Container。

删除：`ThemeToggle.tsx` 与 `lib/theme.ts` 整体移除；`index.html` 移除 `rt-theme` 预初始化脚本，`<meta name="color-scheme">` 改为 `dark`；`rt-theme` localStorage 键弃用（不做迁移）；`public/favicon.svg` 跟随新 Logo 重绘。

## 5. 明确不改动的部分

- `lib/store.ts` / `lib/focus.ts` / `lib/date.ts` / `lib/reminder.ts` / `lib/id.ts` / `lib/cn.ts`：不碰
- `types.ts`：仅 `PRIORITY_META.{chip,text,dot}` 的 Tailwind 类名从 `brand-*` 映射到新令牌（`accent-*`），字段语义与数据格式不变
- 功能冻结清单：9 阶段默认管线与自定义、todo 优先级/拖拽/pin 本周、右键专注计时（30/60、通知提醒、chime）、session 记录与统计、JSON 导入导出、清空数据、全局 Cmd/Ctrl+Z、toast+撤销、原生 confirm/alert、README 所述 localStorage 键名 `research-tracker`

## 6. 影响面清单（会碰的文件）

- 重写：`src/index.css`（令牌与设计基元类）
- 换肤：`src/components/` 全部 22 个组件 + `ui/` 全部原语；`App.tsx`（去主题初始化）
- 重绘：`Logo.tsx`（新视觉）
- 简化/删除：`lib/theme.ts`、`ThemeToggle.tsx`、`index.html`（移除 rt-theme 预初始化脚本、color-scheme 改 dark）、`public/favicon.svg`（重绘）
- 更新：`src/lib/types.ts`（PRIORITY_META 类名映射）、`README.md`（主题功能描述）、`uix.lock.json`（令牌与组件状态记录）

## 7. 验证方式

1. `npm run build`（tsc + vite）通过、无类型错误
2. `npm run lint` 通过
3. `npm run dev` 人工走查清单：
   - 四页签切换、空态/有数据两态
   - 本周重点：列间拖拽改优先级、从项目池拖入（pin）、移出本周、勾选完成+撤销、右键 30/60 分钟专注（计时胶囊出现）
   - 日历：拖动事件改期、月份跳转、过去置灰、DayDetail
   - 回顾：周/月切换、钻取当日、删除 session+撤销、热力图
   - 项目对话框：全字段编辑即时保存、阶段拖拽重排、颜色选择、归档/删除+撤销
   - Header：导出/导入（含撤销）/清空、新建
   - 窄屏（<640px）布局降级
