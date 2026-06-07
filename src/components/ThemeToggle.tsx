import { Sun, Moon, Monitor, Check } from 'lucide-react'
import type { ComponentType } from 'react'
import { useTheme, setTheme, resolveTheme, type Theme } from '@/lib/theme'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/DropdownMenu'

const OPTIONS: { value: Theme; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

export function ThemeToggle() {
  const theme = useTheme()
  const Resolved = resolveTheme(theme) === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        aria-label="切换主题"
        title="切换主题"
      >
        <Resolved size={17} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon size={15} />
            <span className="flex-1">{label}</span>
            {theme === value ? <Check size={15} className="text-brand-600 dark:text-brand-400" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
