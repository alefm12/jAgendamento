import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { 
  CalendarBlank, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendUp,
  Calendar as CalendarIcon,
  ChartBar,
  Package,
  MapPin,
  Bell,
  Factory,
  IdentificationCard
} from '@phosphor-icons/react'
import { calculateStats, getAppointmentsByStatus } from '@/lib/statistics'
import type { Appointment, Location } from '@/lib/types'

interface StatsDashboardProps {
  appointments: Appointment[]
  locations?: Location[]
}

export function StatsDashboard({ appointments, locations = [] }: StatsDashboardProps) {
  const stats = useMemo(() => calculateStats(appointments), [appointments])
  const statusBreakdown = useMemo(() => getAppointmentsByStatus(appointments), [appointments])
  
  const locationStats = useMemo(() => {
    const statsByLocation = locations.map(location => {
      const locationAppointments = appointments.filter(apt => apt.locationId === location.id)
      const total = locationAppointments.length
      const completed = locationAppointments.filter(apt =>
        apt.status === 'completed' ||
        apt.status === 'awaiting-issuance' ||
        apt.status === 'cin-ready' ||
        apt.status === 'cin-delivered'
      ).length
      const pending = locationAppointments.filter(apt => apt.status === 'pending').length
      const confirmed = locationAppointments.filter(apt => apt.status === 'confirmed').length
      const awaitingIssuance = locationAppointments.filter(apt => apt.status === 'awaiting-issuance').length
      const cinReady = locationAppointments.filter(apt => apt.status === 'cin-ready').length
      const cinDelivered = locationAppointments.filter(apt => apt.status === 'cin-delivered').length
      const cancelled = locationAppointments.filter(apt => apt.status === 'cancelled').length
      
      return {
        location,
        total,
        completed,
        pending,
        confirmed,
        awaitingIssuance,
        cinReady,
        cinDelivered,
        cancelled,
        percentage: appointments.length > 0 ? Math.round((total / appointments.length) * 100) : 0
      }
    })
    
    return statsByLocation.sort((a, b) => b.total - a.total)
  }, [appointments, locations])

  const statCards = [
    {
      title: 'Total',
      value: stats.total,
      icon: ChartBar,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Hoje',
      value: stats.today,
      icon: CalendarBlank,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Esta Semana',
      value: stats.thisWeek,
      icon: CalendarIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Este Mês',
      value: stats.thisMonth,
      icon: TrendUp,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10'
    }
  ]

  const statusCards = [
    {
      title: 'Pendentes',
      value: statusBreakdown.pending,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
      progressColor: 'bg-yellow-500',
      percentage: stats.total > 0 ? Math.round((statusBreakdown.pending / stats.total) * 100) : 0
    },
    {
      title: 'Confirmados',
      value: statusBreakdown.confirmed,
      icon: CheckCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      progressColor: 'bg-blue-500',
      percentage: stats.total > 0 ? Math.round((statusBreakdown.confirmed / stats.total) * 100) : 0
    },
    {
      title: 'Aguardando Emissão',
      value: statusBreakdown.awaitingIssuance,
      icon: Factory,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
      progressColor: 'bg-purple-500',
      percentage: stats.total > 0 ? Math.round((statusBreakdown.awaitingIssuance / stats.total) * 100) : 0
    },
    {
      title: 'CIN Prontas',
      value: statusBreakdown.cinReady,
      icon: Package,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-500/10',
      progressColor: 'bg-indigo-500',
      percentage: stats.total > 0 ? Math.round((statusBreakdown.cinReady / stats.total) * 100) : 0
    },
    {
      title: 'CIN Entregues',
      value: statusBreakdown.cinDelivered,
      icon: IdentificationCard,
      color: 'text-teal-600',
      bgColor: 'bg-teal-500/10',
      progressColor: 'bg-teal-500',
      percentage: stats.total > 0 ? Math.round((statusBreakdown.cinDelivered / stats.total) * 100) : 0
    },
    {
      title: 'Cancelados',
      value: statusBreakdown.cancelled,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      progressColor: 'bg-destructive',
      percentage: stats.total > 0 ? Math.round((statusBreakdown.cancelled / stats.total) * 100) : 0
    }
  ]

  const remindersSent = useMemo(() => 
    appointments.filter(apt => apt.reminderSent).length
  , [appointments])

  const remindersStats = {
    title: 'Lembretes Enviados',
    value: remindersSent,
    icon: Bell,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    percentage: stats.total > 0 ? Math.round((remindersSent / stats.total) * 100) : 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Visão Geral</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="card-scale-rotate p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                    <Icon size={24} className={stat.color} weight="duotone" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Status dos Agendamentos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {statusCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="card-glow-edge p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                    <Icon size={24} className={stat.color} weight="fill" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{stat.percentage}% do total</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${stat.progressColor} transition-all duration-500`}
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                </div>
              </Card>
            )
          })}
          
          <Card className="card-glow-edge p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-green-700 font-medium mb-1">{remindersStats.title}</p>
                <p className="text-3xl font-bold text-green-900">{remindersStats.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-full ${remindersStats.bgColor} flex items-center justify-center animate-pulse`}>
                <Bell size={24} className={remindersStats.color} weight="fill" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-green-700">
                <span>{remindersStats.percentage}% do total</span>
              </div>
              <div className="w-full h-2 bg-green-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${remindersStats.percentage}%` }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {locations.length > 1 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin size={24} weight="duotone" className="text-primary" />
            Estatísticas por Local de Atendimento
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {locationStats.map((stat) => (
              <Card key={stat.location.id} className="card-hover p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={20} weight="fill" className="text-primary" />
                        <h3 className="font-bold text-lg text-foreground">{stat.location.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{stat.location.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-foreground">{stat.total}</p>
                      <p className="text-xs text-muted-foreground">agendamentos</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{stat.percentage}% do total</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-lg font-semibold text-yellow-600">{stat.pending}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Confirmados</p>
                      <p className="text-lg font-semibold text-blue-600">{stat.confirmed}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Aguard. Emissão</p>
                      <p className="text-lg font-semibold text-purple-600">{stat.awaitingIssuance}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">CIN Prontas</p>
                      <p className="text-lg font-semibold text-indigo-600">{stat.cinReady}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">CIN Entregues</p>
                      <p className="text-lg font-semibold text-teal-600">{stat.cinDelivered}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Cancelados</p>
                      <p className="text-lg font-semibold text-red-600">{stat.cancelled}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
