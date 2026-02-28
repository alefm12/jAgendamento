import { useEffect, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { IconProps } from '@phosphor-icons/react'
import { Bell, EnvelopeSimple, CalendarX, XCircle, ArrowClockwise } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Appointment, AuditLog, ReportExecutionLog } from '@/lib/types'
import { getAuditLogs } from '@/lib/audit-logger'
import { getReportExecutionLogs } from '@/lib/report-logger'
import { toFirstAndSecondName } from '@/lib/name-utils'

type AdminNotificationType =
  | 'agenda-capacity'
  | 'operational'
  | 'security'
  | 'system-integration'

interface AdminNotification {
  id: string
  type: AdminNotificationType
  title: string
  description: string
  timestamp: string
  details?: string[]
}

interface NotificationViewerProps {
  appointments?: Appointment[]
}

type IconComponent = (props: IconProps) => JSX.Element

const TYPE_CONFIG: Record<AdminNotificationType, {
  label: string
  icon: IconComponent
  badgeClass: string
  indicatorClass: string
}> = {
  'agenda-capacity': {
    label: 'Agenda e Capacidade',
    icon: CalendarX,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    indicatorClass: 'bg-indigo-100 text-indigo-600'
  },
  'operational': {
    label: 'Operacional',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    indicatorClass: 'bg-rose-100 text-rose-600'
  },
  'security': {
    label: 'Segurança',
    icon: Bell,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    indicatorClass: 'bg-amber-100 text-amber-700'
  },
  'system-integration': {
    label: 'Sistema e Integração',
    icon: EnvelopeSimple,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    indicatorClass: 'bg-blue-100 text-blue-600'
  }
}

