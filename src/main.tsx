import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import MultiTenantApp from './AppMultiTenant.tsx'
import PrintReportPage from './components/PrintReportPage.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { setupResizeObserverErrorSuppression } from './lib/resize-observer-polyfill'
import { setupLocalSpark } from './lib/local-spark'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

setupResizeObserverErrorSuppression()
setupLocalSpark()

const suppressResizeObserverError = (event: ErrorEvent) => {
  if (
    event.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    event.message === 'ResizeObserver loop limit exceeded'
  ) {
    event.stopImmediatePropagation()
    event.preventDefault()
  }
}

window.addEventListener('error', suppressResizeObserverError)

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

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    {window.location.pathname === '/print/report'
      ? <PrintReportPage />
      : <MultiTenantApp />}
   </ErrorBoundary>
)
