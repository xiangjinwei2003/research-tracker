import { defaultStages, type Project } from './types'
import { today } from './date'

export type ProjectDraft = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>

/** 新项目的默认字段：默认阶段流程、今天开始、没有待办。 */
export function emptyProjectDraft(color: string, title = ''): ProjectDraft {
  const stages = defaultStages()
  return {
    title,
    description: '',
    color,
    stage: stages[0].id,
    stages,
    startDate: today(),
    venue: undefined,
    collaborators: [],
    todos: [],
    notes: '',
  }
}
