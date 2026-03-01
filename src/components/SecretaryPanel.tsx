import { useState, useMemo, useEffect } from 'react'
import { useConfirm } from '@/components/ConfirmDialog'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NotificationViewer } from '@/components/NotificationViewer'
import { StatsDashboard } from '@/components/StatsDashboard'
import { AppointmentNotes } from '@/components/AppointmentNotes'
import { RescheduleDialog } from '@/components/RescheduleDialog'
import { ExportMenu } from '@/components/ExportMenu'
import { AuditHistory } from '@/components/AuditHistory'
import { AuditReport } from '@/components/AuditReport'
import { StatusChangeDialog } from '@/components/StatusChangeDialog'
import { FilterMenu, type FilterState } from '@/components/FilterMenu'
import { ScrollProgressIndicator } from '@/components/ScrollProgressIndicator'
import { ScrollToTop } from '@/components/ScrollToTop'
import { toast } from 'sonner'
import { 
  MagnifyingGlass, 
  CalendarBlank, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Phone,
  IdentificationCard,
  EnvelopeSimple,
  Trash,
  ClockCounterClockwise,
  MapPin,
  Package,
  MegaphoneSimple
} from '@phosphor-icons/react'
import type { Appointment, AppointmentStatus, AppointmentPriority, Location, SecretaryUser, CustomField, BlockedDate } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getAppointmentsByDay } from '@/lib/statistics'
import { parseDateOnly } from '@/lib/date-utils'
import { formatCPF, validateCPF, formatPhone } from '@/lib/validators'
import type { DateRange } from 'react-day-picker'

interface SecretaryPanelProps {
  appointments: Appointment[]
  locations: Location[]
  customFields?: CustomField[]
  workingHours: string[]
  maxAppointmentsPerSlot: number
  blockedDates?: BlockedDate[]
  bookingWindowDays?: number
  onStatusChange: (id: string, status: AppointmentStatus, reason?: string) => void
  onAddNote: (appointmentId: string, note: string, options?: { contextLabel?: string }) => void
  onDeleteNote: (appointmentId: string, noteId: string) => void
  onReschedule: (appointmentId: string, newDate: string, newTime: string) => void
  onBulkDelete: (ids: string[]) => void
  onPriorityChange: (appointmentId: string, priority: AppointmentPriority) => void
  onUpdateAppointmentDetails?: (
    appointmentId: string,
    updates: Pick<Appointment, 'fullName' | 'email' | 'phone' | 'street' | 'number' | 'neighborhood' | 'cpf' | 'regionType' | 'sedeId' | 'districtId' | 'neighborhoodId'>
  ) => Promise<void> | void
  currentUser: SecretaryUser
}

type PersonalInfoFields = Pick<
  Appointment,
  'fullName' | 'email' | 'phone' | 'street' | 'number' | 'neighborhood' | 'cpf' | 'regionType' | 'sedeId' | 'districtId' | 'neighborhoodId'
>

const emptyPersonalInfo: PersonalInfoFields = {
  fullName: '',
  email: '',
  phone: '',
  street: '',
  number: '',
  neighborhood: '',
  cpf: '',
  regionType: '',
  sedeId: '',
  districtId: '',
  neighborhoodId: ''
}

const SELECT_EMPTY_VALUE = '__empty__'

interface AddressLocalityOption {
  id: string
  nome: string
}

interface AddressNeighborhood {
  id: string
  nome: string
  localidadeId?: string | null
  parentType?: 'Sede' | 'Distrito'
}

