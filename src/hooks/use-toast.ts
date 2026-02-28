import { toast as sonnerToast } from 'sonner'

export type ToastVariant = 'default' | 'destructive'

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
}

export function useToast() {
  const toast = ({ title, description, variant = 'default' }: ToastOptions) => {
    const message = description || title || 'Ação concluída'
    if (variant === 'destructive') {
      sonnerToast.error(message)
      return
    }
    sonnerToast.success(message)
  }

  return { toast }
}
