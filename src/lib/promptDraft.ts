import type { NoteEntry } from './types'
import { fmtMD } from './date'

/**
 * 笔记连同子条目拼成的提示词草稿：子条目按相对缩进每级两个空格，根条目不缩进，
 * 不加列表符号。空条目跳过。
 */
export function outlineText(entries: NoteEntry[]): string {
  if (entries.length === 0) return ''
  const base = entries[0].level
  return entries
    .filter((n) => n.text.trim() !== '')
    .map((n) => {
      const pad = '  '.repeat(Math.max(0, n.level - base))
      return n.text
        .trim()
        .split('\n')
        .map((line) => `${pad}${line}`)
        .join('\n')
    })
    .join('\n')
}

export interface PolishContext {
  note: string
  projectTitle?: string
  folder?: string
  todoTitle?: string
  todoDue?: string
  todoNotes?: string
}

/**
 * 交给 quick 档模型的整理指令。sample 每次调用不带记忆，指令、上下文和输出格式都放在这一段里。
 * 要求与用户级 CLAUDE.md 的表述规范一致：不加没提到的需求，不用破折号，不写客套话。
 */
export function buildPolishInput(ctx: PolishContext): string {
  const context = [
    ctx.projectTitle ? `项目：${ctx.projectTitle}` : null,
    ctx.folder ? `工作目录：${ctx.folder}` : null,
    ctx.todoTitle
      ? `相关任务：${ctx.todoTitle}${ctx.todoDue ? `（截止 ${fmtMD(ctx.todoDue)}）` : ''}`
      : null,
    ctx.todoNotes?.trim() ? `任务备注：${ctx.todoNotes.trim()}` : null,
  ].filter((x): x is string => x !== null)

  return [
    '把下面的随手笔记整理成一段交给 Claude Code 执行的中文提示词。',
    '',
    '要求：',
    '1. 保留笔记的原意和全部具体要求，不增加笔记里没有的需求、技术方案或验收标准。',
    '2. 第一句写目标；然后写背景，只用下面提供的项目与任务信息；然后用编号列出要做的事；最后列出笔记里出现的约束。笔记很短时可以只有目标和要做的事。',
    '3. 笔记里没说清的地方写成「待确认：……」，不替用户决定。',
    '4. 不用破折号和连字符连接句子，不用比喻，不写客套话。',
    '5. 只输出提示词本身，不加标题，不加解释。',
    ...(context.length ? ['', ...context] : []),
    '',
    '笔记：',
    ctx.note,
  ].join('\n')
}

const FILE_UNSAFE = /[\\/:*?"<>|\n\r\t]+/g

/** 任务文件的标题：提示词第一行非空文字，去掉文件名不允许的字符，最长 24 个字符。 */
export function taskFileTitle(prompt: string): string {
  const first = prompt.split('\n').map((l) => l.replace(/^[\s\-*#\d.、]+/, '').trim()).find(Boolean) ?? ''
  const clean = first.replace(FILE_UNSAFE, ' ').replace(/\s+/g, ' ').trim().slice(0, 24).trim()
  return clean || '笔记任务'
}

/** 任务文件的内容，格式与用户项目里的 docs/tasks 文件一致：标题、改动记录、正文。 */
export function taskFileContent(opts: { title: string; prompt: string; noteDate: string; createdOn: Date }): string {
  const d = opts.createdOn
  const created = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  const noted = fmtMD(opts.noteDate) || opts.noteDate
  return [
    `# ${opts.title}`,
    '',
    '## 改动记录',
    '',
    `1. ${created}。由 Research Tracker 从 ${noted}的笔记生成，并发送到 Claude Code。`,
    '',
    '## 任务',
    '',
    opts.prompt.trim(),
    '',
  ].join('\n')
}

/** 写成任务文件后，发给新会话的提示词只给文件路径。 */
export function taskFilePrompt(relativePath: string): string {
  return `读取并执行 ${relativePath}，按其中的要求完成任务。`
}

/** sample 失败时给用户看的说明。`hide` 表示这次打开期间不再显示 AI 整理按钮。 */
export function sampleErrorMessage(code?: string, reason?: string): { message: string; hide: boolean } {
  switch (code) {
    case 'not_granted':
      return { message: '没有允许本应用使用 Claude', hide: true }
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      return { message: '当前账号在这里不能使用 Claude', hide: true }
    case 'rate_limited':
      return {
        message: reason === 'usage_limit' ? '已达到 Claude 套餐的用量上限，稍后再试' : '请求太频繁，稍后再试',
        hide: false,
      }
    case 'session_expired':
      return { message: 'Claude 的登录已过期，请在 Claude 桌面应用里重新登录', hide: false }
    case 'prompt_too_large':
      return { message: '笔记太长，请缩短后再试', hide: false }
    case 'refused':
      return { message: 'Claude 没有处理这段笔记，请修改后再试', hide: false }
    case 'empty_completion':
      return { message: 'Claude 没有返回内容，请修改笔记后再试', hide: false }
    default:
      return { message: '连接 Claude 失败，可以再试一次', hide: false }
  }
}
