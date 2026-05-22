import type { Project } from './types'
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
      stage: 'analysis',
      startDate: d(-90),
      venue: { name: 'CHI', deadline: d(45) },
      collaborators: [
        { id: uid(), name: '导师 L', role: 'advisor', waitingFor: '初稿反馈' },
        { id: uid(), name: '合作者 W', role: 'coauthor', waitingFor: '' },
      ],
      milestones: [
        { id: uid(), title: '招募 20 位参与者', startDate: d(-80), endDate: d(-40), done: true },
        { id: uid(), title: '半结构化访谈', startDate: d(-50), endDate: d(-15), done: true },
        { id: uid(), title: '主题分析编码', startDate: d(-20), endDate: d(10), done: false },
        { id: uid(), title: '初稿撰写', startDate: d(0), endDate: d(35), done: false },
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
      stage: 'design',
      startDate: d(-30),
      venue: { name: 'CSCW', deadline: d(110) },
      collaborators: [
        { id: uid(), name: '学生 Z', role: 'student', waitingFor: 'pilot 任务设计' },
      ],
      milestones: [
        { id: uid(), title: '文献综述', startDate: d(-30), endDate: d(-5), done: true },
        { id: uid(), title: '研究方案 + IRB', startDate: d(-5), endDate: d(30), done: false },
        { id: uid(), title: 'Pilot 研究 (N=8)', startDate: d(20), endDate: d(55), done: false },
        { id: uid(), title: '主研究 (N=30)', startDate: d(55), endDate: d(95), done: false },
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
      stage: 'submitted',
      startDate: d(-180),
      venue: { name: 'JMIR', deadline: d(-30), rebuttalAt: d(20) },
      collaborators: [
        { id: uid(), name: '合作者 H (临床)', role: 'coauthor', waitingFor: '' },
      ],
      milestones: [
        { id: uid(), title: '初稿', startDate: d(-180), endDate: d(-90), done: true },
        { id: uid(), title: '同行预审', startDate: d(-90), endDate: d(-45), done: true },
        { id: uid(), title: '投稿', startDate: d(-30), endDate: d(-30), done: true },
        { id: uid(), title: 'Rebuttal 准备', startDate: d(10), endDate: d(30), done: false },
      ],
      notes: '审稿期间不要再大改方法部分。',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ]
}
