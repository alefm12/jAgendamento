export const setupResizeObserverErrorSuppression = () => {
  if (typeof window === 'undefined') return

  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }

  const OriginalResizeObserver = window.ResizeObserver

  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      const debouncedCallback = debounce((entries: ResizeObserverEntry[], observer: ResizeObserver) => {
        requestAnimationFrame(() => {
          try {
            callback(entries, observer)
          } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('ResizeObserver')) {
              throw error
            }
          }
        })
      }, 16)

      super(debouncedCallback)
    }
  }

  const errorHandler = (event: ErrorEvent) => {
    if (
      event.message?.includes('ResizeObserver') ||
      event.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      event.message === 'ResizeObserver loop limit exceeded'
    ) {
      event.stopImmediatePropagation()
      event.preventDefault()
      return true
    }
    return false
  }

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    if (event.reason?.message?.includes('ResizeObserver')) {
      event.preventDefault()
      return true
    }
    return false
  }

  window.addEventListener('error', errorHandler, true)
  window.addEventListener('unhandledrejection', rejectionHandler, true)

  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || ''
    if (
      errorMessage.includes('ResizeObserver') ||
      errorMessage.includes('loop completed with undelivered notifications') ||
      errorMessage.includes('loop limit exceeded')
    ) {
      return
    }
    originalConsoleError.apply(console, args)
  }

  return () => {
    window.ResizeObserver = OriginalResizeObserver
    window.removeEventListener('error', errorHandler, true)
    window.removeEventListener('unhandledrejection', rejectionHandler, true)
    console.error = originalConsoleError
  }
}
