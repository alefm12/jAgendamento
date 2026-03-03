import { useState, useEffect } from 'react'

const THEME_KEY = 'jagendamento-ui-theme-v3'

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}

interface UseThemeOptions {
  defaultTheme?: 'light' | 'dark'
}

export function useTheme(options?: UseThemeOptions) {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return options?.defaultTheme ?? 'light'
    try {
      const stored = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null
      if (stored === 'light' || stored === 'dark') return stored
    } catch { /* ignorar */ }
    return options?.defaultTheme ?? 'light'
  })

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignorar */ }
  }, [theme])

  const setTheme = (t: string) => {
    if (t === 'light' || t === 'dark') setThemeState(t)
  }

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark'
  }
}
