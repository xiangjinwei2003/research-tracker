import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  /** 卡片左上角的小标题。 */
  title: string
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  /** 小标题的颜色类，例如 text-success。 */
  tint?: string
  /** 小标题右侧的附加内容。 */
  aside?: ReactNode
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/**
 * 回顾页的卡片，参照 iOS 小组件：大圆角、无边框、比画布略亮的底色，
 * 左上角是带颜色的小标题，主体是一个数字或一张小图。
 */
export function Widget({
  title,
  icon: Icon,
  tint = 'text-muted-foreground',
  aside,
  className,
  children,
  ...rest
}: Props) {
  return (
    <section
      aria-label={rest['aria-label'] ?? title}
      className={cn(
        'flex min-w-0 flex-col rounded-[22px] bg-widget p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.045)] sm:p-5',
        className,
      )}
    >
      <header className="flex min-h-5 items-center gap-1.5">
        {Icon ? <Icon size={14} strokeWidth={2.4} className={tint} /> : null}
        <h2 className={cn('text-[13px] font-semibold', tint)}>{title}</h2>
        {aside ? <div className="ml-auto flex items-center">{aside}</div> : null}
      </header>
      {children}
    </section>
  )
}

/** 小组件主体的大号数字，单位用小一号的字。 */
export function WidgetNumber({
  value,
  unit,
  className,
}: {
  value: ReactNode
  unit?: string
  className?: string
}) {
  return (
    <p className={cn('num-rounded text-[34px] font-semibold leading-none tracking-[-0.02em]', className)}>
      {value}
      {unit ? (
        <span className="ml-1 text-[15px] font-medium tracking-normal text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </p>
  )
}