export function NotificationViewer({ appointments = [] }: NotificationViewerProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const isMounted = useRef(true)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    const [auditLogs, reportLogs] = await Promise.all([
      fetchAuditLogs(),
      fetchReportLogs()
    ])

    if (!isMounted.current) {
      return
    }

    const mappedNotifications = sortNotifications([
      ...mapAuditLogsToNotifications(auditLogs),
      ...mapReportLogsToNotifications(reportLogs)
    ])

    setNotifications(mappedNotifications)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
    return () => {
      isMounted.current = false
    }
  }, [fetchNotifications])

  useEffect(() => {
    const handleAuditLogCreated = (event: Event) => {
      const log = (event as CustomEvent<AuditLog>).detail
      if (!log) return
      const mapped = mapAuditLogsToNotifications([log])
      if (!mapped.length) return
      setNotifications(prev => mergeNotifications(prev, mapped))
    }

    const handleReportLogged = (event: Event) => {
      const log = (event as CustomEvent<ReportExecutionLog>).detail
      if (!log) return
      const mapped = mapReportLogsToNotifications([log])
      if (!mapped.length) return
      setNotifications(prev => mergeNotifications(prev, mapped))
    }

    window.addEventListener('audit-log-created', handleAuditLogCreated as EventListener)
    window.addEventListener('report-execution-logged', handleReportLogged as EventListener)

    return () => {
      window.removeEventListener('audit-log-created', handleAuditLogCreated as EventListener)
      window.removeEventListener('report-execution-logged', handleReportLogged as EventListener)
    }
  }, [])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bell size={18} />
          Notificações
          {notifications.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {notifications.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell size={24} className="text-primary" />
            Notificações Administrativas
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando notificações...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="mx-auto text-muted-foreground mb-4" size={64} weight="thin" />
              <p className="text-muted-foreground">Nenhuma notificação relevante ainda</p>
              <p className="text-xs text-muted-foreground mt-2">
                Apenas relatórios enviados por email, bloqueios de datas e cancelamentos aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type]
                const Icon = config.icon
                return (
                  <Card key={notification.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${config.indicatorClass}`}>
                        <Icon size={22} weight="duotone" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground text-sm sm:text-base">{notification.title}</h4>
                            <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                              {config.label}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(notification.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.description}</p>
                        {notification.details && notification.details.length > 0 && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            {notification.details.map(detail => (
                              <p key={detail}>{detail}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
        <div className="flex flex-wrap justify-between gap-2 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="gap-2"
          >
            <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotifications([])}
            disabled={notifications.length === 0}
          >
            Limpar visualização
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    return await getAuditLogs()
  } catch (error) {
    console.error('Erro ao carregar logs de auditoria:', error)
    return []
  }
}

async function fetchReportLogs(): Promise<ReportExecutionLog[]> {
  try {
    return await getReportExecutionLogs()
  } catch (error) {
    console.error('Erro ao carregar logs de relatórios:', error)
    return []
  }
}

function mapAuditLogsToNotifications(logs: AuditLog[]): AdminNotification[] {
  return logs.flatMap((log) => {
    const actionKey = String(log.action || '').toLowerCase()

    if (log.action === 'blocked_date_created') {
      return [{
        id: `blocked-${log.id}`,
        type: 'security',
        title: 'Bloqueio de data registrado',
        description: log.description,
        timestamp: log.performedAt,
        details: filterDetails([
          `Responsável: ${toFirstAndSecondName(log.performedBy)}`,
          log.metadata?.blockType
            ? `Tipo: ${log.metadata.blockType === 'full-day' ? 'Dia inteiro' : 'Horários específicos'}`
            : undefined,
          log.metadata?.reason ? `Motivo: ${log.metadata.reason}` : undefined
        ])
      }]
    }

    if (
      log.action === 'appointment_cancelled' ||
      (log.action === 'appointment_status_changed' && log.changes?.status?.to === 'cancelled')
    ) {
      return [{
        id: `cancel-${log.id}`,
        type: 'operational',
        title: 'Agendamento cancelado',
        description: log.description,
        timestamp: log.performedAt,
        details: filterDetails([
          log.metadata?.protocol ? `Protocolo: ${log.metadata.protocol}` : undefined,
          log.metadata?.reason ? `Motivo: ${log.metadata.reason}` : undefined,
          `Responsável: ${toFirstAndSecondName(log.performedBy)}`
        ])
      }]
    }

    if (actionKey === 'login_failed') {
      return [{
        id: `security-login-failed-${log.id}`,
        type: 'security',
        title: 'Tentativas de login falhas detectadas',
        description: log.description,
        timestamp: log.performedAt,
        details: filterDetails([
          log.metadata?.username ? `Usuário: ${log.metadata.username}` : undefined,
          log.ipAddress ? `IP: ${log.ipAddress}` : undefined
        ])
      }]
    }

    if (log.action === 'location_updated' && /desativ|inativ/i.test(log.description || '')) {
      return [{
        id: `location-disabled-${log.id}`,
        type: 'security',
        title: 'Mudança estrutural em localidade',
        description: log.description,
        timestamp: log.performedAt,
        details: filterDetails([
          log.targetName ? `Localidade: ${log.targetName}` : undefined,
          `Responsável: ${toFirstAndSecondName(log.performedBy)}`
        ])
      }]
    }

    return []
  })
}

function mapReportLogsToNotifications(logs: ReportExecutionLog[]): AdminNotification[] {
  return logs.flatMap((log) => {
    const entries: AdminNotification[] = []

    if (log.deliveryMethod === 'email' || log.deliveryMethod === 'both' || (log.emailsSent || 0) > 0) {
      const recipientSummary = summarizeRecipients(log.recipients?.map((recipient) => recipient.email || '') || [])
      entries.push({
        id: `report-${log.id}`,
        type: 'system-integration',
        title: 'Relatório enviado por email',
        description: log.reportName,
        timestamp: log.executedAt,
        details: filterDetails([
          `Status: ${translateStatus(log.status)}`,
          log.emailsSent ? `Emails enviados: ${log.emailsSent}` : undefined,
          recipientSummary ? `Destinatários: ${recipientSummary}` : undefined
        ])
      })
    }

    if (log.status === 'failed' || log.status === 'partial') {
      entries.push({
        id: `communication-failure-${log.id}`,
        type: 'system-integration',
        title: 'Falha de comunicação com cidadãos',
        description: log.error || 'Falha ao enviar notificações automáticas para cidadãos.',
        timestamp: log.executedAt,
        details: filterDetails([
          log.emailsFailed ? `Falhas de envio: ${log.emailsFailed}` : undefined,
          log.errorDetails ? `Detalhe: ${log.errorDetails}` : undefined
        ])
      })
    }

    if (/smtp|credencia|email/i.test(`${log.error || ''} ${log.errorDetails || ''}`)) {
      entries.push({
        id: `smtp-failure-${log.id}`,
        type: 'system-integration',
        title: 'Erro de e-mail (SMTP)',
        description: 'As credenciais do servidor SMTP falharam. As notificações automáticas não estão sendo enviadas.',
        timestamp: log.executedAt,
        details: filterDetails([
          log.error ? `Erro: ${log.error}` : undefined
        ])
      })
    }

    return entries
    })
}

function translateStatus(status: ReportExecutionLog['status']): string {
  switch (status) {
    case 'success':
      return 'Sucesso'
    case 'failed':
      return 'Falhou'
    case 'partial':
      return 'Parcial'
    case 'cancelled':
    default:
      return 'Cancelado'
  }
}

function summarizeRecipients(emails: string[]): string | undefined {
  const filtered = emails.filter(Boolean)
  if (!filtered.length) return undefined
  if (filtered.length <= 3) return filtered.join(', ')
  return `${filtered.slice(0, 3).join(', ')} +${filtered.length - 3}`
}

function filterDetails(details: Array<string | undefined>): string[] {
  return details.filter((detail): detail is string => Boolean(detail))
}

function sortNotifications(items: AdminNotification[]): AdminNotification[] {
  return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function mergeNotifications(existing: AdminNotification[], incoming: AdminNotification[]): AdminNotification[] {
  if (!incoming.length) return existing
  const map = new Map<string, AdminNotification>()
  incoming.forEach(item => map.set(item.id, item))
  existing.forEach(item => {
    if (!map.has(item.id)) {
      map.set(item.id, item)
    }
  })
  return sortNotifications(Array.from(map.values()))
}
