import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Keyboard } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface KeyboardShortcutsHelpProps {
  shortcuts: Array<{
    keys: string[]
    description: string
  }>
}

export function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Keyboard size={24} weight="duotone" className="text-primary" />
          Atalhos de Teclado
        </CardTitle>
        <CardDescription>
          Use estes atalhos para navegar mais rápido
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={keyIndex} className="flex items-center">
                    <Badge 
                      variant="secondary" 
                      className="font-mono text-xs px-2 py-1 bg-background border border-border shadow-sm"
                    >
                      {key}
                    </Badge>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="mx-1 text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
