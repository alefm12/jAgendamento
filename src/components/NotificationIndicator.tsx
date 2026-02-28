import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Envelope, CheckCircle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface NotificationToast {
  id: string
  type: 'email' | 'both'
  recipient: string
}

export function NotificationIndicator() {
  const [activeNotifications, setActiveNotifications] = useState<NotificationToast[]>([])

  useEffect(() => {
    const handleNotificationSent = (event: CustomEvent) => {
      const log = event.detail
      const notification: NotificationToast = {
        id: log.id,
        type: log.type,
        recipient: log.recipientEmail || log.recipientPhone
      }

      setActiveNotifications(prev => [...prev, notification])

      setTimeout(() => {
        setActiveNotifications(prev => prev.filter(n => n.id !== notification.id))
      }, 3000)
    }

    window.addEventListener('notification-sent' as any, handleNotificationSent)
    return () => window.removeEventListener('notification-sent' as any, handleNotificationSent)
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {activeNotifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 shadow-lg bg-card border-accent/50 pointer-events-auto min-w-[300px]">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
                  {notification.type === 'email' && (
                    <Envelope size={20} className="text-accent" weight="fill" />
                  )}
                  {notification.type === 'both' && (
                    <CheckCircle size={20} className="text-accent" weight="fill" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {notification.type === 'email' && 'Email enviado'}
                    {notification.type === 'both' && 'Notificações enviadas'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {notification.recipient}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