interface AddressOptions {
  headquarters: AddressLocalityOption[]
  districts: AddressLocalityOption[]
  neighborhoods: AddressNeighborhood[]
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  completed: { label: 'Concluído', color: 'bg-accent/10 text-accent border-accent/20' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  'awaiting-issuance': { label: 'Aguardando Emissão', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  'cin-ready': { label: 'CIN Pronta', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20' },
  'cin-delivered': { label: 'CIN Entregue', color: 'bg-teal-500/10 text-teal-700 border-teal-500/20' }
} satisfies Record<string, { label: string; color: string }>

const fallbackStatusVisual = {
  label: 'Status Desconhecido',
  color: 'bg-slate-500/10 text-slate-700 border-slate-500/30'
}

const getStatusVisual = (status: string) => statusConfig[status] ?? fallbackStatusVisual

const statusFilterOptions = Object.entries(statusConfig).filter(([status]) => status !== 'completed')

export function SecretaryPanel({ 
  appointments,
  locations,
  customFields = [],
  workingHours,
  maxAppointmentsPerSlot,
  blockedDates = [],
  bookingWindowDays = 60,
  onStatusChange,
  onAddNote,
  onDeleteNote,
  onReschedule,
  onBulkDelete,
  onPriorityChange,
  onUpdateAppointmentDetails,
  currentUser
}: SecretaryPanelProps) {
  const { confirm, ConfirmDialogNode } = useConfirm()
  const canConfirmAppointment = currentUser.isAdmin || currentUser.permissions?.canConfirmAppointment
  const canCompleteAppointment = currentUser.isAdmin || currentUser.permissions?.canCompleteAppointment
  const canReschedule = currentUser.isAdmin || currentUser.permissions?.canReschedule
  const canCancel = currentUser.isAdmin || currentUser.permissions?.canCancel
  const canDeleteAppointment = currentUser.isAdmin || currentUser.permissions?.canDeleteAppointment
  const canChangePriority = currentUser.isAdmin || currentUser.permissions?.canChangePriority
  const canAddNotes = currentUser.isAdmin || currentUser.permissions?.canAddNotes
  const canViewReports = currentUser.isAdmin || currentUser.permissions?.canViewReports
  const canExportData = currentUser.isAdmin || currentUser.permissions?.canExportData
  const canBulkDelete = currentUser.isAdmin || currentUser.permissions?.canBulkDelete
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showStats, setShowStats] = useState(true)
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false)
  const [appointmentToConfirm, setAppointmentToConfirm] = useState<Appointment | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<AppointmentPriority>('normal')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileAppointment, setProfileAppointment] = useState<Appointment | null>(null)
  const [profileForm, setProfileForm] = useState<PersonalInfoFields>(emptyPersonalInfo)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [addressOptions, setAddressOptions] = useState<AddressOptions | null>(null)
  const [addressOptionsLoading, setAddressOptionsLoading] = useState(false)
  const [addressOptionsError, setAddressOptionsError] = useState<string | null>(null)
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    locationId: 'all',
    neighborhood: 'all',
    month: 'all',
    year: 'all',
    status: 'all',
    priority: 'all',
    dateFrom: '',
    dateTo: '',
    searchCPF: '',
    searchProtocol: '',
    rgType: 'all'
  })

  const appointmentNeighborhoods = useMemo(() => {
    const uniqueNeighborhoods = new Set<string>()
    appointments.forEach(apt => {
      if (apt.neighborhood && apt.neighborhood.trim()) {
        uniqueNeighborhoods.add(apt.neighborhood.trim())
      }
    })
    return Array.from(uniqueNeighborhoods).sort()
  }, [appointments])

  const locationsById = useMemo(() => {
    const map = new Map<string, Location>()
    locations.forEach((location) => {
      map.set(String(location.id).trim(), location)
    })
    return map
  }, [locations])

  const resolveAppointmentLocationName = (appointment: Appointment) => {
    const directName = appointment.locationName?.trim()
    if (directName) return directName

    const locationId = String(appointment.locationId || '').trim()
    if (!locationId) return 'Não informado'

    const matchedLocation = locationsById.get(locationId)
    const fallbackName = matchedLocation?.name?.trim()
    return fallbackName || 'Não informado'
  }

  const filteredAppointments = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2 }
    
    return appointments.filter(apt => {
      const matchesSearch = 
        apt.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.cpf.includes(searchTerm) ||
        apt.protocol.toLowerCase().includes(searchTerm.toLowerCase())
      
      const aptDateStr = format(parseDateOnly(apt.date), 'yyyy-MM-dd')
      const matchesDate = selectedDateRange?.from
        ? selectedDateRange.to
          ? aptDateStr >= format(selectedDateRange.from, 'yyyy-MM-dd') &&
            aptDateStr <= format(selectedDateRange.to, 'yyyy-MM-dd')
          : aptDateStr === format(selectedDateRange.from, 'yyyy-MM-dd')
        : true
      
      // Na aba "Todos", excluir cancelados
      const matchesStatus = statusFilter === 'all' 
        ? apt.status !== 'cancelled'
        : apt.status === statusFilter
      
      const matchesLocationFilter = locationFilter === 'all' || apt.locationId === locationFilter

      const matchesLocation = !advancedFilters.locationId || advancedFilters.locationId === 'all' || apt.locationId === advancedFilters.locationId
      
      const matchesNeighborhood = !advancedFilters.neighborhood || advancedFilters.neighborhood === 'all' ||
        (apt.neighborhood && apt.neighborhood.toLowerCase() === advancedFilters.neighborhood.toLowerCase())
      
      const appointmentDate = parseDateOnly(apt.date)
      const appointmentDateStr = format(appointmentDate, 'yyyy-MM-dd')
      const matchesMonth = !advancedFilters.month || advancedFilters.month === 'all' ||
        format(appointmentDate, 'MM') === advancedFilters.month
      
      const matchesYear = !advancedFilters.year || advancedFilters.year === 'all' ||
        format(appointmentDate, 'yyyy') === advancedFilters.year

      const matchesRgType = !advancedFilters.rgType || advancedFilters.rgType === 'all' || apt.rgType === advancedFilters.rgType
      const matchesDateFrom = !advancedFilters.dateFrom || appointmentDateStr >= advancedFilters.dateFrom
      const matchesDateTo = !advancedFilters.dateTo || appointmentDateStr <= advancedFilters.dateTo

      return matchesSearch &&
        matchesDate &&
        matchesStatus &&
        matchesLocationFilter &&
        matchesLocation &&
        matchesNeighborhood &&
        matchesMonth &&
        matchesYear &&
        matchesRgType &&
        matchesDateFrom &&
        matchesDateTo
    }).sort((a, b) => {
      const priorityA = priorityOrder[a.priority || 'normal']
      const priorityB = priorityOrder[b.priority || 'normal']
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      
      return a.time.localeCompare(b.time)
    })
  }, [appointments, searchTerm, selectedDateRange, statusFilter, locationFilter, advancedFilters])

  const appointmentsByDate = useMemo(() => getAppointmentsByDay(appointments), [appointments])

  const selectedAppointments = useMemo(() => {
    return appointments.filter(apt => selectedIds.has(apt.id))
  }, [appointments, selectedIds])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAppointments.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAppointments.map(apt => apt.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const ok = await confirm({
      title: 'Excluir agendamentos',
      description: `Tem certeza que deseja excluir ${selectedIds.size} agendamento(s)? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (ok) {
      onBulkDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
    }
  }

  const wasCalled = (appointment: Appointment) => {
    return (appointment.statusHistory || []).some((entry) =>
      (entry.reason || '').toLowerCase().includes('chamado')
    )
  }

  const openConfirmWithPriority = (appointment: Appointment) => {
    setAppointmentToConfirm(appointment)
    setSelectedPriority((appointment.priority || 'normal') as AppointmentPriority)
    setPriorityDialogOpen(true)
  }

  const closeConfirmWithPriority = () => {
    setPriorityDialogOpen(false)
    setAppointmentToConfirm(null)
    setSelectedPriority('normal')
  }

  const handleConfirmWithPriority = async () => {
    if (!appointmentToConfirm) return
    try {
      setConfirmingId(appointmentToConfirm.id)
      if (canChangePriority) {
        await Promise.resolve(onPriorityChange(appointmentToConfirm.id, selectedPriority))
      }
      await Promise.resolve(onStatusChange(appointmentToConfirm.id, 'confirmed'))
      closeConfirmWithPriority()
    } finally {
      setConfirmingId(null)
    }
  }

  const handleCallCitizen = (appointment: Appointment) => {
    onStatusChange(appointment.id, 'confirmed', `Cidadão ${appointment.fullName} chamado para atendimento.`)
    toast.success(`Chamando ${appointment.fullName}`)
  }

  const handleProfileDialogOpenChange = (open: boolean) => {
    setProfileDialogOpen(open)
    if (!open) {
      setProfileAppointment(null)
      setProfileForm(emptyPersonalInfo)
      setIsSavingProfile(false)
      setProfileErrors({})
    }
  }

  const openProfileDialog = (appointment: Appointment) => {
    setProfileAppointment(appointment)
    setProfileForm({
      fullName: appointment.fullName || '',
      email: appointment.email || '',
      phone: appointment.phone || '',
      street: appointment.street || '',
      number: appointment.number || '',
      neighborhood: appointment.neighborhood || '',
      cpf: appointment.cpf || '',
      regionType: appointment.regionType || '',
      sedeId: appointment.sedeId ? String(appointment.sedeId) : '',
      districtId: appointment.districtId ? String(appointment.districtId) : '',
      neighborhoodId: appointment.neighborhoodId ? String(appointment.neighborhoodId) : ''
    })
    setProfileDialogOpen(true)
  }

  const handleProfileFieldChange = (field: keyof PersonalInfoFields, value: string) => {
    let nextValue = value
    if (field === 'cpf') {
      nextValue = formatCPF(value)
      setProfileErrors(prev => ({ ...prev, cpf: '' }))
    } else if (field === 'phone') {
      nextValue = formatPhone(value)
    }
    setProfileForm(prev => ({ ...prev, [field]: nextValue }))
  }

  const handleProfileRegionTypeSelect = (value: string) => {
    setProfileForm(prev => ({
      ...prev,
      regionType: value || '',
      sedeId: value === 'Sede' ? prev.sedeId : '',
      districtId: value === 'Distrito' ? prev.districtId : '',
      neighborhoodId: '',
      neighborhood: ''
    }))
  }

  const handleProfileSedeSelect = (value: string) => {
    setProfileForm(prev => ({
      ...prev,
      regionType: prev.regionType === 'Sede' ? prev.regionType : 'Sede',
      sedeId: value,
      districtId: '',
      neighborhoodId: '',
      neighborhood: ''
    }))
  }

  const handleProfileDistrictSelect = (value: string) => {
    setProfileForm(prev => ({
      ...prev,
      regionType: prev.regionType === 'Distrito' ? prev.regionType : 'Distrito',
      districtId: value,
      sedeId: '',
      neighborhoodId: '',
      neighborhood: ''
    }))
  }

  const handleProfileNeighborhoodSelect = (value: string) => {
    if (!value) {
      setProfileForm(prev => ({ ...prev, neighborhoodId: '', neighborhood: '' }))
      return
    }
    const selectedNeighborhood = (addressOptions?.neighborhoods || []).find(item => item.id === value)
    setProfileForm(prev => ({
      ...prev,
      neighborhoodId: value,
      neighborhood: selectedNeighborhood?.nome || ''
    }))
  }

  const validateProfileCPF = (value: string) => {
    if (!validateCPF(value || '')) {
      setProfileErrors(prev => ({ ...prev, cpf: 'CPF inválido' }))
      return false
    }
    setProfileErrors(prev => ({ ...prev, cpf: '' }))
    return true
  }

  const handleSaveProfileInfo = async () => {
    if (!profileAppointment || !onUpdateAppointmentDetails) {
      toast.error('Não foi possível atualizar os dados do cidadão.')
      return
    }
    if (!validateProfileCPF(profileForm.cpf)) {
      toast.error('Informe um CPF válido antes de salvar.')
      return
    }

    try {
      setIsSavingProfile(true)
      await Promise.resolve(onUpdateAppointmentDetails(profileAppointment.id, profileForm))
      handleProfileDialogOpenChange(false)
    } catch (error) {
      console.error('[SecretaryPanel] Erro ao atualizar dados pessoais', error)
      toast.error('Não foi possível salvar as alterações.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const getTenantSlug = () => {
    if (typeof window === 'undefined') return null
    const segments = window.location.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null
    return segments[0]
  }

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const loadAddressOptions = async () => {
      setAddressOptionsLoading(true)
      setAddressOptionsError(null)
      try {
        const headers: Record<string, string> = {}
        if (typeof window !== 'undefined') {
          const storedTenantId = localStorage.getItem('tenantId')
          const storedTenantSlug = getTenantSlug() || localStorage.getItem('tenantSlug')
          if (storedTenantId) headers['x-tenant-id'] = storedTenantId
          else if (storedTenantSlug) headers['x-prefeitura-slug'] = storedTenantSlug
        }

        const response = await fetch('/api/public/address-options', {
          signal: controller.signal,
          headers
        })
        if (!response.ok) throw new Error(`Falha ao carregar catálogo de regiões (${response.status})`)
        const payload = await response.json()
        if (!isMounted) return

        const normalizeLocality = (collection: any[] = []) =>
          collection.map((item) => ({
            id: String(item.id),
            nome: item.nome || item.name || ''
          }))

        const headquarters = normalizeLocality(payload.sedes || payload.headquarters || [])
        const districts = normalizeLocality(payload.distritos || payload.districts || [])
        const neighborhoods = (payload.bairros || payload.neighborhoods || []).map((item: any) => {
          const rawParent =
            item.localidadeId ??
            item.localidade_id ??
            item.distritoId ??
            item.districtId ??
            item.parent_id ??
            null
          const normalizedParent = rawParent === undefined || rawParent === null ? null : String(rawParent)
          const declaredType = item.parentType || item.parent_type
          let parentType: 'Sede' | 'Distrito' | undefined
          if (declaredType === 'Sede' || declaredType === 'Distrito') parentType = declaredType
          else if (normalizedParent && headquarters.some((hq: AddressLocalityOption) => hq.id === normalizedParent)) parentType = 'Sede'
          else if (normalizedParent && districts.some((district: AddressLocalityOption) => district.id === normalizedParent)) parentType = 'Distrito'
          return {
            id: String(item.id),
            nome: item.nome || item.name || '',
            localidadeId: normalizedParent,
            parentType
          }
        })

        setAddressOptions({ headquarters, districts, neighborhoods })
      } catch (error) {
        if (!isMounted) return
        const err = error as Error
        if (err.name === 'AbortError') return
        console.error('[SecretaryPanel] Erro ao buscar regiões cadastradas', error)
        setAddressOptionsError('Não foi possível carregar as regiões cadastradas.')
        setAddressOptions(null)
      } finally {
        if (isMounted) setAddressOptionsLoading(false)
      }
    }

    loadAddressOptions()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  const getPreviousStatus = (appointment: Appointment): AppointmentStatus | null => {
    const normalizeStatus = (value?: string | null): AppointmentStatus | null => {
      if (!value) return null
      const normalized = String(value).toLowerCase()
      if (normalized === 'cancelado') return 'cancelled'
      if (normalized === 'pendente') return 'pending'
      if (normalized === 'concluido') return 'completed'
      if (normalized === 'confirmado') return 'confirmed'
      return value as AppointmentStatus
    }

    const currentStatus = normalizeStatus(appointment.status)
    const history = appointment.statusHistory || []
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const entry = history[index]
      const from = normalizeStatus(entry.from)
      const to = normalizeStatus(entry.to)

      if (!from || !to) continue
      if (from === to) continue
      if (to === currentStatus && from !== currentStatus) {
        return from
      }
    }
    return null
  }

  const canEditProfile = profileAppointment ?
    !['completed', 'cin-delivered', 'cancelled'].includes(profileAppointment.status) : false
  const rawHeadquarters = addressOptions?.headquarters ?? []
  const rawDistricts = addressOptions?.districts ?? []
  const allAddressNeighborhoods = addressOptions?.neighborhoods ?? []
  const headquarters = useMemo(() => {
    if (!rawHeadquarters.length || !allAddressNeighborhoods.length) return []
    const headquarterIds = new Set(rawHeadquarters.map((item) => item.id))
    const linkedIds = new Set<string>()
    allAddressNeighborhoods.forEach((neighborhood) => {
      if (!neighborhood.localidadeId) return
      if (neighborhood.parentType === 'Distrito') return
      if (neighborhood.parentType === 'Sede' || headquarterIds.has(neighborhood.localidadeId)) {
        linkedIds.add(neighborhood.localidadeId)
      }
    })
    return rawHeadquarters.filter((headquarter) => linkedIds.has(headquarter.id))
  }, [rawHeadquarters, allAddressNeighborhoods])
  const districts = useMemo(() => {
    if (!rawDistricts.length || !allAddressNeighborhoods.length) return []
    const districtIds = new Set(rawDistricts.map((item) => item.id))
    const linkedIds = new Set<string>()
    allAddressNeighborhoods.forEach((neighborhood) => {
      if (!neighborhood.localidadeId) return
      if (neighborhood.parentType === 'Sede') return
      if (neighborhood.parentType === 'Distrito' || districtIds.has(neighborhood.localidadeId)) {
        linkedIds.add(neighborhood.localidadeId)
      }
    })
    return rawDistricts.filter((district) => linkedIds.has(district.id))
  }, [rawDistricts, allAddressNeighborhoods])
  const hasStructuredAddress = headquarters.length > 0 || districts.length > 0
  const selectedLocalityId = profileForm.regionType === 'Sede'
    ? profileForm.sedeId
    : profileForm.regionType === 'Distrito'
      ? profileForm.districtId
      : ''
  const filteredAddressNeighborhoods = useMemo(() => {
    if (!selectedLocalityId) return []
    return allAddressNeighborhoods.filter(
      (item) => item.localidadeId && item.localidadeId === selectedLocalityId
    )
  }, [allAddressNeighborhoods, selectedLocalityId])
  const canSelectNeighborhood = Boolean(
    profileForm.regionType &&
      ((profileForm.regionType === 'Sede' && profileForm.sedeId) ||
        (profileForm.regionType === 'Distrito' && profileForm.districtId))
  )
  const shouldRenderNeighborhoodSelect = hasStructuredAddress && canSelectNeighborhood && filteredAddressNeighborhoods.length > 0
  const noNeighborhoodsForSelection = hasStructuredAddress && canSelectNeighborhood && filteredAddressNeighborhoods.length === 0

  return (
    <div className="min-h-screen bg-background p-3 md:p-6 overflow-x-hidden">
      {ConfirmDialogNode}
      <ScrollToTop />
      <div className="max-w-7xl mx-auto">
        {/* Título: ocultado no mobile pois App.tsx já exibe no header fixo */}
        <div className="mb-4 md:mb-8">
          <div className="hidden md:block mb-4">
            <h1 className="text-3xl font-semibold text-foreground mb-2">Painel da Secretaria</h1>
            <p className="text-muted-foreground">Gerencie todos os agendamentos de CIN</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewReports && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStats(!showStats)}
                  className="gap-1.5 text-xs"
                >
                  <CalendarBlank size={15} />
                  <span className="hidden sm:inline">{showStats ? 'Ocultar' : 'Mostrar'} </span>Estatísticas
                </Button>
                <AuditReport appointments={appointments} />
              </>
            )}
            <NotificationViewer appointments={appointments} />
            {canExportData && (
              <ExportMenu appointments={appointments} selectedAppointments={selectedAppointments} />
            )}
          </div>
        </div>

        {!currentUser.isAdmin && (
          <Card className="mb-6 border-blue-200 bg-blue-50/30">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <User size={20} weight="duotone" className="text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2">Suas Permissões de Acesso</h3>
                  <div className="flex flex-wrap gap-2">
                    {canConfirmAppointment && <Badge variant="secondary" className="text-xs">✓ Confirmar</Badge>}
                    {canCompleteAppointment && <Badge variant="secondary" className="text-xs">✓ Concluir</Badge>}
                    {canReschedule && <Badge variant="secondary" className="text-xs">✓ Reagendar</Badge>}
                    {canCancel && <Badge variant="secondary" className="text-xs">✓ Cancelar</Badge>}
                    {canDeleteAppointment && <Badge variant="secondary" className="text-xs">✓ Excluir</Badge>}
                    {canChangePriority && <Badge variant="secondary" className="text-xs">✓ Prioridade</Badge>}
                    {canAddNotes && <Badge variant="secondary" className="text-xs">✓ Notas</Badge>}
                    {canViewReports && <Badge variant="secondary" className="text-xs">✓ Relatórios</Badge>}
                    {canExportData && <Badge variant="secondary" className="text-xs">✓ Exportar</Badge>}
                    {canBulkDelete && <Badge variant="secondary" className="text-xs">✓ Excluir em Massa</Badge>}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {canViewReports && showStats && (
          <div className="mb-8">
            <StatsDashboard appointments={appointments} locations={locations} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4 min-w-0">
            <FilterMenu 
              locations={locations}
              neighborhoods={appointmentNeighborhoods}
              onFilterChange={setAdvancedFilters}
              currentFilters={advancedFilters}
            />

            <Card className="card-neon p-4 w-full overflow-hidden">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <CalendarBlank size={20} weight="duotone" />
                Filtrar por Data
              </h2>
              <div className="w-full" style={{ overflowX: 'auto' }}>
                <Calendar
                  mode="range"
                  selected={selectedDateRange}
                  onSelect={setSelectedDateRange}
                  locale={ptBR}
                  defaultMonth={selectedDateRange?.from || new Date()}
                  className="rounded-md border"
                  classNames={{
                    months: 'flex flex-col',
                    month: 'space-y-2',
                    caption: 'flex justify-center pt-1 relative items-center',
                    caption_label: 'text-sm font-medium',
                    nav: 'space-x-1 flex items-center',
                    nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center',
                    nav_button_previous: 'absolute left-1',
                    nav_button_next: 'absolute right-1',
                    table: 'w-full border-collapse',
                    head_row: 'flex',
                    head_cell: 'text-muted-foreground rounded-md w-8 font-normal text-[0.7rem] text-center',
                    row: 'flex w-full mt-1',
                    cell: 'h-8 w-8 text-center text-sm p-0 relative',
                    day: 'h-8 w-8 p-0 font-normal rounded-md hover:bg-accent/30 transition-colors',
                    day_selected: 'bg-primary text-primary-foreground hover:bg-primary',
                    day_today: 'bg-accent/20 font-bold',
                    day_outside: 'opacity-30',
                    day_disabled: 'opacity-30 cursor-not-allowed',
                  }}
                  modifiers={{
                    hasAppointments: (date) => {
                      const dateStr = format(date, 'yyyy-MM-dd')
                      return !!appointmentsByDate[dateStr]
                    }
                  }}
                  modifiersClassNames={{
                    hasAppointments: 'bg-accent/20 font-bold'
                  }}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const todayDate = new Date()
                    setSelectedDateRange({ from: todayDate, to: todayDate })
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedDateRange(undefined)}
                >
                  Limpar
                </Button>
              </div>
              {selectedDateRange?.from && (
                <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-center">
                    {selectedDateRange.to
                      ? `📅 Filtrando: ${format(selectedDateRange.from, 'dd/MM/yyyy', { locale: ptBR })} até ${format(selectedDateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`
                      : `📅 Filtrando: ${format(selectedDateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-6 space-y-4">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, CPF ou protocolo..."
                    className="h-12 pl-10 text-base"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={statusFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                      >
                        Todos
                      </Button>
                      {statusFilterOptions.map(([status, config]) => (
                        <Button
                          key={status}
                          variant={statusFilter === status ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStatusFilter(status as AppointmentStatus)}
                        >
                          {config.label}
                        </Button>
                      ))}
                    </div>

                    {canBulkDelete && selectedIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        className="gap-2"
                      >
                        <Trash size={16} />
                        Excluir ({selectedIds.size})
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin size={18} className="text-muted-foreground" weight="duotone" />
                    <span className="text-sm font-medium text-foreground">Local de Atendimento:</span>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={locationFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLocationFilter('all')}
                      >
                        Todas
                      </Button>
                      {locations.map((location) => (
                        <Button
                          key={location.id}
                          variant={locationFilter === location.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLocationFilter(location.id)}
                          className="gap-1"
                        >
                          <MapPin size={14} weight="fill" />
                          {location.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {canBulkDelete && filteredAppointments.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedIds.size === filteredAppointments.length}
                      onCheckedChange={toggleSelectAll}
                      id="select-all"
                    />
                    <label htmlFor="select-all" className="text-muted-foreground cursor-pointer">
                      Selecionar todos ({filteredAppointments.length})
                    </label>
                  </div>
                )}
              </div>

              <div className="relative">
                <ScrollArea className="h-[600px] pr-4" data-scroll-container>
                  {filteredAppointments.length === 0 ? (
                    <div className="text-center py-12">
                      <CalendarBlank className="mx-auto text-muted-foreground mb-4" size={64} />
                      <p className="text-lg text-muted-foreground">Nenhum agendamento encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredAppointments.map((appointment) => {
                        const previousStatus = getPreviousStatus(appointment)
                        const appointmentLocationName = resolveAppointmentLocationName(appointment)
                        const firstName = (appointment.fullName || '').split(' ')[0] || 'cidadão'
                        const canRollback = Boolean(previousStatus) && appointment.status !== 'cancelled'
                        return (
                      <Card key={appointment.id} className="card-shadow-intense p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          {canBulkDelete && (
                            <Checkbox
                              checked={selectedIds.has(appointment.id)}
                              onCheckedChange={() => toggleSelection(appointment.id)}
                              className="mt-1"
                            />
                          )}
                          
                          <div className="flex-1 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <button
                                    type="button"
                                    onClick={() => openProfileDialog(appointment)}
                                    className="text-lg font-semibold text-foreground hover:text-primary text-left"
                                  >
                                    {appointment.fullName}
                                  </button>
                                  <Badge className={cn('border', getStatusVisual(appointment.status).color)}>
                                    {getStatusVisual(appointment.status).label}
                                  </Badge>
                                  {appointment.priority && appointment.priority !== 'normal' && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        appointment.priority === 'urgent' ? 'border-red-500 text-red-700 bg-red-50' :
                                        appointment.priority === 'high' ? 'border-orange-500 text-orange-700 bg-orange-50' :
                                        ''
                                      )}
                                    >
                                      {appointment.priority === 'urgent' ? '🔴 Urgente' : '🟠 Alta'}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Protocolo: <span className="font-mono font-semibold">{appointment.protocol}</span>
                                </p>
                              </div>
                              
                              <div className="flex flex-col sm:items-end gap-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <CalendarBlank className="text-primary" size={16} />
                                  <span className="font-medium">
                                    {format(parseDateOnly(appointment.date), "dd/MM/yyyy")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="text-primary" size={16} />
                                  <span className="font-medium">{appointment.time}</span>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <IdentificationCard className="text-muted-foreground" size={16} />
                                <span className="text-muted-foreground">CPF:</span>
                                <span className="font-medium">{appointment.cpf}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="text-muted-foreground" size={16} />
                                <span className="text-muted-foreground">Tel:</span>
                                <span className="font-medium">{appointment.phone}</span>
                              </div>
                              {appointment.rg && (
                                <div className="flex items-center gap-2">
                                  <IdentificationCard className="text-muted-foreground" size={16} />
                                  <span className="text-muted-foreground">CIN:</span>
                                  <span className="font-medium">{appointment.rg}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <EnvelopeSimple className="text-muted-foreground" size={16} />
                                <span className="font-medium text-sm">{appointment.email}</span>
                              </div>
                            </div>

                            {(appointment.locationId || appointment.neighborhood || appointmentLocationName !== 'Não informado') && (
                              <>
                                <Separator />
                                <div className="space-y-2 text-sm">
                                  {(appointment.locationId || appointmentLocationName !== 'Não informado') && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="text-primary mt-0.5" size={16} weight="duotone" />
                                      <div>
                                        <span className="text-muted-foreground">Local: </span>
                                        <span className="font-medium">
                                          {appointmentLocationName}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {appointment.neighborhood && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="text-muted-foreground mt-0.5" size={16} />
                                      <div>
                                        <span className="text-muted-foreground">Bairro/Comunidade do usuário: </span>
                                        <span className="font-medium">{appointment.neighborhood}</span>
                                        {(appointment.street || appointment.number) && (
                                          <span className="text-muted-foreground ml-1">
                                            ({[appointment.street, appointment.number].filter(Boolean).join(', ')})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}

                            {appointment.customFieldValues && Object.keys(appointment.customFieldValues).length > 0 && (
                              <>
                                <Separator />
                                <div className="space-y-2 text-sm">
                                  <h4 className="font-semibold text-foreground mb-2">Informações Adicionais</h4>
                                  {Object.entries(appointment.customFieldValues).map(([fieldId, value]) => {
                                    if (!value) return null
                                    const customFieldMeta = customFields.find((field) => field.id === fieldId || field.name === fieldId)
                                    const fieldLabel = customFieldMeta?.label || fieldId.replace('custom_', '').replace(/_/g, ' ')
                                    return (
                                      <div key={fieldId} className="flex items-start gap-2">
                                        <User className="text-muted-foreground mt-0.5" size={16} />
                                        <div>
                                          <span className="text-muted-foreground">{fieldLabel}: </span>
                                          <span className="font-medium">{value}</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </>
                            )}

                            <Separator />

                            <div className="flex gap-2 flex-wrap">
                              {appointment.status === 'awaiting-issuance' && (
                                <div className="w-full p-3 rounded-lg bg-purple-50 border border-purple-200 mb-2">
                                  <div className="flex items-center gap-2 text-purple-700">
                                    <Package size={18} weight="duotone" />
                                    <span className="font-semibold text-sm">CIN aguardando emissão</span>
                                  </div>
                                  <p className="text-xs text-purple-600 mt-1">
                                    Documento está em produção na unidade emissora. Assim que a CIN ficar pronta, mova para "CIN Pronta".
                                  </p>
                                </div>
                              )}
                              {appointment.status === 'cin-ready' && (
                                <div className="w-full p-3 rounded-lg bg-indigo-50 border border-indigo-200 mb-2">
                                  <div className="flex items-center gap-2 text-indigo-700">
                                    <Package size={18} weight="duotone" />
                                    <span className="font-semibold text-sm">CIN pronta para retirada!</span>
                                  </div>
                                  <p className="text-xs text-indigo-600 mt-1">
                                    Este CIN está aguardando retirada pelo cidadão. Vá para a aba "Entrega CIN" para registrar a entrega.
                                  </p>
                                </div>
                              )}
                              {appointment.status === 'cin-delivered' && appointment.rgDelivery && (
                                <div className="w-full p-3 rounded-lg bg-teal-50 border border-teal-200 mb-2">
                                  <div className="flex items-center gap-2 text-teal-700 mb-2">
                                    <CheckCircle size={18} weight="fill" />
                                    <span className="font-semibold text-sm">CIN entregue com sucesso!</span>
                                  </div>
                                  <div className="text-xs text-teal-600 space-y-1">
                                    <p><strong>Recebido por:</strong> {appointment.rgDelivery.receivedByName}</p>
                                    <p><strong>Documento:</strong> {appointment.rgDelivery.receivedByDocument}</p>
                                    <p><strong>Data/Hora:</strong> {format(parseISO(appointment.rgDelivery.deliveredAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                                    <p><strong>Entregue por:</strong> {appointment.rgDelivery.deliveredBy}</p>
                                    {appointment.rgDelivery.notes && (
                                      <p className="italic mt-2 p-2 bg-white/50 rounded">"{appointment.rgDelivery.notes}"</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="button-shine gap-2"
                                  >
                                    <ClockCounterClockwise size={16} />
                                    Histórico
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Histórico de Auditoria - {appointment.fullName}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Protocolo:</span>
                                        <span className="font-mono font-semibold ml-2">{appointment.protocol}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">CPF:</span>
                                        <span className="font-medium ml-2">{appointment.cpf}</span>
                                      </div>
                                    </div>
                                    <Separator />
                                    <AuditHistory 
                                      history={appointment.statusHistory || []} 
                                      appointmentId={appointment.id}
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                              {canRollback && previousStatus && (
                                <StatusChangeDialog
                                  currentStatus={appointment.status}
                                  newStatus={previousStatus}
                                  onConfirm={(reason) => onStatusChange(
                                    appointment.id,
                                    previousStatus,
                                    reason || `Status revertido de ${appointment.status} para ${previousStatus}`
                                  )}
                                  triggerButton={
                                    <Button size="sm" variant="outline" className="gap-2">
                                      <ClockCounterClockwise size={16} />
                                      Voltar status
                                    </Button>
                                  }
                                />
                              )}
                              <>
                              {canCompleteAppointment &&
                                appointment.status === 'confirmed' &&
                                (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleCallCitizen(appointment)}
                                  >
                                    <MegaphoneSimple size={16} />
                                    {wasCalled(appointment) ? `Rechamar ${firstName}` : `Chamar ${firstName}`}
                                  </Button>
                                )}
                              {canCompleteAppointment &&
                                appointment.status === 'confirmed' &&
                                wasCalled(appointment) && (
                                <StatusChangeDialog
                                  currentStatus={appointment.status}
                                  newStatus="completed"
                                  onConfirm={(reason) => onStatusChange(appointment.id, 'completed', reason)}
                                  triggerButton={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="button-glow text-accent border-accent hover:bg-accent hover:text-accent-foreground"
                                    >
                                      <CheckCircle size={16} className="mr-1" />
                                      Concluir Atendimento
                                    </Button>
                                  }
                                />
                              )}
                                {canCompleteAppointment && appointment.status === 'awaiting-issuance' && (
                                  <StatusChangeDialog
                                    currentStatus={appointment.status}
                                    newStatus="cin-ready"
                                    onConfirm={(reason) => onStatusChange(appointment.id, 'cin-ready', reason)}
                                    triggerButton={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                      >
                                        <Package size={16} />
                                        Marcar CIN Pronta
                                      </Button>
                                    }
                                  />
                                )}
                                {canCompleteAppointment && appointment.status === 'cin-ready' && (
                                  <StatusChangeDialog
                                    currentStatus={appointment.status}
                                    newStatus="awaiting-issuance"
                                    onConfirm={(reason) => onStatusChange(appointment.id, 'awaiting-issuance', reason)}
                                    triggerButton={
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-2 text-purple-700 hover:bg-purple-50"
                                      >
                                        <ClockCounterClockwise size={16} />
                                        Reverter para Emissão
                                      </Button>
                                    }
                                  />
                                )}
                              {canCancel && !['completed', 'awaiting-issuance', 'cin-ready', 'cin-delivered', 'cancelled', 'cancelado'].includes(appointment.status) && (
                                <StatusChangeDialog
                                  currentStatus={appointment.status}
                                  newStatus="cancelled"
                                  onConfirm={(reason) => onStatusChange(appointment.id, 'cancelled', reason)}
                                  triggerButton={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    >
                                      <XCircle size={16} className="mr-1" />
                                      Cancelar
                                    </Button>
                                  }
                                />
                              )}
                              {canConfirmAppointment && appointment.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="button-glow gap-1"
                                  onClick={() => openConfirmWithPriority(appointment)}
                                >
                                  <CheckCircle size={16} />
                                  Confirmar Agendamento
                                </Button>
                              )}
                              {canReschedule && !['completed', 'awaiting-issuance', 'cin-ready', 'cin-delivered'].includes(appointment.status) && (
                                <RescheduleDialog
                                  appointment={appointment}
                                  allAppointments={appointments}
                                  workingHours={workingHours}
                                  maxAppointmentsPerSlot={maxAppointmentsPerSlot}
                                  blockedDates={blockedDates}
                                  maxAdvanceDays={bookingWindowDays}
                                  onReschedule={onReschedule}
                                />
                              )}
                              {canAddNotes && (
                                <AppointmentNotes
                                  appointment={appointment}
                                  onAddNote={onAddNote}
                                  onDeleteNote={onDeleteNote}
                                  contextLabel={getStatusVisual(appointment.status).label.toUpperCase()}
                                />
                              )}
                              </>
                            </div>
                          </div>
                        </div>
                      </Card>
                        )
                      })}
                  </div>
                )}
              </ScrollArea>
              <ScrollProgressIndicator />
            </div>
            </Card>
          </div>
        </div>
      </div>
      <Dialog open={priorityDialogOpen} onOpenChange={(open) => !open && closeConfirmWithPriority()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Definir prioridade antes de confirmar</DialogTitle>
          </DialogHeader>
          {appointmentToConfirm && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3">
                <p className="font-semibold">{appointmentToConfirm.fullName}</p>
                <p className="text-xs text-muted-foreground">Protocolo {appointmentToConfirm.protocol}</p>
              </div>
              <RadioGroup
                value={selectedPriority}
                onValueChange={(value) => setSelectedPriority(value as AppointmentPriority)}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <RadioGroupItem value="normal" id="priority-normal-secretary" />
                  <Label htmlFor="priority-normal-secretary">Normal</Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <RadioGroupItem value="high" id="priority-high-secretary" />
                  <Label htmlFor="priority-high-secretary">Alta</Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <RadioGroupItem value="urgent" id="priority-urgent-secretary" />
                  <Label htmlFor="priority-urgent-secretary">Urgente</Label>
                </div>
              </RadioGroup>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeConfirmWithPriority}>Cancelar</Button>
                <Button onClick={handleConfirmWithPriority} disabled={confirmingId === appointmentToConfirm.id}>
                  {confirmingId === appointmentToConfirm.id ? 'Confirmando...' : 'Salvar prioridade e confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={profileDialogOpen} onOpenChange={handleProfileDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User size={22} className="text-emerald-600" />
              Dados do cidadão
            </DialogTitle>
            <DialogDescription>
              Visualize e atualize os dados de contato e endereço antes da conclusão do atendimento.
            </DialogDescription>
          </DialogHeader>
          {profileAppointment && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-muted bg-muted/40 p-4 text-sm space-y-1">
                {canEditProfile ? (
                  <input
                    type="text"
                    aria-label="Nome completo"
                    value={profileForm.fullName}
                    onChange={(event) => handleProfileFieldChange('fullName', event.target.value)}
                    className="w-full bg-transparent text-base font-semibold text-foreground border-none focus:outline-none focus-visible:ring-0"
                  />
                ) : (
                  <p className="font-semibold text-foreground">{profileForm.fullName}</p>
                )}
                <p className="text-xs text-muted-foreground">Protocolo {profileAppointment.protocol}</p>
                <p className="text-xs text-muted-foreground">
                  Status atual: {getStatusVisual(profileAppointment.status).label}
                </p>
                {profileAppointment.rgType && (
                  <p className="text-xs text-muted-foreground">
                    Tipo de CIN: {profileAppointment.rgType}
                  </p>
                )}
                {profileAppointment.gender && (
                  <p className="text-xs text-muted-foreground">
                    Gênero: {profileAppointment.gender.replace('Outro:', 'Outro: ')}
                  </p>
                )}
              </div>

              {(profileAppointment.regionType || profileAppointment.street || profileAppointment.neighborhood) && (
                <div className="rounded-2xl border border-muted bg-muted/40 p-4 text-sm space-y-1">
                  <p className="text-xs font-semibold text-foreground mb-1">Endereço Residencial</p>
                  {profileAppointment.street && (
                    <p className="text-xs text-muted-foreground">
                      Logradouro: {profileAppointment.street}{profileAppointment.number ? `, Nº ${profileAppointment.number}` : ''}
                    </p>
                  )}
                  {profileAppointment.neighborhood && (
                    <p className="text-xs text-muted-foreground">Bairro/Comunidade: {profileAppointment.neighborhood}</p>
                  )}
                  {profileAppointment.regionType && (
                    <p className="text-xs text-muted-foreground">
                      Região: {profileAppointment.regionType} - {profileAppointment.regionName || profileAppointment.sedeId || profileAppointment.districtId}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="citizen-email">Email</Label>
                  <Input
                    id="citizen-email"
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => handleProfileFieldChange('email', event.target.value)}
                    disabled={!canEditProfile}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="citizen-phone">Telefone</Label>
                  <Input
                    id="citizen-phone"
                    value={profileForm.phone}
                    onChange={(event) => handleProfileFieldChange('phone', event.target.value)}
                    disabled={!canEditProfile}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="citizen-cpf">CPF</Label>
                  <Input
                    id="citizen-cpf"
                    value={profileForm.cpf}
                    onChange={(event) => handleProfileFieldChange('cpf', event.target.value)}
                    disabled={!canEditProfile}
                    placeholder="000.000.000-00"
                    onBlur={() => validateProfileCPF(profileForm.cpf)}
                    className={cn(profileErrors.cpf && 'border-rose-500 focus-visible:ring-rose-500')}
                  />
                  {profileErrors.cpf && (
                    <p className="text-xs font-medium text-rose-600">{profileErrors.cpf}</p>
                  )}
                </div>
                {hasStructuredAddress ? (
                  <div className="space-y-2">
                    <Label>Região (Sede ou Distrito)</Label>
                    <Select
                      value={profileForm.regionType || SELECT_EMPTY_VALUE}
                      onValueChange={(value) =>
                        handleProfileRegionTypeSelect(value === SELECT_EMPTY_VALUE ? '' : value)
                      }
                      disabled={!canEditProfile || addressOptionsLoading}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder={addressOptionsLoading ? 'Carregando catálogos...' : 'Selecione a região'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sede">Sede</SelectItem>
                        <SelectItem value="Distrito">Distrito</SelectItem>
                        <SelectItem value={SELECT_EMPTY_VALUE}>Limpar seleção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="citizen-neighborhood">Bairro / Comunidade</Label>
                    <Input
                      id="citizen-neighborhood"
                      value={profileForm.neighborhood}
                      onChange={(event) => handleProfileFieldChange('neighborhood', event.target.value)}
                      disabled={!canEditProfile}
                    />
                  </div>
                )}
              </div>

              {hasStructuredAddress && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{profileForm.regionType === 'Distrito' ? 'Distrito' : profileForm.regionType === 'Sede' ? 'Sede' : 'Unidade'}</Label>
                    {profileForm.regionType === 'Sede' ? (
                      <Select
                        value={profileForm.sedeId || SELECT_EMPTY_VALUE}
                        onValueChange={(value) =>
                          handleProfileSedeSelect(value === SELECT_EMPTY_VALUE ? '' : value)
                        }
                        disabled={!canEditProfile || addressOptionsLoading || headquarters.length === 0}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder={addressOptionsLoading ? 'Carregando sedes...' : 'Selecione a sede'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SELECT_EMPTY_VALUE}>Limpar seleção</SelectItem>
                          {headquarters.map((headquarter) => (
                            <SelectItem key={headquarter.id} value={headquarter.id}>
                              {headquarter.nome || `Sede ${headquarter.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : profileForm.regionType === 'Distrito' ? (
                      <Select
                        value={profileForm.districtId || SELECT_EMPTY_VALUE}
                        onValueChange={(value) =>
                          handleProfileDistrictSelect(value === SELECT_EMPTY_VALUE ? '' : value)
                        }
                        disabled={!canEditProfile || addressOptionsLoading || districts.length === 0}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder={addressOptionsLoading ? 'Carregando distritos...' : 'Selecione o distrito'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SELECT_EMPTY_VALUE}>Limpar seleção</SelectItem>
                          {districts.map((district) => (
                            <SelectItem key={district.id} value={district.id}>
                              {district.nome || `Distrito ${district.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        Defina se o cidadão pertence à Sede ou a um Distrito para listar as unidades disponíveis.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro / Comunidade</Label>
                    {shouldRenderNeighborhoodSelect ? (
                      <Select
                        value={profileForm.neighborhoodId || SELECT_EMPTY_VALUE}
                        onValueChange={(value) =>
                          handleProfileNeighborhoodSelect(value === SELECT_EMPTY_VALUE ? '' : value)
                        }
                        disabled={!canEditProfile || addressOptionsLoading}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder={addressOptionsLoading ? 'Carregando bairros...' : 'Selecione o bairro'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SELECT_EMPTY_VALUE}>Limpar seleção</SelectItem>
                          {filteredAddressNeighborhoods.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {canSelectNeighborhood
                          ? noNeighborhoodsForSelection
                            ? 'Nenhum bairro cadastrado para esta unidade.'
                            : 'Selecione um bairro cadastrado.'
                          : 'Escolha a região e a unidade para listar os bairros disponíveis.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasStructuredAddress && (
                <div className="space-y-1 text-xs">
                  {addressOptionsLoading && (
                    <p className="text-muted-foreground">Carregando catálogo de regiões...</p>
                  )}
                  {addressOptionsError && (
                    <p className="text-rose-600">{addressOptionsError}</p>
                  )}
                </div>
              )}
              {!hasStructuredAddress && addressOptionsError && (
                <p className="text-xs text-rose-600">{addressOptionsError}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
                <div className="space-y-2">
                  <Label htmlFor="citizen-street">Logradouro</Label>
                  <Input
                    id="citizen-street"
                    value={profileForm.street}
                    onChange={(event) => handleProfileFieldChange('street', event.target.value)}
                    disabled={!canEditProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="citizen-number">Número</Label>
                  <Input
                    id="citizen-number"
                    value={profileForm.number}
                    onChange={(event) => handleProfileFieldChange('number', event.target.value)}
                    disabled={!canEditProfile}
                  />
                </div>
              </div>

              {!canEditProfile && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
                  Este atendimento já foi concluído. Os dados podem ser consultados, porém não são mais editáveis.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleProfileDialogOpenChange(false)}>Fechar</Button>
            <Button onClick={handleSaveProfileInfo} disabled={!canEditProfile || isSavingProfile || !onUpdateAppointmentDetails}>
              {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
