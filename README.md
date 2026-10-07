# Research Tracker · 科研项目追踪

## 改动记录

2026年10月7日，回答「给 Research Tracker 加「苹果日历订阅」功能：苹果日历订阅一个网址，定时看到我在这个应用里的待办」以及「删除服务端的旧快照 优化存储逻辑，免费档也要求持续的流畅的运行」。
开头原句「项目数据存在你自己的浏览器里（localStorage），没有账号。唯一的网络请求来自可选的「订阅到苹果日历」，默认关闭；开启后，有到期日且未完成的待办标题会上传到部署方的 Vercel 存储，详见「数据与隐私」。」改为说明项目数据仍在本机，唯一的网络请求来自默认关闭的苹果日历订阅。英文简介同步改写。
功能节新增「苹果日历订阅」一条。
数据与隐私节原句「**没有任何后端、遥测或第三方请求**——代码里不存在 `fetch` / `XMLHttpRequest`，断网可用。」改为分开说明本机数据与订阅上传的内容、存放位置、过期和删除规则。
新增「苹果日历订阅的部署」一节：Upstash Redis、环境变量、订阅地址使用生产域名的原因、命令用量、本地验证方式。
技术栈节目录树补上 `api/` 与 `src/server/`。

2026年10月7日，回答「把投稿目标 研究阶段、合作者都删了 感觉没什么必要 全是多余信息 其他的多余信息也可以删除」。
开头原句「把「每个项目卡在哪个阶段」「哪个 deadline 最近」「在等谁」放在一屏里」改为「把各项目的待办、截止日期和专注记录放在一处」；英文简介同步去掉 stages、venue deadlines、collaborators。
其它节删除「9 段默认科研流程……」和「合作者与「在等 X 做什么」的阻塞状态」两条；「Todo 优先级、拖拽排序、按阶段归类」改为「Todo 优先级、拖拽排序」。

2026年10月7日，回答「从优美的UI设计的角度 重构整个UI」（配色可重定、可删减信息、参照 Things 3、只做深色）。
功能节「任务看板」原句「首页先排任务列，概况是未完成、逾期、今天到期和本周专注四个数字。任务按高、普通、低优先级分列。」改为「首页是单列任务列表，按高、普通、低优先级分组，标题下写逾期与今天到期的数量，点击即筛选。」，并补「列表下方是可折叠的项目列表」。
功能节「归档」原句「不占任务看板」改为「不占任务列表」。
其它节原句「默认石墨深色界面，可切换并持久化浅色主题（主题偏好不进入项目数据 schema）。」改为「只有深色界面。」

2026年9月24日，回答「文字和信息太多，太丰富了，首页不够直观，第二是没有窗口自适应，这两点你要改。」
功能节「任务看板」原句「以任务优先级环图、未来 8 日截止格和 7/14 日专注柱图呈现真实概况」改为「首页先排任务列，概况是未完成、逾期、今天到期和本周专注四个数字」。
快速开始原句「点新建第一个项目」改为「点新建项目」。
功能节「归档」原句「不占总览」改为「不占任务看板」。
其它节原句「活动项目优先级分布、未来 8 日截止分布与过去 7/14 日专注概况」改为「首页四个数字来自现有本地数据。专注的按日分布在专注回顾。」

2026年9月7日，回答「/review /loop 审核所有代码，写报告书，之后进行修改，改完之后再审核，再修改直到全绿。」
数据与隐私节补充：GitHub Pages 项目站与账号下其他 Pages 同源，localStorage 可被同 origin 的其他页面读取。给二次开发者第 1 条改为：migrate 用到的 helper 放在独立模块或 `create()` 之前的函数声明里。

2026年9月5日，回答「按照审查结果进行修复」。
数据与隐私节 localStorage 键名 `research-tracker` 改为 `research-tracker-v1`，与 `src/lib/store.ts` 的 `PERSIST_NAME` 一致。

给研究者用的**科研项目任务清单**：同时推进多个论文项目时，把各项目的待办、截止日期和专注记录放在一处。

项目数据存在你自己的浏览器里（localStorage），没有账号。唯一的网络请求来自可选的「订阅到苹果日历」，默认关闭；开启后，有到期日且未完成的待办标题会上传到部署方的 Vercel 存储，详见「数据与隐私」。

> A local-first task list for academics juggling several papers at once: todos grouped by project, due dates, and focus sessions. No account; project data stays in your browser's localStorage. An optional, off by default Apple Calendar subscription uploads titles and due dates of open todos to a small Vercel Function backed by Upstash Redis. UI is in Chinese.

---

## 功能

- **任务**：首页是单列任务列表，按高、普通、低优先级分组，标题下写逾期与今天到期的数量，点击即筛选。支持搜索、项目、逾期和未排期筛选、新建、完成撤销、专注与拖拽调级。列表下方是可折叠的项目列表。
- **日历** —— 整屏月视图（Apple Calendar 式），把所有 todo 的截止日期铺开；支持拖动事项直接改截止日期。
- **回顾** —— 专注计时（番茄钟）记录与统计，按项目/事项汇总投入时间。
- **归档**：收起已完成或搁置的项目，不占任务列表。
- **苹果日历订阅**：日历页标题右侧「订阅到苹果日历」。开启后生成一个 `webcal://` 地址，苹果日历订阅它即可看到有到期日、未完成的待办（全天事件，标题为「[项目名] 标题」）。单向只读，日历里改不回来。苹果日历定时拉取：Mac 可设每 5 分钟，iPhone 由系统决定，改动会在几分钟内出现，不是即时的。

