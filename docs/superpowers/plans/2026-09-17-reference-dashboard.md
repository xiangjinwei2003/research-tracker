# 参考图任务总览实现计划

> 用户仍指定 GPT 5.6 sol 编码；主代理负责设计、数据口径和验收。采用 subagent-driven-development，继续当前分支，不发布或提交。

**Goal:** 将参考图的报告布局与任务卡视觉落实到真实科研项目数据。

**Architecture:** 复用现有状态和新看板操作，独立纯函数聚合任务及专注数据，再渲染四张概况卡。图表点击映射到实际任务过滤，不增加数据 schema。

**Tech Stack:** React、TypeScript、Zustand、Tailwind、Radix、CSS/SVG。

- [ ] 读取 `docs/superpowers/specs/2026-09-17-reference-dashboard-design.md` 与两张 reference 图片，新视觉替代 9/16 规格。
- [ ] `src/lib/boardInsights.ts` + tests：活动任务概况、项目分布、未来8自然日截止、过去7日专注，以及按 projectId+todoId 汇总任务专注分钟。
- [ ] `src/lib/board.ts` + tests：增加精确 dueDate 和 undatedOnly 过滤；保持原过滤交集与排序。
- [ ] `src/components/BoardInsights.tsx`：四张真实数据图表卡，可访问说明、零值、筛选/回顾跳转回调。
- [ ] `src/components/Board.tsx`：标题/统计/工具条/看板新层级，清楚区分概况范围与筛选结果；日期条件chip；列头和底部快捷新建预选优先级。
- [ ] `src/components/BoardTaskCard.tsx`：按参考图重排数据、真实notes/合作者/专注、日期pill和优先级图标，保持全部操作。
- [ ] `src/components/BoardTaskDialog.tsx`：接收预选priority，成功创建才重置筛选，IME保护且不清空未提交输入。
- [ ] `src/App.tsx` 传入查看回顾回调，Header/全局tokens/Logo做参考风格统一；FocusTimer修复tooltip覆盖switch状态样式。
- [ ] 完成代码格式化、npm test、npm run lint、npm run build、git diff --check。
- [ ] 主代理浏览器验证带数据的图表数值、零态、筛选点击与常用操作，1440/1100/375宽度截图；发现问题交回sol。
- [ ] 更新README和验收文档，保留本地预览与独立样例截图，明确未对真实用户数据写入示例。
