import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}

/**
 * 页面内的确认框。Artifact 里 confirm() 不弹窗并直接返回 false，
 * 网页版与桌面版都用这个组件。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="md">
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          autoFocus
          onClick={() => {
            onOpenChange(false)
            onConfirm()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
