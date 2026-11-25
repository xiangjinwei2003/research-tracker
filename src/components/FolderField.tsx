import { useEffect, useState } from 'react'
import { Input } from './ui/Input'
import { getDesktop } from '@/platform/desktop'
import { listProjectFolders } from '@/platform/folders'

interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  className?: string
}

/**
 * 项目目录的绝对路径。桌面版从 ~/Documents/Projects 列出子目录作为候选，也可以直接输入。
 * 候选列表读不到时只少了候选，输入照常可用。
 */
export function FolderField({ id, value, onChange, invalid, className }: Props) {
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    if (!getDesktop()) return
    let alive = true
    listProjectFolders().then(
      (list) => {
        if (alive) setOptions(list)
      },
      (err) => console.warn('[research-tracker] 读取 ~/Documents/Projects 失败，目录候选为空。', err),
    )
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={options.length ? `${id}-options` : undefined}
        placeholder="/Users/你的用户名/Documents/Projects/项目目录"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={className}
      />
      {options.length ? (
        <datalist id={`${id}-options`}>
          {options.map((path) => (
            <option key={path} value={path} />
          ))}
        </datalist>
      ) : null}
    </>
  )
}
