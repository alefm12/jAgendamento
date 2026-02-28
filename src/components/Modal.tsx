import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from '@phosphor-icons/react'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = () => {
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={handleOverlayClick} aria-hidden="true" />
      <div className="modal-shell relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          className="modal-close-btn absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center text-red-600 transition hover:text-red-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          <X weight="bold" className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
