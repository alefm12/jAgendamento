import { useMemo, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, subMonths, isWithinInterval, startOfYear, endOfYear, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  ChartBar, 
  TrendUp, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  MapPin,
  Package,
  CalendarBlank,
  FunnelSimple
} from '@phosphor-icons/react'
import { ChartExportButton } from '@/components/ChartExportButton'
import { RGTypeReport } from '@/components/RGTypeReport'
import { AnalyticsPDFExport } from '@/components/AnalyticsPDFExport'
import { cn } from '@/lib/utils'
import type { Appointment, Location } from '@/lib/types'

interface AnalyticsDashboardProps {
  appointments: Appointment[]
  locations: Location[]
  systemName?: string
  currentUser?: string
  institutionalLogo?: string
  secretariaName?: string
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
  'awaiting-issuance': '#8b5cf6',
  'cin-ready': '#0ea5e9',
  'cin-delivered': '#22c55e'
}

type PeriodPreset = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'

export function AnalyticsDashboard({ appointments, locations, systemName, currentUser, institutionalLogo, secretariaName }: AnalyticsDashboardProps) {
  const [activeChartTab, setActiveChartTab] = useState('status')

  const switchTabForCapture = (tab: string): Promise<void> =>
    new Promise(resolve => { setActiveChartTab(tab); setTimeout(resolve, 1200) })
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all')
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>()
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>()
  const [regionDrillDown, setRegionDrillDown] = useState<string | null>(null)
  
  // Filtros com seleção múltipla
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedCinTypes, setSelectedCinTypes] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([])
  const [selectedGenders, setSelectedGenders] = useState<string[]>([])
  const [selectedCompletedByUsers, setSelectedCompletedByUsers] = useState<string[]>([])
  
  const statusChartRef = useRef<HTMLDivElement>(null)
  const rgTypeChartRef = useRef<HTMLDivElement>(null)
  const regionChartRef = useRef<HTMLDivElement>(null)
  const genderChartRef = useRef<HTMLDivElement>(null)
  const locationChartRef = useRef<HTMLDivElement>(null)
  const neighborhoodChartRef = useRef<HTMLDivElement>(null)
  const monthlyTrendChartRef = useRef<HTMLDivElement>(null)
  const weeklyChartRef = useRef<HTMLDivElement>(null)
  const deliveryChartRef = useRef<HTMLDivElement>(null)

  const filteredAppointments = useMemo(() => {
    const completedStatuses = ['completed', 'awaiting-issuance', 'cin-ready', 'cin-delivered']
    let filtered = appointments

    // Filtrar por localidades (múltiplas)
    if (selectedLocationIds.length > 0) {
      filtered = filtered.filter(apt => selectedLocationIds.includes(apt.locationId))
    }

    if (periodPreset !== 'all') {
      const now = new Date()
      let startDate: Date
      let endDate: Date = now

      switch (periodPreset) {
        case 'today':
          startDate = new Date(now)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate = startOfWeek(now, { locale: ptBR })
          endDate = endOfWeek(now, { locale: ptBR })
          break
        case 'month':
          startDate = startOfMonth(now)
          endDate = endOfMonth(now)
          break
        case 'year':
          startDate = startOfYear(now)
          endDate = endOfYear(now)
          break
        case 'custom':
          if (!customStartDate || !customEndDate) {
            return filtered
          }
          startDate = customStartDate
          endDate = customEndDate
          break
        default:
          return filtered
      }

      filtered = filtered.filter(apt => {
        const aptDate = parseISO(apt.date)
        return isWithinInterval(aptDate, { start: startDate, end: endDate })
      })
    }

    // Aplicar filtros adicionais com seleção múltipla
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(apt => selectedStatuses.includes(apt.status))
    }

    if (selectedCinTypes.length > 0) {
      filtered = filtered.filter(apt => apt.rgType && selectedCinTypes.includes(apt.rgType))
    }

    if (selectedRegions.length > 0) {
      filtered = filtered.filter(apt => apt.regionType && selectedRegions.includes(apt.regionType))
    }

    if (selectedDistricts.length > 0) {
      filtered = filtered.filter(apt => {
        const district = apt.regionName || apt.sedeId || apt.districtId
        return district && selectedDistricts.includes(district)
      })
    }

    if (selectedNeighborhoods.length > 0) {
      filtered = filtered.filter(apt => apt.neighborhood && selectedNeighborhoods.includes(apt.neighborhood))
    }

    if (selectedGenders.length > 0) {
      filtered = filtered.filter(apt => {
        if (!apt.gender) return false
        const displayGender = apt.gender.startsWith('Outro:') ? 'Outro' : apt.gender
        return selectedGenders.includes(displayGender)
      })
    }

    if (selectedCompletedByUsers.length > 0) {
      filtered = filtered.filter(apt => {
        const completedBy = apt.completedBy?.trim()
        const isCompletedAttendance = Boolean(completedBy) && completedStatuses.includes(apt.status)
        return isCompletedAttendance && selectedCompletedByUsers.includes(completedBy!)
      })
    }

    return filtered
  }, [appointments, periodPreset, selectedLocationIds, customStartDate, customEndDate, selectedStatuses, selectedCinTypes, selectedRegions, selectedDistricts, selectedNeighborhoods, selectedGenders, selectedCompletedByUsers])

  const stats = useMemo(() => {
    const total = filteredAppointments.length
    const byStatus = filteredAppointments.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const thisWeekStart = startOfWeek(today, { locale: ptBR })
    const thisWeekEnd = endOfWeek(today, { locale: ptBR })
    
    const thisMonthStart = startOfMonth(today)
    const thisMonthEnd = endOfMonth(today)

    const todayCount = filteredAppointments.filter(apt => {
      const aptDate = parseISO(apt.date)
      return format(aptDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    }).length

    const thisWeekCount = filteredAppointments.filter(apt => {
      const aptDate = parseISO(apt.date)
      return isWithinInterval(aptDate, { start: thisWeekStart, end: thisWeekEnd })
    }).length

    const thisMonthCount = filteredAppointments.filter(apt => {
      const aptDate = parseISO(apt.date)
      return isWithinInterval(aptDate, { start: thisMonthStart, end: thisMonthEnd })
    }).length

    const avgPerDay = thisMonthCount > 0 ? (thisMonthCount / new Date().getDate()).toFixed(1) : '0'

    return {
      total,
      byStatus,
      todayCount,
      thisWeekCount,
      thisMonthCount,
      avgPerDay
    }
  }, [filteredAppointments])

  const statusData = useMemo(() => {
    const statusLabels: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      completed: 'Emissão (legado)',
      cancelled: 'Cancelado',
      'awaiting-issuance': 'Em emissão',
      'cin-ready': 'CIN pronta',
      'cin-delivered': 'CIN entregue'
    }

    return Object.entries(stats.byStatus).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      status
    }))
  }, [stats.byStatus])

  const locationData = useMemo(() => {
    const byLocation = filteredAppointments.reduce((acc, apt) => {
      const location = locations.find(loc => loc.id === apt.locationId)
      const locationName = location?.name || 'Sem Local'
      acc[locationName] = (acc[locationName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(byLocation)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredAppointments, locations])

  const locationDetailedStats = useMemo(() => {
    const locationsToAnalyze = selectedLocationIds.length === 0
      ? locations 
      : locations.filter(loc => selectedLocationIds.includes(loc.id))

    return locationsToAnalyze.map(location => {
      const locationAppointments = filteredAppointments.filter(apt => apt.locationId === location.id)
      const total = locationAppointments.length
      
      const byStatus = locationAppointments.reduce((acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const byRgType = locationAppointments.reduce((acc, apt) => {
        if (apt.rgType) {
          acc[apt.rgType] = (acc[apt.rgType] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const completed = byStatus.completed || 0
      const awaitingIssuance = byStatus['awaiting-issuance'] || 0
      const cinReady = byStatus['cin-ready'] || 0
      const cinDelivered = byStatus['cin-delivered'] || 0
      const successRate = total > 0 ? ((cinReady + cinDelivered) / total * 100).toFixed(1) : '0'

      return {
        location,
        total,
        byStatus,
        byRgType,
        successRate,
        pending: byStatus.pending || 0,
        confirmed: byStatus.confirmed || 0,
        completed,
        awaitingIssuance,
        cinReady,
        cinDelivered,
        readyForDelivery: cinReady,
        delivered: cinDelivered,
        cancelled: byStatus.cancelled || 0,
        firstVia: byRgType['1ª via'] || 0,
        secondVia: byRgType['2ª via'] || 0
      }
    }).sort((a, b) => b.total - a.total)
  }, [filteredAppointments, locations, selectedLocationIds])

  const neighborhoodData = useMemo(() => {
    const byNeighborhood = filteredAppointments.reduce((acc, apt) => {
      const neighborhood = apt.neighborhood || 'Não Informado'
      acc[neighborhood] = (acc[neighborhood] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(byNeighborhood)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filteredAppointments])

  // Localidades separadas por Sede (agrupadas por bairro) vs Distritos (agrupadas por nome do distrito/local)
  const neighborhoodSedeData = useMemo(() => {
    const sedeApts = filteredAppointments.filter(apt => apt.sedeId && !apt.districtId)
    const byNeighborhood = sedeApts.reduce((acc, apt) => {
      const neighborhood = apt.neighborhood || 'Não Informado'
      acc[neighborhood] = (acc[neighborhood] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(byNeighborhood)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredAppointments])

  const neighborhoodDistritoData = useMemo(() => {
    // Agrupa pelo nome específico do distrito (regionName), exatamente como o drill-down do Analytics
    const distritoApts = filteredAppointments.filter(apt => apt.regionType === 'Distrito' || apt.districtId)
    const byRegion = distritoApts.reduce((acc, apt) => {
      const name = apt.regionName || apt.districtId || 'Não Informado'
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(byRegion)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredAppointments])

  // regionData sempre no nível 1 (Sede vs Distrito) independente do drill-down ativo
  const regionDataLevel1 = useMemo(() => {
    const typeCounts: Record<string, number> = {}
    filteredAppointments.forEach(apt => {
      const type = apt.regionType || 'Não informado'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })
    const REGION_COLORS = ['#009639', '#1d4ed8', '#dc2626', '#d97706']
    return Object.entries(typeCounts)
      .map(([name, value], i) => ({ name, value, color: REGION_COLORS[i % REGION_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
  }, [filteredAppointments])

  const neighborhoodSedeData2 = useMemo(() => {
    // Agrupa pelo nome específico da sede (regionName), para as "Regiões Específicas — Sede"
    const sedeApts = filteredAppointments.filter(apt => apt.regionType === 'Sede' || (apt.sedeId && !apt.districtId))
    const byRegion = sedeApts.reduce((acc, apt) => {
      const name = apt.regionName || apt.neighborhood || apt.sedeId || 'Não Informado'
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(byRegion)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredAppointments])

  const monthlyTrendData = useMemo(() => {
    const months: Date[] = []
    for (let i = 5; i >= 0; i--) {
      months.push(subMonths(new Date(), i))
    }

    return months.map(month => {
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      
      const count = filteredAppointments.filter(apt => {
        const aptDate = parseISO(apt.date)
        return isWithinInterval(aptDate, { start, end })
      }).length

      return {
        month: format(month, 'MMM/yy', { locale: ptBR }),
        total: count
      }
    })
  }, [filteredAppointments])

  // Evolução mensal por tipo (1ª via vs 2ª via) — últimos 6 meses
  const rgTypeMonthlyData = useMemo(() => {
    const months: Date[] = []
    for (let i = 5; i >= 0; i--) months.push(subMonths(new Date(), i))
    return months.map(month => {
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const apts = filteredAppointments.filter(apt => {
        const d = parseISO(apt.date)
        return isWithinInterval(d, { start, end })
      })
      return {
        month: format(month, 'MMM/yy', { locale: ptBR }),
        primeiraVia: apts.filter(a => a.rgType === '1ª via').length,
        segundaVia:  apts.filter(a => a.rgType === '2ª via').length,
      }
    })
  }, [filteredAppointments])

  const weeklyData = useMemo(() => {
    const today = new Date()
    const start = startOfWeek(today, { locale: ptBR })
    const end = endOfWeek(today, { locale: ptBR })
    const days = eachDayOfInterval({ start, end })

    return days.map(day => {
      const count = filteredAppointments.filter(apt => {
        const aptDate = parseISO(apt.date)
        return format(aptDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      }).length

      return {
        day: format(day, 'EEE', { locale: ptBR }),
        count
      }
    })
  }, [filteredAppointments])

  const deliveryStats = useMemo(() => {
    const awaitingIssuance = filteredAppointments.filter(apt => apt.status === 'awaiting-issuance').length
    const cinReady = filteredAppointments.filter(apt => apt.status === 'cin-ready').length
    const delivered = filteredAppointments.filter(apt => apt.status === 'cin-delivered').length
    const totalPending = awaitingIssuance + cinReady

    const avgWaitTime = filteredAppointments
      .filter(apt => apt.status === 'cin-delivered' && apt.completedAt && apt.rgDelivery?.deliveredAt)
      .map(apt => {
        const completed = new Date(apt.completedAt!)
        const deliveredDate = new Date(apt.rgDelivery!.deliveredAt)
        return (deliveredDate.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24)
      })
      .reduce((sum, days, _, arr) => sum + days / arr.length, 0)

    return {
      awaitingIssuance,
      cinReady,
      delivered,
      totalPending,
      avgWaitTime: avgWaitTime ? avgWaitTime.toFixed(1) : '0'
    }
  }, [filteredAppointments])

  const rgTypeData = useMemo(() => {
    const firstVia = filteredAppointments.filter(apt => apt.rgType === '1ª via').length
    const secondVia = filteredAppointments.filter(apt => apt.rgType === '2ª via').length
    
    return [
      { name: '1ª via', value: firstVia, color: '#22c55e' },
      { name: '2ª via', value: secondVia, color: '#3b82f6' }
    ]
  }, [filteredAppointments])

  const regionData = useMemo(() => {
    if (!regionDrillDown) {
      // Nível 1: Agrupar apenas por tipo (Sede/Distrito)
      const typeCounts: Record<string, number> = {}
      
      filteredAppointments.forEach(apt => {
        if (apt.regionType) {
          typeCounts[apt.regionType] = (typeCounts[apt.regionType] || 0) + 1
        } else {
          typeCounts['Não informado'] = (typeCounts['Não informado'] || 0) + 1
        }
      })

      return Object.entries(typeCounts)
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length],
          isType: true
        }))
        .sort((a, b) => b.value - a.value)
    } else {
      // Nível 2: Mostrar detalhes do tipo selecionado (ex: todos os Distritos)
      const regionCounts: Record<string, number> = {}
      
      filteredAppointments.forEach(apt => {
        if (apt.regionType === regionDrillDown) {
          const regionName = apt.regionName || apt.sedeId || apt.districtId || 'Sem nome'
          regionCounts[regionName] = (regionCounts[regionName] || 0) + 1
        }
      })

      return Object.entries(regionCounts)
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length],
          isType: false
        }))
        .sort((a, b) => b.value - a.value)
    }
  }, [filteredAppointments, regionDrillDown])

  const genderData = useMemo(() => {
    const genderCounts: Record<string, number> = {}
    
    filteredAppointments.forEach(apt => {
      if (apt.gender) {
        const displayGender = apt.gender.startsWith('Outro:') ? `Outro (${apt.gender.replace('Outro:', '')})` : apt.gender
        genderCounts[displayGender] = (genderCounts[displayGender] || 0) + 1
      } else {
        genderCounts['Não informado'] = (genderCounts['Não informado'] || 0) + 1
      }
    })

    return Object.entries(genderCounts)
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredAppointments])

  // Opções únicas para filtros
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(appointments.map(apt => apt.status))
    return Array.from(statuses).filter(Boolean)
  }, [appointments])

  const uniqueCinTypes = useMemo(() => {
    const types: string[] = []
    appointments.forEach(apt => {
      if (apt.rgType && !types.includes(apt.rgType)) {
        types.push(apt.rgType)
      }
    })
    return types
  }, [appointments])

  const uniqueRegions = useMemo(() => {
    const regions: string[] = []
    appointments.forEach(apt => {
      if (apt.regionType && !regions.includes(apt.regionType)) {
        regions.push(apt.regionType)
      }
    })
    return regions
  }, [appointments])

  const uniqueDistricts = useMemo(() => {
    const districts: string[] = []
    appointments.forEach(apt => {
      const district = apt.regionName || apt.sedeId || apt.districtId
      if (district && !districts.includes(district)) {
        districts.push(district)
      }
    })
    return districts
  }, [appointments])

  const uniqueNeighborhoods = useMemo(() => {
    const neighborhoods: string[] = []
    appointments.forEach(apt => {
      if (apt.neighborhood && !neighborhoods.includes(apt.neighborhood)) {
        neighborhoods.push(apt.neighborhood)
      }
    })
    return neighborhoods
  }, [appointments])

  const uniqueGenders = useMemo(() => {
    const genders: string[] = []
    appointments.forEach(apt => {
      if (apt.gender) {
        const displayGender = apt.gender.startsWith('Outro:') ? 'Outro' : apt.gender
        if (!genders.includes(displayGender)) {
          genders.push(displayGender)
        }
      }
    })
    return genders
  }, [appointments])

  const uniqueCompletedByUsers = useMemo(() => {
    const users: string[] = []
    const completedStatuses = ['completed', 'awaiting-issuance', 'cin-ready', 'cin-delivered']

    appointments.forEach(apt => {
      const completedBy = apt.completedBy?.trim()
      if (!completedBy || !completedStatuses.includes(apt.status)) return
      if (!users.includes(completedBy)) {
        users.push(completedBy)
      }
    })

    return users.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [appointments])

  const getPeriodLabel = () => {
    switch (periodPreset) {
      case 'today':
        return 'Hoje'
      case 'week':
        return 'Esta Semana'
      case 'month':
        return 'Este Mês'
      case 'year':
        return 'Este Ano'
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, 'dd/MM/yy')} - ${format(customEndDate, 'dd/MM/yy')}`
        }
        return 'Período Personalizado'
      case 'all':
      default:
        return 'Todos os Períodos'
    }
  }

  const getLocationLabel = () => {
    if (selectedLocationIds.length === 0) {
      return 'Todas as Localidades'
    }
    if (selectedLocationIds.length === 1) {
      const location = locations.find(loc => loc.id === selectedLocationIds[0])
      return location?.name || 'Local Desconhecido'
    }
    return `${selectedLocationIds.length} localidades`
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-2">
        <CardHeader className="p-3 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <FunnelSimple size={20} weight="duotone" className="text-primary" />
                Filtros de Análise
              </CardTitle>
              <CardDescription className="hidden md:block">
                Filtre os dados por período, localidade, status, tipo de CIN, região, distrito/sede, bairro/comunidade, gênero e usuário
              </CardDescription>
            </div>
            <AnalyticsPDFExport
              data={{
                totalAppointments:      stats.total,
                todayAppointments:      stats.todayCount,
                monthAppointments:      stats.thisMonthCount,
                completedAppointments:  stats.byStatus['completed'] || 0,
                cinDelivered:           stats.byStatus['cin-delivered'] || 0,
                waitingForDelivery:     (stats.byStatus['awaiting-issuance'] || 0) + (stats.byStatus['cin-ready'] || 0),
                statusData: statusData.map(item => ({
                  name: item.name, value: item.value,
                  color: statusColors[item.status] || '#6b7280'
                })),
                rgTypeData:       rgTypeData,
                locationData:     locationData.map(item => ({ name: item.name, value: item.count })),
                locationDetailedStats: locationDetailedStats.map(s => ({
                  name:         s.location.name,
                  address:      s.location.address,
                  total:        s.total,
                  pending:      s.pending,
                  confirmed:    s.confirmed,
                  completed:    s.completed,
                  awaitingIssuance: s.awaitingIssuance,
                  cinReady:     s.cinReady,
                  cinDelivered: s.cinDelivered,
                  cancelled:    s.cancelled,
                  firstVia:     s.firstVia,
                  secondVia:    s.secondVia,
                  successRate:  s.successRate,
                })),
                // Sempre nível 1 (Sede/Distrito) — não depende do drill-down ativo
                regionData:       regionDataLevel1,
                genderData:       genderData,
                neighborhoodData:         neighborhoodData.map(item => ({ name: item.name, value: item.count })),
                neighborhoodSedeData:     neighborhoodSedeData2.map(item => ({ name: item.name, value: item.count })),
                neighborhoodDistritoData: neighborhoodDistritoData.map(item => ({ name: item.name, value: item.count })),
                monthlyTrendData:   monthlyTrendData,
                rgTypeMonthlyData:  rgTypeMonthlyData,
                weeklyData:         weeklyData,
                deliveryStats: {
                  awaitingIssuance: deliveryStats.awaitingIssuance,
                  cinReady:         deliveryStats.cinReady,
                  delivered:        deliveryStats.delivered,
                  totalPending:     deliveryStats.totalPending,
                  avgWaitTime:      deliveryStats.avgWaitTime,
                },
              }}
              filters={{
                period:    getPeriodLabel(),
                locations: selectedLocationIds.map(id => {
                  const loc = locations.find(l => l.id === id)
                  return loc?.name || id
                }),
                statuses: selectedStatuses.map(s => ({
                  pending:             'Pendente',
                  confirmed:           'Confirmado',
                  completed:           'Concluído',
                  cancelled:           'Cancelado',
                  'awaiting-issuance': 'Aguardando Emissão',
                  'cin-ready':         'CIN Pronto',
                  'cin-delivered':     'CIN Entregue',
                } as Record<string,string>)[s] ?? s),
                cinTypes:  selectedCinTypes,
                regions:   selectedRegions,
                genders:   selectedGenders,
                users:     selectedCompletedByUsers,
              }}
              systemName={systemName}
              currentUser={currentUser}
              institutionalLogo={institutionalLogo}
              secretariaName={secretariaName}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarBlank size={16} weight="duotone" />
                Período
              </label>
              <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as PeriodPreset)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Períodos</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mês</SelectItem>
                  <SelectItem value="year">Este Ano</SelectItem>
                  <SelectItem value="custom">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin size={16} weight="duotone" />
                Local de Atendimento
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedLocationIds.length === 0 
                      ? 'Todos' 
                      : `${selectedLocationIds.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Selecione as localidades</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedLocationIds([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {locations.map(location => (
                        <div key={location.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`location-${location.id}`}
                            checked={selectedLocationIds.includes(location.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLocationIds([...selectedLocationIds, location.id])
                              } else {
                                setSelectedLocationIds(selectedLocationIds.filter(id => id !== location.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={`location-${location.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {location.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedStatuses.length === 0 
                      ? 'Todos' 
                      : `${selectedStatuses.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Selecione os status</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedStatuses([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {uniqueStatuses.map(status => {
                        const statusLabels: Record<string, string> = {
                          pending: 'Pendente',
                          confirmed: 'Confirmado',
                          completed: 'Concluído',
                          cancelled: 'Cancelado',
                          'awaiting-issuance': 'Aguardando Emissão',
                          'cin-ready': 'CIN Pronto',
                          'cin-delivered': 'CIN Entregue'
                        }
                        return (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`status-${status}`}
                              checked={selectedStatuses.includes(status)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedStatuses([...selectedStatuses, status])
                                } else {
                                  setSelectedStatuses(selectedStatuses.filter(s => s !== status))
                                }
                              }}
                            />
                            <label
                              htmlFor={`status-${status}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {statusLabels[status] || status}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de CIN</label>
              <Select 
                value={selectedCinTypes.length === 0 ? 'all' : selectedCinTypes[0]} 
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedCinTypes([])
                  } else {
                    setSelectedCinTypes([value])
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1ª via">1ª via</SelectItem>
                  <SelectItem value="2ª via">2ª via</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Gênero</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedGenders.length === 0 
                      ? 'Todos' 
                      : `${selectedGenders.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Selecione os gêneros</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedGenders([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {uniqueGenders.map(gender => (
                        <div key={gender} className="flex items-center space-x-2">
                          <Checkbox
                            id={`gender-${gender}`}
                            checked={selectedGenders.includes(gender)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedGenders([...selectedGenders, gender])
                              } else {
                                setSelectedGenders(selectedGenders.filter(g => g !== gender))
                              }
                            }}
                          />
                          <label
                            htmlFor={`gender-${gender}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {gender}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Usuário</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedCompletedByUsers.length === 0
                      ? 'Todos'
                      : `${selectedCompletedByUsers.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Selecione os usuários</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCompletedByUsers([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {uniqueCompletedByUsers.map(userName => (
                        <div key={userName} className="flex items-center space-x-2">
                          <Checkbox
                            id={`completed-by-${userName}`}
                            checked={selectedCompletedByUsers.includes(userName)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCompletedByUsers([...selectedCompletedByUsers, userName])
                              } else {
                                setSelectedCompletedByUsers(selectedCompletedByUsers.filter(user => user !== userName))
                              }
                            }}
                          />
                          <label
                            htmlFor={`completed-by-${userName}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {userName}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Região</label>
              <Select 
                value={selectedRegions.length === 0 ? 'all' : selectedRegions[0]} 
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedRegions([])
                  } else {
                    setSelectedRegions([value])
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Sede">Sede</SelectItem>
                  <SelectItem value="Distrito">Distrito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Distrito/Sede</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedDistricts.length === 0 
                      ? 'Todos' 
                      : `${selectedDistricts.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Selecione distritos/sedes</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedDistricts([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {uniqueDistricts.map(district => (
                        <div key={district} className="flex items-center space-x-2">
                          <Checkbox
                            id={`district-${district}`}
                            checked={selectedDistricts.includes(district)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDistricts([...selectedDistricts, district])
                              } else {
                                setSelectedDistricts(selectedDistricts.filter(d => d !== district))
                              }
                            }}
                          />
                          <label
                            htmlFor={`district-${district}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {district}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bairro/Comunidade</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedNeighborhoods.length === 0 
                      ? 'Todos' 
                      : `${selectedNeighborhoods.length} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Selecione bairros/comunidades</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedNeighborhoods([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {uniqueNeighborhoods.map(neighborhood => (
                        <div key={neighborhood} className="flex items-center space-x-2">
                          <Checkbox
                            id={`neighborhood-${neighborhood}`}
                            checked={selectedNeighborhoods.includes(neighborhood)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedNeighborhoods([...selectedNeighborhoods, neighborhood])
                              } else {
                                setSelectedNeighborhoods(selectedNeighborhoods.filter(n => n !== neighborhood))
                              }
                            }}
                          />
                          <label
                            htmlFor={`neighborhood-${neighborhood}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {neighborhood}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="md:col-span-2 xl:col-span-3 flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedLocationIds([])
                  setSelectedStatuses([])
                  setSelectedCinTypes([])
                  setSelectedGenders([])
                  setSelectedRegions([])
                  setSelectedDistricts([])
                  setSelectedNeighborhoods([])
                  setSelectedCompletedByUsers([])
                }}
                className="gap-2"
              >
                <XCircle size={16} />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {periodPreset === 'custom' && (
            <div className="grid gap-4 md:grid-cols-2 p-4 border-2 border-dashed rounded-lg bg-muted/30">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarBlank size={16} className="mr-2" />
                      {customStartDate ? format(customStartDate, 'dd/MM/yyyy') : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarBlank size={16} className="mr-2" />
                      {customEndDate ? format(customEndDate, 'dd/MM/yyyy') : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      locale={ptBR}
                      disabled={(date) => customStartDate ? date < customStartDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}


        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs font-medium">Total de Agendamentos</CardTitle>
            <Users size={16} className="text-muted-foreground" weight="duotone" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média de {stats.avgPerDay}/dia este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs font-medium">Hoje</CardTitle>
            <Calendar size={16} className="text-muted-foreground" weight="duotone" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-xl font-bold">{stats.todayCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.thisWeekCount} esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs font-medium">Este Mês</CardTitle>
            <TrendUp size={16} className="text-muted-foreground" weight="duotone" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-xl font-bold">{stats.thisMonthCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.thisMonthCount / stats.total) * 100).toFixed(0)}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
            <CardTitle className="text-xs font-medium">CINs Aguardando</CardTitle>
            <Package size={16} className="text-purple-600" weight="duotone" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-xl font-bold">{deliveryStats.totalPending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {deliveryStats.delivered} já entregues
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeChartTab} onValueChange={setActiveChartTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="status">Por Status</TabsTrigger>
          <TabsTrigger value="rgtype">Tipo de CIN</TabsTrigger>
          <TabsTrigger value="location">Por Local</TabsTrigger>
          <TabsTrigger value="region">Por Região</TabsTrigger>
          <TabsTrigger value="gender">Por Gênero</TabsTrigger>
          <TabsTrigger value="neighborhood">Por Bairro/Comunidade</TabsTrigger>
          <TabsTrigger value="trends">Tendências</TabsTrigger>
          <TabsTrigger value="delivery">Entrega de CIN</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card ref={statusChartRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Distribuição por Status</CardTitle>
                    <CardDescription>Agendamentos por status atual</CardDescription>
                  </div>
                  <ChartExportButton
                    chartRef={statusChartRef}
                    filename="distribuicao_status"
                    title="Distribuição por Status"
                    subtitle={`${getPeriodLabel()} - ${getLocationLabel()}`}
                    variant="icon"
                  />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
                        const RADIAN = Math.PI / 180
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        const sin = Math.sin(-RADIAN * midAngle)
                        const cos = Math.cos(-RADIAN * midAngle)
                        const sx = cx + (outerRadius + 10) * cos
                        const sy = cy + (outerRadius + 10) * sin
                        const mx = cx + (outerRadius + 30) * cos
                        const my = cy + (outerRadius + 30) * sin
                        const ex = mx + (cos >= 0 ? 1 : -1) * 22
                        const ey = my
                        const textAnchor = cos >= 0 ? 'start' : 'end'
                        
                        return (
                          <g>
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold">
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={statusColors[statusData.find(d => d.name === name)?.status || ''] || '#999'} fill="none" />
                            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize="12" fontWeight="600">
                              {`${name}: ${value}`}
                            </text>
                          </g>
                        )
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={statusColors[entry.status] || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo de Status</CardTitle>
                <CardDescription>Quantidade por categoria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusData.map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: statusColors[item.status] }}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rgtype" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card ref={rgTypeChartRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Distribuição por Tipo de CIN</CardTitle>
                    <CardDescription>Comparação entre 1ª e 2ª via</CardDescription>
                  </div>
                  <ChartExportButton
                    chartRef={rgTypeChartRef}
                    filename="tipo_CIN"
                    title="Distribuição por Tipo de CIN"
                    subtitle={`${getPeriodLabel()} - ${getLocationLabel()}`}
                    variant="icon"
                  />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rgTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
                        const RADIAN = Math.PI / 180
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        const sin = Math.sin(-RADIAN * midAngle)
                        const cos = Math.cos(-RADIAN * midAngle)
                        const sx = cx + (outerRadius + 10) * cos
                        const sy = cy + (outerRadius + 10) * sin
                        const mx = cx + (outerRadius + 30) * cos
                        const my = cy + (outerRadius + 30) * sin
                        const ex = mx + (cos >= 0 ? 1 : -1) * 22
                        const ey = my
                        const textAnchor = cos >= 0 ? 'start' : 'end'
                        
                        return (
                          <g>
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold">
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={rgTypeData.find(d => d.name === name)?.color || '#999'} fill="none" />
                            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize="12" fontWeight="600">
                              {`${name}: ${value}`}
                            </text>
                          </g>
                        )
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {rgTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo de Tipos</CardTitle>
                <CardDescription>Quantidade por tipo de CIN</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rgTypeData.map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <Badge variant="secondary" className="font-bold">
                        {item.value}
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${filteredAppointments.length > 0 ? (item.value / filteredAppointments.length * 100).toFixed(0) : 0}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {filteredAppointments.length > 0 ? ((item.value / filteredAppointments.length) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="location" className="space-y-4">
          <Card ref={locationChartRef}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={20} weight="duotone" />
                  <div>
                    <CardTitle>Agendamentos por Local de Atendimento</CardTitle>
                    </div>
                </div>
                <ChartExportButton
                  chartRef={locationChartRef}
                  filename="agendamentos_localidade"
                  title="Agendamentos por Local de Atendimento"
                  subtitle={`${getPeriodLabel()}`}
                  variant="icon"
                />
              </div>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="total" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Estatísticas Detalhadas por Localidade</h3>
            <div className="grid gap-4">
              {locationDetailedStats.map((stat) => (
                <Card key={stat.location.id} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={24} weight="fill" className="text-primary" />
                        <div>
                          <CardTitle>{stat.location.name}</CardTitle>
                          <CardDescription>{stat.location.address}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-foreground">{stat.total}</div>
                        <p className="text-xs text-muted-foreground">agendamentos</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Pendentes</p>
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-yellow-600" weight="duotone" />
                            <p className="text-lg font-bold text-yellow-600">{stat.pending}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Confirmados</p>
                          <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-blue-600" weight="duotone" />
                            <p className="text-lg font-bold text-blue-600">{stat.confirmed}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Aguardando Emissão</p>
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-purple-600" weight="duotone" />
                            <p className="text-lg font-bold text-purple-600">{stat.awaitingIssuance}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">CIN Prontas</p>
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-green-600" weight="fill" />
                            <p className="text-lg font-bold text-green-600">{stat.readyForDelivery}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Entregues</p>
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-teal-600" weight="fill" />
                            <p className="text-lg font-bold text-teal-600">{stat.delivered}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Cancelados</p>
                          <div className="flex items-center gap-2">
                            <XCircle size={16} className="text-red-600" weight="duotone" />
                            <p className="text-lg font-bold text-red-600">{stat.cancelled}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</p>
                            <div className="flex items-center gap-2">
                              <TrendUp size={20} className="text-green-600" weight="duotone" />
                              <p className="text-2xl font-bold text-green-600">{stat.successRate}%</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {stat.readyForDelivery + stat.delivered} prontas/entregues de {stat.total}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Tipo de CIN</p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">1ª via:</span>
                                <Badge variant="secondary">{stat.firstVia}</Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">2ª via:</span>
                                <Badge variant="secondary">{stat.secondVia}</Badge>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Percentual do Total</p>
                            <div className="flex items-center gap-2">
                              <ChartBar size={20} className="text-primary" weight="duotone" />
                              <p className="text-2xl font-bold text-primary">
                                {filteredAppointments.length > 0 ? ((stat.total / filteredAppointments.length) * 100).toFixed(1) : 0}%
                              </p>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 mt-2">
                              <div 
                                className="h-2 bg-primary rounded-full transition-all"
                                style={{ width: `${filteredAppointments.length > 0 ? (stat.total / filteredAppointments.length) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="region" className="space-y-4">
          {regionDrillDown && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRegionDrillDown(null)}
                className="gap-2"
              >
                ← Voltar para visão geral
              </Button>
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card ref={regionChartRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {regionDrillDown ? `Detalhes: ${regionDrillDown}` : 'Distribuição por Região'}
                    </CardTitle>
                    <CardDescription>
                      {regionDrillDown ? `Todas as ${regionDrillDown === 'Distrito' ? 'distritos' : 'sedes'}` : 'Comparação entre Sedes e Distritos'}
                    </CardDescription>
                  </div>
                  <ChartExportButton
                    chartRef={regionChartRef}
                    filename="distribuicao_regiao"
                    title="Distribuição por Região"
                    subtitle={`${getPeriodLabel()} - ${getLocationLabel()}`}
                    variant="icon"
                  />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={regionData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
                        const RADIAN = Math.PI / 180
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        const sin = Math.sin(-RADIAN * midAngle)
                        const cos = Math.cos(-RADIAN * midAngle)
                        const sx = cx + (outerRadius + 10) * cos
                        const sy = cy + (outerRadius + 10) * sin
                        const mx = cx + (outerRadius + 30) * cos
                        const my = cy + (outerRadius + 30) * sin
                        const ex = mx + (cos >= 0 ? 1 : -1) * 22
                        const ey = my
                        const textAnchor = cos >= 0 ? 'start' : 'end'
                        
                        return (
                          <g>
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold">
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={regionData.find(d => d.name === name)?.color || '#999'} fill="none" />
                            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize="12" fontWeight="600">
                              {`${name}: ${value}`}
                            </text>
                          </g>
                        )
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      onClick={(data: any) => {
                        if (!regionDrillDown && data.isType && data.name !== 'Não informado') {
                          setRegionDrillDown(data.name)
                        }
                      }}
                      style={{ cursor: !regionDrillDown ? 'pointer' : 'default' }}
                    >
                      {regionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {regionDrillDown ? `Lista de ${regionDrillDown === 'Distrito' ? 'Distritos' : 'Sedes'}` : 'Resumo de Regiões'}
                </CardTitle>
                <CardDescription>
                  {regionDrillDown ? 'Clique em "Voltar" para ver a visão geral' : 'Clique em uma região para ver detalhes'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {regionData.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-colors",
                      !regionDrillDown && item.name !== 'Não informado' && "cursor-pointer hover:bg-muted"
                    )}
                    onClick={() => {
                      if (!regionDrillDown && item.name !== 'Não informado') {
                        setRegionDrillDown(item.name)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {item.value}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {((item.value / filteredAppointments.length) * 100).toFixed(1)}% do total
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gender" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card ref={genderChartRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Distribuição por Gênero</CardTitle>
                    <CardDescription>Agendamentos por gênero declarado</CardDescription>
                  </div>
                  <ChartExportButton
                    chartRef={genderChartRef}
                    filename="distribuicao_genero"
                    title="Distribuição por Gênero"
                    subtitle={`${getPeriodLabel()} - ${getLocationLabel()}`}
                    variant="icon"
                  />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
                        const RADIAN = Math.PI / 180
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        const sin = Math.sin(-RADIAN * midAngle)
                        const cos = Math.cos(-RADIAN * midAngle)
                        const sx = cx + (outerRadius + 10) * cos
                        const sy = cy + (outerRadius + 10) * sin
                        const mx = cx + (outerRadius + 30) * cos
                        const my = cy + (outerRadius + 30) * sin
                        const ex = mx + (cos >= 0 ? 1 : -1) * 22
                        const ey = my
                        const textAnchor = cos >= 0 ? 'start' : 'end'
                        
                        return (
                          <g>
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold">
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={genderData.find(d => d.name === name)?.color || '#999'} fill="none" />
                            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize="12" fontWeight="600">
                              {`${name}: ${value}`}
                            </text>
                          </g>
                        )
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {genderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo por Gênero</CardTitle>
                <CardDescription>Quantidade por gênero declarado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {genderData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {item.value}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {((item.value / filteredAppointments.length) * 100).toFixed(1)}% do total
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="neighborhood" className="space-y-4">
          <Card ref={neighborhoodChartRef}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top 10 Bairros/Comunidades</CardTitle>
                  <CardDescription>Bairros/Comunidades com mais agendamentos</CardDescription>
                </div>
                <ChartExportButton
                  chartRef={neighborhoodChartRef}
                  filename="top_bairros"
                  title="Top 10 Bairros"
                  subtitle={`${getPeriodLabel()} - ${getLocationLabel()}`}
                  variant="icon"
                />
              </div>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={neighborhoodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={150} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card ref={monthlyTrendChartRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tendência Mensal</CardTitle>
                    <CardDescription>Últimos 6 meses</CardDescription>
                  </div>
                  <ChartExportButton
                    chartRef={monthlyTrendChartRef}
                    filename="tendencia_mensal"
                    title="Tendência Mensal"
                    subtitle={`Últimos 6 meses - ${getLocationLabel()}`}
                    variant="icon"
                  />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card ref={weeklyChartRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Esta Semana</CardTitle>
                    <CardDescription>Agendamentos por dia</CardDescription>
                  </div>
                  <ChartExportButton
                    chartRef={weeklyChartRef}
                    filename="agendamentos_semana"
                    title="Agendamentos da Semana"
                    subtitle={`${getLocationLabel()}`}
                    variant="icon"
                  />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="total" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <RGTypeReport 
            appointments={filteredAppointments}
            systemName={systemName}
          />
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Em Emissão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{deliveryStats.awaitingIssuance}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CINs Prontas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-sky-600">{deliveryStats.cinReady}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CINs Entregues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-teal-600">{deliveryStats.delivered}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tempo Médio de Espera</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{deliveryStats.avgWaitTime}</div>
                <p className="text-xs text-muted-foreground mt-1">dias</p>
              </CardContent>
            </Card>
          </div>

          <Card ref={deliveryChartRef}>
            <CardHeader>
              <CardTitle>Status de Entrega</CardTitle>
              <CardDescription>Visão geral do processo de entrega de CIN</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Em emissão', value: deliveryStats.awaitingIssuance, color: '#8b5cf6' },
                      { name: 'Prontas para retirada', value: deliveryStats.cinReady, color: '#0ea5e9' },
                      { name: 'Entregues', value: deliveryStats.delivered, color: '#06b6d4' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value, color }) => {
                      const RADIAN = Math.PI / 180
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      const sin = Math.sin(-RADIAN * midAngle)
                      const cos = Math.cos(-RADIAN * midAngle)
                      const sx = cx + (outerRadius + 10) * cos
                      const sy = cy + (outerRadius + 10) * sin
                      const mx = cx + (outerRadius + 30) * cos
                      const my = cy + (outerRadius + 30) * sin
                      const ex = mx + (cos >= 0 ? 1 : -1) * 22
                      const ey = my
                      const textAnchor = cos >= 0 ? 'start' : 'end'
                      
                      return (
                        <g>
                          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold">
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                          <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={color || '#999'} fill="none" />
                          <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize="12" fontWeight="600">
                            {`${name}: ${value}`}
                          </text>
                        </g>
                      )
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#8b5cf6" />
                    <Cell fill="#0ea5e9" />
                    <Cell fill="#06b6d4" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
