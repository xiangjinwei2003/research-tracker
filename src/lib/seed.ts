import type { Project } from './types'
import { defaultStages, PROJECT_COLOR_PRESETS } from './types'
import { uid } from './id'
import { format, addDays } from 'date-fns'

const d = (offsetDays: number) =>
  format(addDays(new Date(), offsetDays), 'yyyy-MM-dd')

export function seedProjects(): Project[] {
  const now = new Date().toISOString()
  return [
    {
      id: uid(),
      title: 'AI 写作助手对研究者工作流的影响',
      description: '半结构化访谈 + 日志分析，理解 LLM 工具如何改变学术写作过程。',
      color: PROJECT_COLOR_PRESETS[0],
      stage: 'analysis',
      stages: defaultStages(),
      startDate: d(-90),
      venue: { name: 'CHI', deadline: d(45) },
      collaborators: [
        { id: uid(), name: '导师 L', role: 'advisor', waitingFor: '初稿反馈' },
        { id: uid(), name: '合作者 W', role: 'coauthor', waitingFor: '' },
      ],
      todos: [
        { id: uid(), title: '招募 20 位参与者', stage: 'data', endDate: d(-40), done: true },
        { id: uid(), title: '半结构化访谈', stage: 'data', endDate: d(-15), done: true },
        { id: uid(), title: '把上周两场访谈转成文字稿', stage: 'data', endDate: d(0), done: true, priority: 'normal' },
        { id: uid(), title: '整理编码结果，给导师过一版', stage: 'analysis', endDate: d(0), done: false, priority: 'high' },
        { id: uid(), title: '补全剩余访谈的主题编码', stage: 'analysis', endDate: d(-1), done: false, priority: 'normal' },
        { id: uid(), title: '初稿撰写', stage: 'writing', endDate: d(35), done: false, priority: 'low' },
      ],
      notes: '导师 L 关心隐私维度的呈现，编码时单独抽一条主线。',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      title: '在线协作工具中的注意力修复',
      description: '探索通知设计如何帮助远程协作者更快回到深度工作。',
      color: PROJECT_COLOR_PRESETS[3],
      stage: 'design',
      stages: defaultStages(),
      startDate: d(-30),
      venue: { name: 'CSCW', deadline: d(110) },
      collaborators: [
        { id: uid(), name: '学生 Z', role: 'student', waitingFor: 'pilot 任务设计' },
      ],
      todos: [
        { id: uid(), title: '文献综述', stage: 'literature', endDate: d(-5), done: true },
        { id: uid(), title: '约学生 Z 过一遍 pilot 任务设计', stage: 'design', endDate: d(0), done: false, priority: 'normal' },
        { id: uid(), title: '研究方案 + IRB', stage: 'irb', endDate: d(30), done: false, priority: 'high' },
        { id: uid(), title: 'Pilot 研究 (N=8)', stage: 'data', endDate: d(55), done: false, priority: 'low' },
        { id: uid(), title: '主研究 (N=30)', stage: 'data', endDate: d(95), done: false },
      ],
      notes: '',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      title: 'JMIR 投稿：可穿戴心率干预',
      description: '已投稿，等待 reviewer 意见，预计 rebuttal 6 月。',
      color: PROJECT_COLOR_PRESETS[7],
      stage: 'submitted',
      stages: defaultStages(),
      startDate: d(-180),
      venue: { name: 'JMIR', deadline: d(-30), rebuttalAt: d(20) },
      collaborators: [
        { id: uid(), name: '合作者 H (临床)', role: 'coauthor', waitingFor: '' },
      ],
      todos: [
        { id: uid(), title: '初稿', stage: 'writing', endDate: d(-90), done: true },
        { id: uid(), title: '同行预审', stage: 'writing', endDate: d(-45), done: true },
        { id: uid(), title: '投稿', stage: 'submitted', endDate: d(-30), done: true },
        { id: uid(), title: '通读 reviewer 引用的 3 篇文献', stage: 'rebuttal', endDate: d(-2), done: false, priority: 'high' },
        { id: uid(), title: 'Rebuttal 准备', stage: 'rebuttal', endDate: d(30), done: false, priority: 'high' },
      ],
      notes: '审稿期间不要再大改方法部分。',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ]
}
