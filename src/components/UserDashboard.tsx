import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { CancelAppointmentDialog } from '@/components/CancelAppointmentDialog'
import { ScrollProgressIndicator } from '@/components/ScrollProgressIndicator'
import { 
  CalendarBlank, 
  Clock, 
  IdentificationCard,
  Phone,
  EnvelopeSimple,
  CheckCircle,
  XCircle,
  ClockClockwise
} from '@phosphor-icons/react'
import { format, parseISO, isPast, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'
import type { Appointment } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UserDashboardProps {
  userCPF: string
  appointments: Appointment[]
  onCancelAppointment: (appointmentId: string, reason: string) => void
}

const statusConfig = {
  pending: { 
    label: 'Pendente', 
    color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    icon: ClockClockwise
  },
  confirmed: { 
    label: 'Confirmado', 
    color: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    icon: CheckCircle
  },
  completed: { 
    label: 'Concluído', 
    color: 'bg-accent/10 text-accent border-accent/20',
    icon: CheckCircle
  },
  cancelled: { 
    label: 'Cancelado', 
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: XCircle
  }
}

export function UserDashboard({ userCPF, appointments, onCancelAppointment }: UserDashboardProps) {
  const userAppointments = useMemo(() => {
    return appointments
      .filter(apt => apt.cpf === userCPF)
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date)
        if (dateCompare !== 0) return dateCompare
        return b.time.localeCompare(a.time)
      })
  }, [appointments, userCPF])

  const upcomingAppointments = useMemo(() => {
    return userAppointments.filter(apt => {
      const aptDate = parseISO(apt.date)
      return isFuture(aptDate) && (apt.status === 'pending' || apt.status === 'confirmed')
    })
  }, [userAppointments])

  const pastAppointments = useMemo(() => {
    return userAppointments.filter(apt => {
      const aptDate = parseISO(apt.date)
      return isPast(aptDate) || apt.status === 'completed' || apt.status === 'cancelled'
    })
  }, [userAppointments])

  if (userAppointments.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <IdentificationCard size={28} className="text-primary" weight="duotone" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">Meus Agendamentos</h2>
            <p className="text-sm text-muted-foreground">
              Total de {userAppointments.length} agendamento(s)
            </p>
          </div>
        </div>

        {upcomingAppointments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Próximos</h3>
            <div className="space-y-3">
              {upcomingAppointments.map(apt => {
                const StatusIcon = statusConfig[apt.status].icon
                return (
                  <Card key={apt.id} className="p-4 bg-muted/30">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={cn('border', statusConfig[apt.status].color)}>
                            <StatusIcon size={12} className="mr-1" weight="fill" />
                            {statusConfig[apt.status].label}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">
                            {apt.protocol}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <CalendarBlank size={16} className="text-primary" />
                            <span className="font-medium">
                              {format(parseISO(apt.date), "dd/MM/yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={16} className="text-primary" />
                            <span className="font-medium">{apt.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {pastAppointments.length > 0 && (
          <div>
            <Separator className="my-4" />
            <h3 className="text-sm font-semibold text-foreground mb-3">Histórico</h3>
            <div className="relative">
              <ScrollArea className="h-[200px]" data-scroll-container>
                <div className="space-y-2 pr-4">
                  {pastAppointments.map(apt => {
                  const StatusIcon = statusConfig[apt.status].icon
                  return (
                    <Card key={apt.id} className="p-3 bg-background">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {apt.protocol}
                            </span>
                            <Badge variant="outline" className={cn('text-xs', statusConfig[apt.status].color)}>
                              <StatusIcon size={10} className="mr-1" weight="fill" />
                              {statusConfig[apt.status].label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{format(parseISO(apt.date), "dd/MM/yyyy")}</span>
                            <span>•</span>
                            <span>{apt.time}</span>
                          </div>
                        </div>
                      </div>
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <div className="mt-3 pt-3 border-t">
                          <CancelAppointmentDialog
                            appointment={apt}
                            onCancel={onCancelAppointment}
                          />
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
            <ScrollProgressIndicator />
          </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