其它：

- Todo 优先级、拖拽排序。
- 首页四个数字来自现有本地数据。专注的按日分布在专注回顾。
- 只有深色界面。
- 全局 `Cmd/Ctrl + Z` 撤销，删除操作都可从通知里点「撤销」。
- JSON 导出 / 导入 —— 这是**唯一的备份与跨设备迁移手段**，见下方「数据与隐私」。

## 快速开始

需要 Node.js 20+。

```bash
npm install
```

```bash
npm run dev
```

打开终端里给出的地址（默认 http://localhost:5173）即可。首次进入是空的，点「新建项目」开始。仓库不附带任何示例数据。

构建生产版本：

```bash
npm run build
```

产物在 `dist/`，是纯静态文件，丢到任意静态托管（Vercel / Netlify / GitHub Pages / 自己的 nginx）即可。

## 数据与隐私

- 所有数据存在浏览器的 **localStorage**，键名 `research-tracker-v1`。
- 没有遥测和第三方请求。不开启苹果日历订阅时，应用不发任何网络请求，断网可用。
- 开启苹果日历订阅后，浏览器把未归档项目里有到期日、未完成的待办上传到 `/api/calendar/<id>`，每条只含待办 id、标题、到期日、是否完成、项目名和项目 id。备注、优先级、专注记录不上传。数据存在部署方 Vercel 项目连接的 Upstash Redis 里。
- 订阅地址里的 id 是 256 位随机令牌，知道地址的人都能读到这份日历。写入用另一个 256 位密钥，服务端只存它的 SHA256 哈希。id 和密钥存在独立的 localStorage 键 `research-tracker.calendar-sync`，不进 JSON 导出。
- 关闭同步或「重新生成地址」会删除服务端数据。服务端数据在最后一次读取或写入后 180 天自动过期。
- 因此也意味着：**localStorage 按 origin 隔离**（协议、主机、端口），不是按路径。换浏览器、换设备、清缓存、或换一个部署域名访问，数据都不会跟过去。GitHub Pages 的项目站（`https://USER.github.io/repo/`）与该账号下其他 Pages 站点同源，那些页面的脚本也能读取这个键。请用独立 origin（Vercel / Netlify 项目域名，或自定义域名）。
- 请定期用「导出 JSON」做备份。这是目前唯一的备份/迁移路径，跨设备同步是有意不做的。

## 苹果日历订阅的部署

这一功能需要服务端存储，其余功能不需要。部署到 Vercel 时：

1. Vercel 项目 → Storage → 创建 Upstash Redis（Free 档即可）并连接到项目。连接后项目里会出现环境变量 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`，`api/calendar/[id].ts` 读这两个。
2. 重新部署一次，让函数读到变量。
3. 没配存储时接口返回 503 和缺少的变量名，对话框显示「未配置」。
4. 订阅地址用 Vercel 自动注入的 `VERCEL_PROJECT_PRODUCTION_URL`（生产域名）。开启了 Vercel Authentication 的部署地址苹果日历无法访问，所以写入走当前页面的同源接口，读取走生产域名，两者共用同一个 Redis。

命令用量：每次日历拉取是 1 条 Redis 命令（`GETEX`），每次上传或删除是 1 条（Lua 脚本）。Mac 每 5 分钟拉取一个月约 8640 条，加上 iPhone 也远低于 Upstash 免费档每月 50 万条。快照内容没变时浏览器不上传。

本地验证：`npm run dev` 不运行 `api/` 函数。接口逻辑在 `src/server/calendarApi.ts`，存储通过接口注入，`npm test` 用内存存储和 `new Request(...)` 直接调用 handler，覆盖 401、413、503、502 和写入后读取 ICS。

## 技术栈

Vite 8 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · zustand (persist) · date-fns · sonner

```
src/
  components/       视图与业务组件
    ui/             shadcn/ui 原语（vendored）
  lib/
    store.ts        zustand store + localStorage 持久化 + schema migration
    types.ts        领域模型（Project / Stage / Todo / Collaborator / Session）
    ics.ts          RFC 5545 日历生成（服务端与测试共用）
    calendarSync.ts 苹果日历订阅的客户端同步
  server/           苹果日历订阅接口的 handler 与 Upstash 存储
api/
  calendar/[id].ts  Vercel Function 入口
```

### 给二次开发者的两个坑

1. **hydration 是同步的。** 自定义的 `getItem` 同步返回，所以 `SCHEMA_VERSION` 一变，`migrate` 会在**模块求值期间**执行。`migrate` 用到的 helper 必须已经初始化：放在 `src/lib/normalize.ts` 这种独立模块里，或写成 `create()` 之前的函数声明。写在 `create()` 下方的 `const` 箭头函数会落在暂时性死区，抛错后被 zustand 吞成一次失败的 hydration，表现为「数据没了」。改 `SCHEMA_VERSION` 前请先拿升级前的真实数据测一遍迁移。
2. **JSON 导入走白名单归一化。** `importJSON` → `normalizeProject` 只逐字段拷贝已知字段到新对象，不做 spread，别改成 `{...raw}`。

## License

[MIT](LICENSE)
