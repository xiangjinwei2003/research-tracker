import type { NoteEntry, Todo } from './types'
import { fmtMD } from './date'
import { subtree } from './notes'

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

/** 写提示词时交给模型的材料。 */
export interface PromptContext {
  /** 用户自己的话：笔记连同子条目，或任务的备注与关联的笔记。可以为空。 */
  words: string
  projectTitle?: string
  todoTitle?: string
  todoDue?: string
}

/**
 * 用户认为写得好的提示词，作为风格参照放进指令。前三条是用户收集的原句，
 * 第四条由用户自己的一段要求压缩而成。
 */
export const PROMPT_STYLE_EXAMPLES = [
  '在我最近反复讨论的问题背后，有没有一个更深的问题，是我一直在绕着它走，却没有真正问出来的？',
  '先读相关论文，找到当前方法真正卡住的问题；再跳出本领域，去其他方向寻找解决过类似结构问题的方法；最后把这些线索整理成完整的研究方案。',
  '从第一性原理思考问题。',
  '可以挑战现有文档和架构，有必要时完整重构，并自行测试。要从根本上解决问题，不要只解决跑出来的测试问题。我提的点只是我注意到的点，不要局限于这些。',
] as const

/**
 * 交给模型的写提示词指令。sample 每次调用不带记忆，要求、风格参照、材料都放在这一段里。
 * 用户的要求：提示词简单，不限制 Claude 的发挥，不涉及具体细节；
 * 有用户自己的话时只把话整理清楚，只有任务名时写成根本性的提问或方向。
 */
export function buildPromptInput(ctx: PromptContext): string {
  const words = ctx.words.trim()
  const context = [
    ctx.projectTitle ? `项目：${ctx.projectTitle}` : null,
    ctx.todoTitle ? `任务：${ctx.todoTitle}${ctx.todoDue ? `（截止 ${fmtMD(ctx.todoDue)}）` : ''}` : null,
  ].filter((x): x is string => x !== null)

  return [
    '帮我写一段交给 Claude 开始工作的提示词，我会自己复制给 Claude。',
    '',
    '我对提示词的要求：',
    '1. 简单。通常两到四句；我自己的话很长时，可以按我的话的长度来。',
    '2. 不限制 Claude 的发挥。说清要做成什么、我真正关心什么，不规定步骤、方法、工具、文件和验收标准。',
    '3. 不涉及具体细节。我没写的细节不要补，也不要猜项目里有什么。',
    '4. 下面有「我的话」时，主要是把我的话整理清楚：保留全部意思和要求，理顺顺序，去掉重复和口误，不增加新的要求。',
    '5. 只有任务名、没有我的话时，写成一个根本性的提问或方向：让 Claude 先弄清问题本身，从第一性原理出发，可以质疑现有的做法。',
    '',
    '我觉得好的提示词（只参照风格，不要照抄）：',
    ...PROMPT_STYLE_EXAMPLES.map((x) => `- ${x}`),
    '',
    '写法：用我的口吻写；中文；不用破折号和连字符连接句子；不用比喻；不写客套话；不加标题、列表符号和解释；只输出提示词本身。',
    ...(context.length ? ['', ...context] : []),
    ...(words ? ['', '我的话：', words] : []),
  ].join('\n')
}

/** 任务关联的笔记最多取这么多条（按日期从早到晚，取最近的）。 */
const TODO_NOTES_MAX = 12
/** 任务备注与笔记合计的字数上限，超出的部分截断。 */
const TODO_WORDS_MAX = 4000

/**
 * 任务上用户自己的话：任务备注，加上关联到这个任务的笔记（连同子条目），按日期从早到晚。
 * 笔记只取最近的 TODO_NOTES_MAX 条。没有备注也没有笔记时为空串。
 */
export function todoWords(todo: Todo, notes: NoteEntry[]): string {
  const roots = notes
    .filter((n) => n.todoId === todo.id && n.text.trim() !== '')
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .slice(-TODO_NOTES_MAX)
  const parts = [todo.notes?.trim() ?? '', ...roots.map((n) => outlineText(subtree(notes, n.id)))].filter(Boolean)
  const text = parts.join('\n')
  return text.length > TODO_WORDS_MAX ? text.slice(0, TODO_WORDS_MAX) : text
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
