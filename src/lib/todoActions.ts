import { useStore } from './store'
import { toast } from './toast'
import { primeChime, reminderEnabled, requestNotifyPermission } from './reminder'

/**
 * 完成或删除任务的统一入口：写入 store 并弹出带撤销的通知。
 * 首页任务行、项目列表、任务详情都走这里，行为一致。
 */
export function completeTodo(projectId: string, todoId: string, title: string) {
  const { updateTodo } = useStore.getState()
  updateTodo(projectId, todoId, { done: true })
  toast({
    message: `已完成「${title || '未命名任务'}」`,
    action: { label: '撤销', onClick: () => updateTodo(projectId, todoId, { done: false }) },
  })
}

export function deleteTodo(projectId: string, todoId: string, title: string) {
  const { removeTodo, undo } = useStore.getState()
  const token = removeTodo(projectId, todoId)
  if (!token) return
  toast({
    message: `已删除任务「${title || '未命名'}」`,
    action: { label: '撤销', onClick: () => undo(token) },
  })
}

/** 为某项任务开始一段专注。首页任务行和顶部的下一件事共用。 */
export function startTodoFocus(projectId: string, todoId: string, plannedMin: number) {
  if (reminderEnabled()) {
    primeChime()
    void requestNotifyPermission()
  }
  useStore.getState().startTimer({ plannedMin, projectId, todoId })
  toast({ message: `开始专注 ${plannedMin} 分钟` })
}
