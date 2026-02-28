import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bell, CheckCircle, XCircle, Envelope, WhatsappLogo } from '@phosphor-icons/react'
import type { SystemConfig } from '@/lib/types'

interface ReminderStatusIndicatorProps {
  config: SystemConfig
}

export function ReminderStatusIndicator({ config }: ReminderStatusIndicatorProps) {
  const reminderEnabled = config.reminderSettings?.enabled !== false
  const emailEnabled = config.emailSettings?.enabled !== false
  const whatsappEnabled = config.whatsappSettings?.enabled !== false
  const hasAnyChannelEnabled = emailEnabled || whatsappEnabled

  const isFullyActive = reminderEnabled && hasAnyChannelEnabled

  if (!isFullyActive) return null

  const hoursBeforeReminder = config.reminderSettings?.hoursBeforeAppointment || 24
  const activeChannelCount = [emailEnabled, whatsappEnabled].filter(Boolean).length

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-900 border-2 border-green-400 cursor-help animate-pulse hover:animate-none gap-2 px-4 py-2 shadow-lg hover:shadow-xl transition-all"
          >
            <Bell size={18} weight="fill" className="text-green-600" />
            <span className="font-bold">Lembretes Ativos ({activeChannelCount} canais)</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-4 bg-white border-2 border-green-200" style={{ color: '#111827' }}>
          <div className="space-y-3">
            <p className="font-bold text-base flex items-center gap-2" style={{ color: '#166534' }}>
              <CheckCircle size={20} weight="fill" className="text-green-500" />
              Sistema de Lembretes Ativo
            </p>
            <p className="text-sm" style={{ color: '#374151' }}>
              Enviando notificações <strong>{hoursBeforeReminder}h antes</strong> do agendamento
            </p>
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <p className="text-xs font-semibold" style={{ color: '#4B5563' }}>Canais Ativos:</p>
              <div className="space-y-2">
                {emailEnabled && (
                  <div className="flex items-center gap-2 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <Envelope size={18} weight="duotone" className="text-green-600" />
                    <span className="font-medium" style={{ color: '#166534' }}>Email</span>
                  </div>
                )}
                {whatsappEnabled && (
                  <div className="flex items-center gap-2 text-sm bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                    <WhatsappLogo size={18} weight="duotone" className="text-emerald-600" />
                    <span className="font-medium" style={{ color: '#065f46' }}>WhatsApp</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs pt-2 border-t border-gray-200 italic" style={{ color: '#6B7280' }}>
              💡 Lembretes são enviados automaticamente para agendamentos confirmados
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
