import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Warning, Trash } from '@phosphor-icons/react'

// ── Componente visual ──────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = 'Confirmar ação',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const iconColor =
    variant === 'danger' ? 'text-red-500' :
    variant === 'warning' ? 'text-yellow-500' : 'text-primary'

  const confirmClass =
    variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' :
    variant === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {variant === 'danger'
              ? <Trash size={20} weight="duotone" className={iconColor} />
              : <Warning size={20} weight="duotone" className={iconColor} />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Hook para uso imperativo (substitui window.confirm) ────────────────────────
interface ConfirmOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    description: '',
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }, [state])

  const ConfirmDialogNode = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, ConfirmDialogNode }
}
