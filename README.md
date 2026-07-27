# Research Tracker · 科研项目追踪

给研究者用的**科研项目管理面板**：同时推进多个论文项目时，把「每个项目卡在哪个阶段」「哪个 deadline 最近」「在等谁」放在一屏里。

纯前端应用，**数据只存在你自己的浏览器里**（localStorage），没有后端、没有账号、不发任何网络请求。

> A local-first research project tracker for academics juggling several papers at once — stages, venue deadlines, collaborators, todos, and focus sessions. Pure frontend, no backend, no account; all data stays in your browser's localStorage. UI is in Chinese.

---

## 功能

- **总览** —— 项目卡片墙。每张卡显示当前阶段、投稿 venue 与 deadline 倒计时、正在等待的合作者、以及未完成的 todo。
- **日历** —— 整屏月视图（Apple Calendar 式），把所有 todo 的截止日期铺开；支持拖动事项直接改截止日期。
- **回顾** —— 专注计时（番茄钟）记录与统计，按项目/事项汇总投入时间。
- **归档** —— 收起已完成或搁置的项目，不占总览。

其它：

- 9 段默认科研流程（文献调研 → 研究设计 → IRB → 数据采集 → 数据分析 → 论文写作 → 投稿/审稿 → Rebuttal → 完成），**每个项目的阶段可自行增删改名改色**。
- 合作者与「在等 X 做什么」的阻塞状态。
- Todo 优先级、拖拽排序、按阶段归类。
- 全局 `Cmd/Ctrl + Z` 撤销，删除操作都可从通知里点「撤销」。
- 深色 / 浅色 / 跟随系统主题。
- JSON 导出 / 导入 —— 这是**唯一的备份与跨设备迁移手段**，见下方「数据与隐私」。

## 快速开始

需要 Node.js 20+。

```bash
npm install
```

```bash
npm run dev
```

打开终端里给出的地址（默认 http://localhost:5173）即可。首次进入是**空的**，点「新建第一个项目」开始。仓库不附带任何示例数据。

构建生产版本：

```bash
npm run build
```

产物在 `dist/`，是纯静态文件，丢到任意静态托管（Vercel / Netlify / GitHub Pages / 自己的 nginx）即可。

## 数据与隐私

- 所有数据存在浏览器的 **localStorage**，键名 `research-tracker`（主题偏好另存 `rt-theme`）。
- **没有任何后端、遥测或第三方请求**——代码里不存在 `fetch` / `XMLHttpRequest`，断网可用。
- 因此也意味着：**localStorage 是按域名隔离的**。换浏览器、换设备、清缓存、或换一个部署域名访问，数据都不会跟过去。
- 请定期用「导出 JSON」做备份。这是目前唯一的备份/迁移路径，跨设备同步是有意不做的。

## 技术栈

Vite 8 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · zustand (persist) · date-fns · sonner

```
src/
  components/       视图与业务组件
    ui/             shadcn/ui 原语（vendored）
  lib/
    store.ts        zustand store + localStorage 持久化 + schema migration
    types.ts        领域模型（Project / Stage / Todo / Collaborator / Session）
```

### 给二次开发者的两个坑

1. **`store.ts` 的 hydration 是同步的。** 自定义的 `getItem` 同步返回，所以 `SCHEMA_VERSION` 一变，`migrate` → `normalize*` 会在**模块求值期间**执行——此时写在 `create()` 调用**下方**的 `const` 还处在暂时性死区（TDZ）。任何能被 `migrate` 触达的 helper 必须是**函数声明**（hoisted），不能是 `create()` 下方的 `const` 箭头函数，否则会抛错、被 zustand 吞成一次失败的 hydration，表现为「数据没了」。改 `SCHEMA_VERSION` 前请先拿升级前的真实数据测一遍迁移。
2. **JSON 导入走白名单归一化。** `importJSON` → `normalizeProject` 只逐字段拷贝已知字段到新对象，不做 spread，别改成 `{...raw}`。

## License

[MIT](LICENSE)
