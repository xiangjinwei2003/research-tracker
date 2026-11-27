import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLAUDE_PROMPT_MAX, claudeCodeNewUrl, folderName, isAbsoluteFolder } from './claudeLink.ts'
import {
  buildPromptInput,
  PROMPT_STYLE_EXAMPLES,
  todoWords,
  outlineText,
  sampleErrorMessage,
  taskFileContent,
  taskFilePrompt,
  taskFileTitle,
} from './promptDraft.ts'
import type { NoteEntry } from './types.ts'

test('深链接：桌面应用按 URL 解析后得到原样的提示词和目录', () => {
  const prompt = '整理 proj-a 的实验记录 & 写 Method #1\n第二行：a+b=c，100% 完成'
  const folder = '/Users/me/Documents/Projects/todo web'
  const url = claudeCodeNewUrl({ prompt, folder })
  const parsed = new URL(url)
  assert.equal(parsed.protocol, 'claude:')
  assert.equal(parsed.host, 'code')
  assert.equal(parsed.pathname, '/new')
  assert.equal(parsed.searchParams.get('q'), prompt)
  assert.deepEqual(parsed.searchParams.getAll('folder'), [folder])
  assert.equal(new URL(claudeCodeNewUrl({ prompt: 'x' })).searchParams.has('folder'), false)
})

test('深链接：超过 14336 个字符或目录不是绝对路径时报错', () => {
  assert.equal(CLAUDE_PROMPT_MAX, 14336)
  assert.doesNotThrow(() => claudeCodeNewUrl({ prompt: '字'.repeat(CLAUDE_PROMPT_MAX) }))
  assert.throws(() => claudeCodeNewUrl({ prompt: '字'.repeat(CLAUDE_PROMPT_MAX + 1) }), /超过 14336/)
  assert.throws(() => claudeCodeNewUrl({ prompt: 'x', folder: '~/Documents' }), /绝对路径/)
  assert.throws(() => claudeCodeNewUrl({ prompt: 'x', folder: 'Projects/proj-a' }), /绝对路径/)
})

test('绝对路径判断与目录名', () => {
  assert.equal(isAbsoluteFolder('/Users/me'), true)
  assert.equal(isAbsoluteFolder('C:\\Users\\me'), true)
  assert.equal(isAbsoluteFolder('~/Documents'), false)
  assert.equal(isAbsoluteFolder('proj-a'), false)
  assert.equal(folderName('/Users/me/Documents/Projects/todo web/'), 'todo web')
  assert.equal(folderName('C:\\work\\proj-a'), 'proj-a')
})

const note = (text: string, level = 0): NoteEntry => ({
  id: text,
  date: '2026-11-25',
  text,
  level,
  createdAt: '',
  updatedAt: '',
})

test('草稿：子条目按相对缩进排列，每级两个空格，不加列表符号，空条目跳过', () => {
  assert.equal(outlineText([note('只有一条')]), '只有一条')
  assert.equal(
    outlineText([note('改首页', 1), note('顶部放下一件事', 2), note('', 2), note('第二行\n续写', 3)]),
    '改首页\n  顶部放下一件事\n    第二行\n    续写',
  )
  assert.equal(outlineText([]), '')
})

test('写提示词的输入：用户的要求与风格参照在前，有什么材料写什么，最后是用户的话', () => {
  const full = buildPromptInput({
    words: '  把实验记录整理成表  ',
    projectTitle: 'proj-a',
    todoTitle: '写方法部分',
    todoDue: '2026-11-30',
  })
  assert.match(full, /不限制 Claude 的发挥/)
  assert.match(full, /不涉及具体细节/)
  for (const example of PROMPT_STYLE_EXAMPLES) assert.ok(full.includes(`- ${example}`))
  assert.match(full, /项目：proj-a\n任务：写方法部分（截止 11月30日）/)
  assert.ok(full.endsWith('我的话：\n把实验记录整理成表'))
  const bare = buildPromptInput({ words: ' ', todoTitle: '读一篇相关论文' })
  assert.doesNotMatch(bare, /项目：|我的话：/)
  assert.ok(bare.endsWith('任务：读一篇相关论文'))
})

test('任务上用户自己的话：备注在前，关联这个任务的笔记连同子条目按日期从早到晚，只取最近 12 条', () => {
  const todo = { id: 't1', title: '写方法部分', endDate: '', done: false, stage: 'literature', notes: ' 先写参与者 ' }
  const linked = (id: string, date: string, text: string, extra: Partial<NoteEntry> = {}): NoteEntry => ({
    id,
    date,
    text,
    level: 0,
    createdAt: `${date}T09:00:00.000Z`,
    updatedAt: '',
    projectId: 'p1',
    todoId: 't1',
    ...extra,
  })
  const notes: NoteEntry[] = [
    linked('b', '2026-11-25', '第二天的想法'),
    { ...linked('b1', '2026-11-25', '子条目'), level: 1, todoId: undefined, projectId: undefined },
    linked('a', '2026-11-24', '第一天的想法'),
    linked('x', '2026-11-24', '别的任务', { todoId: 't2' }),
    linked('e', '2026-11-26', '   '),
  ]
  assert.equal(todoWords(todo, notes), '先写参与者\n第一天的想法\n第二天的想法\n  子条目')
  assert.equal(todoWords({ ...todo, notes: undefined }, []), '')
  const many = Array.from({ length: 15 }, (_, i) => linked(`n${i}`, `2026-11-${String(i + 1).padStart(2, '0')}`, `第 ${i + 1} 条`))
  const words = todoWords({ ...todo, notes: undefined }, many).split('\n')
  assert.equal(words.length, 12)
  assert.equal(words[0], '第 4 条')
})

test('任务文件：标题取第一行、去掉列表符号与文件名不允许的字符，内容带改动记录', () => {
  assert.equal(taskFileTitle('\n\n1. 修复：首页/日历的拖拽问题\n细节'), '修复：首页 日历的拖拽问题')
  assert.equal(taskFileTitle('一'.repeat(40)).length, 24)
  assert.equal(taskFileTitle('   \n  '), '笔记任务')
  const content = taskFileContent({
    title: '修复拖拽',
    prompt: '把日历的拖拽改好\n',
    noteDate: '2026-11-25',
    createdOn: new Date(2026, 10, 25, 9),
  })
  assert.equal(
    content,
    '# 修复拖拽\n\n## 改动记录\n\n1. 2026年11月25日。由 Research Tracker 从 11月25日的笔记生成，并发送到 Claude Code。\n\n## 任务\n\n把日历的拖拽改好\n',
  )
  assert.equal(taskFilePrompt('docs/tasks/2026-11-25_修复拖拽.md'), '读取并执行 docs/tasks/2026-11-25_修复拖拽.md，按其中的要求完成任务。')
})

test('sample 失败的说明：用量上限单独说明；未授权与账号不可用时隐藏按钮', () => {
  assert.deepEqual(sampleErrorMessage('rate_limited', 'usage_limit'), {
    message: '已达到 Claude 套餐的用量上限，稍后再试',
    hide: false,
  })
  assert.equal(sampleErrorMessage('rate_limited').message, '请求太频繁，稍后再试')
  assert.equal(sampleErrorMessage('not_granted').hide, true)
  assert.equal(sampleErrorMessage('sampling_disabled').hide, true)
  assert.equal(sampleErrorMessage('upstream_error').hide, false)
  assert.equal(sampleErrorMessage(undefined).message, '连接 Claude 失败，可以再试一次')
})
