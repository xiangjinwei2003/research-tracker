import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLAUDE_PROMPT_MAX, claudeCodeNewUrl, folderName, isAbsoluteFolder } from './claudeLink.ts'
import {
  buildPolishInput,
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

test('AI 整理的输入：有什么上下文写什么，最后是笔记', () => {
  const full = buildPolishInput({
    note: '把实验记录整理成表',
    projectTitle: 'proj-a',
    folder: '/Users/me/proj-a',
    todoTitle: '写方法部分',
    todoDue: '2026-11-30',
    todoNotes: '  先写参与者  ',
  })
  assert.match(full, /项目：proj-a/)
  assert.match(full, /工作目录：\/Users\/me\/proj-a/)
  assert.match(full, /相关任务：写方法部分（截止 11月30日）/)
  assert.match(full, /任务备注：先写参与者\n/)
  assert.ok(full.endsWith('笔记：\n把实验记录整理成表'))
  assert.match(full, /不增加笔记里没有的需求/)
  const bare = buildPolishInput({ note: '随手一记' })
  assert.doesNotMatch(bare, /项目：|工作目录：|相关任务：/)
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
