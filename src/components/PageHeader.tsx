import type { ComponentType, ReactNode } from 'react'

interface Props {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>
  /** 图标颜色类，与侧栏同一分区的图标一致。 */
  tint: string
  title: string
  /** 标题下一行，与标题文字左缘对齐。 */
  subtitle?: ReactNode
  /** 标题行右侧的控件，与标题底边对齐。 */
  actions?: ReactNode
}

/** 四个页面共用的标题行：图标、标题、副标题，右侧放本页控件。 */
export function PageHeader({ icon: Icon, tint, title, subtitle, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-title font-bold tracking-[-0.01em]">
          <Icon size={26} strokeWidth={2.2} className={tint} aria-hidden />
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-sm text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1">{actions}</div> : null}
    </header>
  )
}
