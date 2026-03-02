import { useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'jagendamento-ui-theme-v2'

// Limpa chaves antigas que podem ter 'dark' salvo de versões anteriores
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('jagendamento-theme')
    localStorage.removeItem('jagendamento-ui-theme')
  } catch { /* ignorar */ }
}

/** Lê o tema salvo no localStorage — NÃO usa preferência do SO para não conflitar com o toggle do app */
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // localStorage pode estar bloqueado em alguns contextos
  }
  return 'light'
}

/** Aplica imediatamente a classe `dark` no <html> E no <body> (para React Portals do Radix),
 *  color-scheme e a meta tag (iOS Safari). */
function applyThemeToDOM(t: Theme) {
  const isDark = t === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  // Portais Radix (Dialog, Select, Popover, Sheet…) são filhos diretos de <body>.
  // Aplicar a classe e color-scheme no body garante herança correta no iOS Safari.
  if (document.body) {
    document.body.classList.toggle('dark', isDark)
    document.body.style.colorScheme = isDark ? 'dark' : 'light'
  }
  const meta = document.getElementById('meta-color-scheme')
  if (meta) meta.setAttribute('content', isDark ? 'dark' : 'light')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  // Sincroniza o DOM sempre que o estado muda
  useEffect(() => {
    applyThemeToDOM(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch { /* ignorar */ }
  }, [theme])

  // Sincroniza quando outra aba / componente muda o localStorage
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' }
}
