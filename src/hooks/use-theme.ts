// Dark mode removido — sistema sempre em modo claro
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('jagendamento-theme')
    localStorage.removeItem('jagendamento-ui-theme')
    localStorage.removeItem('jagendamento-ui-theme-v2')
    localStorage.removeItem('jagendamento-ui-theme-v3')
  } catch { /* ignorar */ }
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
  if (document.body) {
    document.body.classList.remove('dark')
    document.body.style.colorScheme = 'light'
  }
}

export function useTheme(_options?: unknown) {
  return {
    theme: 'light' as const,
    setTheme: (_t: string) => {},
    toggleTheme: () => {},
    isDark: false
  }
}
