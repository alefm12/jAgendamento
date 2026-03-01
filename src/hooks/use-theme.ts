import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'

type Theme = 'light' | 'dark'

interface UseThemeOptions {
  defaultTheme?: Theme
}

// Detecta preferência de cor do sistema operacional
const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function useTheme(options?: UseThemeOptions) {
  const defaultTheme = options?.defaultTheme ?? getSystemTheme()
  const [theme, setTheme] = useKV<Theme>('app-theme', defaultTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme) {
      root.classList.add(theme)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark'
  }
}
