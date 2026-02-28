import { Moon, Sun } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { motion } from 'framer-motion'

interface ThemeToggleProps {
  defaultTheme?: 'light' | 'dark'
}

export function ThemeToggle({ defaultTheme }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme({ defaultTheme })

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative overflow-hidden"
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 180 : 0,
          scale: isDark ? 0 : 1,
          opacity: isDark ? 0 : 1
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute"
      >
        <Sun size={20} weight="duotone" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 0 : -180,
          scale: isDark ? 1 : 0,
          opacity: isDark ? 1 : 0
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute"
      >
        <Moon size={20} weight="duotone" />
      </motion.div>
    </Button>
  )
}
