import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { format, parseISO, differenceInCalendarDays, isSameDay, startOfDay, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarBlank, Clock, ClockCounterClockwise, MapPin, User, MagnifyingGlass, Hourglass, ChatCircleText, CheckCircle, IdentificationCard, MegaphoneSimple, SpeakerHigh, XCircle, Trash, UserMinus, DotsThree } from '@phosphor-icons/react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import type { DateRange } from 'react-day-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Appointment, Location, AppointmentStatus, AppointmentPriority, StatusChangeHistory, BlockedDate } from '@/lib/types'
import { cn } from '@/lib/utils'
import { validateCPF, formatCPF, formatPhone } from '@/lib/validators'
import { StatusChangeDialog } from '@/components/StatusChangeDialog'
import { RescheduleDialog } from '@/components/RescheduleDialog'
import { BLOCK_WINDOW_DAYS, isRescheduleBlocked, MAX_RESCHEDULES_PER_WINDOW } from '@/lib/appointment-limits'
import { AppointmentNotes } from '@/components/AppointmentNotes'

const completionStatuses: AppointmentStatus[] = ['completed', 'awaiting-issuance', 'cin-ready', 'cin-delivered']

const statusDisplay: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  confirmed: { label: 'Confirmado', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
  completed: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  cancelled: { label: 'Cancelado', className: 'bg-rose-100 text-rose-800 border border-rose-200' },
  'awaiting-issuance': { label: 'Em Emissão', className: 'bg-purple-100 text-purple-800 border border-purple-200' },
  'cin-ready': { label: 'CIN Pronta', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  'cin-delivered': { label: 'CIN Entregue', className: 'bg-teal-100 text-teal-800 border border-teal-200' }
}

const calledStatusBadge = { label: 'Chamado', className: 'bg-purple-100 text-purple-800 border border-purple-200' }

const priorityOrder: Record<AppointmentPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2
}

const priorityBadges: Record<AppointmentPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 border border-red-200' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  normal: { label: 'Normal', className: 'bg-slate-100 text-slate-700 border border-slate-200' }
}

const priorityOptions: { value: AppointmentPriority; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Atendimento regular' },
  { value: 'high', label: 'Alta', description: 'Requer atenção especial' },
  { value: 'urgent', label: 'Urgente', description: 'Prioridade máxima' }
]

const priorityAccent: Record<AppointmentPriority, string> = {
  normal: 'text-emerald-700',
  high: 'text-amber-600',
  urgent: 'text-red-600'
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'call' | 'completed' | 'cancelled'
type TimeFilter = 'today' | 'week' | 'all'
type CancelledCategoryFilter = 'all' | 'no-show' | 'other'

type CalledAppointment = {
  appointment: Appointment
  room: string
  booth: string | null
  locationName: string
  calledAt: string
}

const DEFAULT_BOARD_WORKING_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

const DEFAULT_BOARD_MAX_PER_SLOT = 2
const SECRETARY_SESSION_USER_KEY = 'secretary_session_user_v1'
const CALL_HISTORY_STORAGE_KEY = 'callAnnouncementsHistory'
type CancelReasonType = 'a-pedido' | 'faltou' | 'outro'
type PersonalInfoFields = Pick<Appointment,
  'fullName' | 'email' | 'phone' | 'street' | 'number' | 'neighborhood' | 'cpf' | 'regionType' | 'sedeId' | 'districtId' | 'neighborhoodId'
>

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

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Confirmado', value: 'confirmed' },
  { label: 'Chamados', value: 'call' },
  { label: 'Concluído', value: 'completed' },
  { label: 'Cancelado', value: 'cancelled' }
]

const statusTabStyles: Record<StatusFilter, { active: string; inactive: string }> = {
  all: {
    active: 'bg-slate-700 text-white border-slate-700 shadow-sm',
    inactive: 'border-slate-200 text-slate-600 hover:bg-slate-50'
  },
  pending: {
    active: 'bg-yellow-500 text-white border-yellow-500 shadow-sm',
    inactive: 'border-yellow-200 text-yellow-700 hover:bg-yellow-50'
  },
  confirmed: {
    active: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    inactive: 'border-blue-200 text-blue-700 hover:bg-blue-50'
  },
  call: {
    active: 'bg-purple-600 text-white border-purple-600 shadow-sm',
    inactive: 'border-purple-200 text-purple-700 hover:bg-purple-50'
  },
  completed: {
    active: 'bg-emerald-500 text-white border-emerald-500 shadow-sm',
    inactive: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
  },
  cancelled: {
    active: 'bg-red-500 text-white border-red-500 shadow-sm',
    inactive: 'border-red-200 text-red-700 hover:bg-red-50'
  }
}

const timeTabs: { label: string; value: TimeFilter; helper: string }[] = [
  { label: 'Hoje', value: 'today', helper: 'Agendados para hoje' },
  { label: 'Próximos 7 dias', value: 'week', helper: 'Planejamento da semana' },
  { label: 'Todos os futuros', value: 'all', helper: 'Agenda completa' }
]

const cancellationFilterOptions: { label: string; value: CancelledCategoryFilter; helper: string }[] = [
  { label: 'Cancelados', value: 'all', helper: 'Todos os cancelamentos' },
  { label: 'Faltou', value: 'no-show', helper: 'Ausências registradas' },
  { label: 'Outros', value: 'other', helper: 'A pedido e demais motivos' }
]

const cancellationFilterIcons: Record<CancelledCategoryFilter, typeof XCircle> = {
  all: XCircle,
  'no-show': UserMinus,
  other: DotsThree
}

const cancellationFilterVisuals: Record<CancelledCategoryFilter, {
  inactiveClass: string
  activeClass: string
  iconInactiveClass: string
  iconActiveClass: string
  badgeInactiveClass: string
  badgeActiveClass: string
}> = {
  all: {
    inactiveClass: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
    activeClass: 'bg-rose-500 text-white hover:bg-rose-500 shadow-sm',
    iconInactiveClass: 'text-rose-500',
    iconActiveClass: 'text-white',
    badgeInactiveClass: 'bg-rose-100 text-rose-700',
    badgeActiveClass: 'bg-white/30 text-white'
  },
  'no-show': {
    inactiveClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    activeClass: 'bg-amber-400 text-amber-950 hover:bg-amber-400 shadow-sm',
    iconInactiveClass: 'text-amber-500',
    iconActiveClass: 'text-amber-950',
    badgeInactiveClass: 'bg-amber-100 text-amber-700',
    badgeActiveClass: 'bg-white/50 text-amber-900'
  },
  other: {
    inactiveClass: 'bg-white text-slate-600 hover:bg-slate-50',
    activeClass: 'bg-white text-slate-900 shadow-sm',
    iconInactiveClass: 'text-slate-500',
    iconActiveClass: 'text-slate-900',
    badgeInactiveClass: 'bg-slate-200 text-slate-700',
    badgeActiveClass: 'bg-slate-900/10 text-slate-900'
  }
}

const cancellationReasonDisplay: Record<'user-request' | 'no-show' | 'other', { label: string; className: string }> = {
  'user-request': { label: 'Cancelado a pedido', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'no-show': { label: 'Faltou', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  other: { label: 'Outro motivo', className: 'bg-slate-50 text-slate-600 border border-slate-200' }
}

const getCancellationCategory = (appointment: Appointment): 'user-request' | 'no-show' | 'other' => {
  const history = appointment.statusHistory || []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    if (entry.to === 'cancelled' && entry.metadata?.cancellationCategory) {
      return entry.metadata.cancellationCategory
    }
  }

  const normalizedReason = (appointment.cancellationReason || '').toLowerCase()
  if (normalizedReason.includes('faltou') || normalizedReason.includes('ausência')) {
    return 'no-show'
  }
  if (normalizedReason.includes('pedido')) {
    return 'user-request'
  }
  return 'other'
}

interface AtendimentoBoardProps {
  appointments: Appointment[]
  locations: Location[]
  workingHours?: string[]
  maxAppointmentsPerSlot?: number
  blockedDates?: BlockedDate[]
  bookingWindowDays?: number
  onConfirmAppointment?: (appointmentId: string) => Promise<void> | void
  onPriorityChange?: (appointmentId: string, priority: AppointmentPriority) => Promise<void> | void
  onCompleteAppointment?: (appointmentId: string) => Promise<void> | void
  onCancelAppointment?: (
    appointmentId: string,
    reason: string,
    metadata?: StatusChangeHistory['metadata']
  ) => Promise<void> | void
  onRollbackStatus?: (appointmentId: string, status: AppointmentStatus, reason?: string) => Promise<void> | void
  onReschedule?: (appointmentId: string, newDate: string, newTime: string) => void
  onDeleteAppointment?: (appointmentId: string) => Promise<void> | void
  onUpdateAppointmentDetails?: (appointmentId: string, updates: PersonalInfoFields) => Promise<void> | void
  onAddNote?: (appointmentId: string, note: string, options?: { contextLabel?: string }) => void
  onDeleteNote?: (appointmentId: string, noteId: string) => void
}

type CallUserDefaults = {
  room: string
  booth: string
}

export function AtendimentoBoard({
  appointments,
  locations,
  workingHours,
  maxAppointmentsPerSlot,
  blockedDates = [],
  bookingWindowDays = 60,
  onConfirmAppointment,
  onPriorityChange,
  onCompleteAppointment,
  onCancelAppointment,
  onRollbackStatus,
  onReschedule,
  onDeleteAppointment,
  onUpdateAppointmentDetails,
  onAddNote,
  onDeleteNote
}: AtendimentoBoardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [cancelledCategoryFilter, setCancelledCategoryFilter] = useState<CancelledCategoryFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined)
  const [callDialogOpen, setCallDialogOpen] = useState(false)
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<string | null>(null)
  const [roomAssignments, setRoomAssignments] = useState<Record<string, string>>({})
  const [boothAssignments, setBoothAssignments] = useState<Record<string, string>>({})
  const [userCallDefaults, setUserCallDefaults] = useState<CallUserDefaults>({ room: '', booth: '' })
  const [calledAppointments, setCalledAppointments] = useState<CalledAppointment[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false)
  const [appointmentToConfirm, setAppointmentToConfirm] = useState<Appointment | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<AppointmentPriority>('normal')
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [appointmentBeingCancelled, setAppointmentBeingCancelled] = useState<Appointment | null>(null)
  const [cancelReasonType, setCancelReasonType] = useState<CancelReasonType>('a-pedido')
  const [customCancelReason, setCustomCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileAppointment, setProfileAppointment] = useState<Appointment | null>(null)
  const [profileForm, setProfileForm] = useState<PersonalInfoFields>(emptyPersonalInfo)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [addressOptions, setAddressOptions] = useState<AddressOptions | null>(null)
  const [addressOptionsLoading, setAddressOptionsLoading] = useState(false)
  const [addressOptionsError, setAddressOptionsError] = useState<string | null>(null)
  const callChannelRef = useRef<BroadcastChannel | null>(null)
  const callPanelWindowRef = useRef<Window | null>(null)

  const today = startOfDay(new Date())
  const effectiveWorkingHours = workingHours && workingHours.length > 0 ? workingHours : DEFAULT_BOARD_WORKING_HOURS
  const effectiveMaxAppointmentsPerSlot = maxAppointmentsPerSlot && maxAppointmentsPerSlot > 0 ? maxAppointmentsPerSlot : DEFAULT_BOARD_MAX_PER_SLOT

  const rescheduleBlockedCpfs = useMemo(() => {
    const blocked = new Set<string>()
    const uniqueCpfs = new Set(appointments.map((apt) => apt.cpf))
    uniqueCpfs.forEach((cpf) => {
      if (isRescheduleBlocked(appointments, cpf)) {
        blocked.add(cpf)
      }
    })
    return blocked
  }, [appointments])

  const rescheduleLimitMessage = `Limite de ${MAX_RESCHEDULES_PER_WINDOW} reagendamentos em ${BLOCK_WINDOW_DAYS} dias atingido para este CPF.`

  const matchesTimeRange = (appointmentDate: Date) => {
    const dayDiff = differenceInCalendarDays(startOfDay(appointmentDate), today)
    if (timeFilter === 'today') {
      return isSameDay(appointmentDate, today)
    }
    if (timeFilter === 'week') {
      return dayDiff >= 0 && dayDiff <= 7
    }
    return true
  }

  const locationMap = useMemo(() => {
    const map = new Map<string, Location>()
    locations.forEach(location => {
      if (!location) {
        return
      }
      const key = location.id != null ? String(location.id) : ''
      if (key) {
        map.set(key, location)
      }
    })
    return map
  }, [locations])

  const resolveCallDefaultsStorageKey = () => {
    if (typeof window === 'undefined') return null
    const pathSegments = window.location.pathname.split('/').filter(Boolean)
    const tenantSlug = pathSegments[0] || 'default'

    let userIdentity = 'anon'
    try {
      const sessionRaw = sessionStorage.getItem(SECRETARY_SESSION_USER_KEY)
      if (sessionRaw) {
        const sessionUser = JSON.parse(sessionRaw) as Record<string, any>
        userIdentity = String(
          sessionUser.id ||
          sessionUser.username ||
          sessionUser.email ||
          sessionUser.fullName ||
          'anon'
        )
      } else {
        const localRaw = localStorage.getItem('currentUser')
        if (localRaw) {
          const localUser = JSON.parse(localRaw) as Record<string, any>
          userIdentity = String(
            localUser.id ||
            localUser.username ||
            localUser.email ||
            localUser.fullName ||
            'anon'
          )
        }
      }
    } catch {
      userIdentity = 'anon'
    }

    return `atendimento:last-call-target:${tenantSlug}:${userIdentity}`
  }

  const loadUserCallDefaults = (): CallUserDefaults => {
    if (typeof window === 'undefined') return { room: '', booth: '' }
    const storageKey = resolveCallDefaultsStorageKey()
    if (!storageKey) return { room: '', booth: '' }

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return { room: '', booth: '' }
      const parsed = JSON.parse(raw) as Partial<CallUserDefaults>
      return {
        room: String(parsed.room || '').trim(),
        booth: String(parsed.booth || '').trim()
      }
    } catch {
      return { room: '', booth: '' }
    }
  }

  const persistUserCallDefaults = (defaults: CallUserDefaults) => {
    if (typeof window === 'undefined') return
    const storageKey = resolveCallDefaultsStorageKey()
    if (!storageKey) return

    try {
      localStorage.setItem(storageKey, JSON.stringify(defaults))
    } catch (error) {
      console.warn('[AtendimentoBoard] Falha ao salvar padrão de sala/guichê do usuário', error)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return
    }
    const channel = new BroadcastChannel('call-announcements')
    callChannelRef.current = channel
    return () => {
      channel.close()
      callChannelRef.current = null
    }
  }, [])

  useEffect(() => {
    setUserCallDefaults(loadUserCallDefaults())
  }, [])

  useEffect(() => {
    if (statusFilter !== 'cancelled' && cancelledCategoryFilter !== 'all') {
      setCancelledCategoryFilter('all')
    }
  }, [statusFilter, cancelledCategoryFilter])

  const rawHeadquarters = addressOptions?.headquarters ?? []
  const rawDistricts = addressOptions?.districts ?? []
  const neighborhoods = addressOptions?.neighborhoods ?? []

  const headquarters = useMemo(() => {
    if (!rawHeadquarters.length || !neighborhoods.length) {
      return []
    }
    const headquarterIds = new Set(rawHeadquarters.map((item) => item.id))
    const linkedIds = new Set<string>()
    neighborhoods.forEach((neighborhood) => {
      if (!neighborhood.localidadeId) {
        return
      }
      if (neighborhood.parentType === 'Distrito') {
        return
      }
      if (neighborhood.parentType === 'Sede' || headquarterIds.has(neighborhood.localidadeId)) {
        linkedIds.add(neighborhood.localidadeId)
      }
    })
    return rawHeadquarters.filter((headquarter) => linkedIds.has(headquarter.id))
  }, [rawHeadquarters, neighborhoods])

  const districts = useMemo(() => {
    if (!rawDistricts.length || !neighborhoods.length) {
      return []
    }
    const districtIds = new Set(rawDistricts.map((item) => item.id))
    const linkedIds = new Set<string>()
    neighborhoods.forEach((neighborhood) => {
      if (!neighborhood.localidadeId) {
        return
      }
      if (neighborhood.parentType === 'Sede') {
        return
      }
      if (neighborhood.parentType === 'Distrito' || districtIds.has(neighborhood.localidadeId)) {
        linkedIds.add(neighborhood.localidadeId)
      }
    })
    return rawDistricts.filter((district) => linkedIds.has(district.id))
  }, [rawDistricts, neighborhoods])

  const hasStructuredAddress = headquarters.length > 0 || districts.length > 0
  const selectedLocalityId = profileForm.regionType === 'Sede'
    ? profileForm.sedeId
    : profileForm.regionType === 'Distrito'
      ? profileForm.districtId
      : ''

  const filteredNeighborhoods = useMemo(() => {
    if (!selectedLocalityId) {
      return []
    }
    return neighborhoods.filter(
      (item) => item.localidadeId && item.localidadeId === selectedLocalityId
    )
  }, [neighborhoods, selectedLocalityId])

  const canSelectNeighborhood = Boolean(
    profileForm.regionType &&
      ((profileForm.regionType === 'Sede' && profileForm.sedeId) ||
        (profileForm.regionType === 'Distrito' && profileForm.districtId))
  )
  const shouldRenderNeighborhoodSelect = hasStructuredAddress && canSelectNeighborhood && filteredNeighborhoods.length > 0
  const noNeighborhoodsForSelection = hasStructuredAddress && canSelectNeighborhood && filteredNeighborhoods.length === 0

  useEffect(() => {
    if (!profileDialogOpen) {
      return
    }
    if (profileForm.regionType === 'Sede' && !profileForm.sedeId && headquarters.length === 1) {
      setProfileForm(prev => ({ ...prev, sedeId: headquarters[0].id }))
    }
  }, [profileDialogOpen, profileForm.regionType, profileForm.sedeId, headquarters])

  useEffect(() => {
    if (!profileDialogOpen) {
      return
    }
    if (profileForm.regionType === 'Distrito' && !profileForm.districtId && districts.length === 1) {
      setProfileForm(prev => ({ ...prev, districtId: districts[0].id }))
    }
  }, [profileDialogOpen, profileForm.regionType, profileForm.districtId, districts])

  const handleCancelDialogOpenChange = (open: boolean) => {
    setCancelDialogOpen(open)
    if (!open) {
      setAppointmentBeingCancelled(null)
      setCustomCancelReason('')
      setIsCancelling(false)
    }
  }

  const openCancelDialog = (appointment: Appointment) => {
    setAppointmentBeingCancelled(appointment)
    setCancelReasonType('a-pedido')
    setCustomCancelReason('')
    setCancelDialogOpen(true)
  }

  const openDeleteDialog = (appointment: Appointment) => {
    setAppointmentToDelete(appointment)
    setDeleteDialogOpen(true)
  }

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open)
    if (!open) {
      setAppointmentToDelete(null)
      setIsDeleting(false)
    }
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

  const validateProfileCPF = (value: string) => {
    const normalized = (value || '').replace(/\D/g, '')
    if (!normalized) {
      setProfileErrors(prev => ({ ...prev, cpf: 'CPF é obrigatório' }))
      return false
    }
    if (!validateCPF(value || '')) {
      setProfileErrors(prev => ({ ...prev, cpf: 'CPF inválido' }))
      return false
    }
    setProfileErrors(prev => ({ ...prev, cpf: '' }))
    return true
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
    const selectedNeighborhood = neighborhoods.find(item => item.id === value)
    setProfileForm(prev => ({
      ...prev,
      neighborhoodId: value,
      neighborhood: selectedNeighborhood?.nome || ''
    }))
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
      await onUpdateAppointmentDetails(profileAppointment.id, profileForm)
      handleProfileDialogOpenChange(false)
    } catch (error) {
      console.error('[AtendimentoBoard] Erro ao atualizar dados pessoais', error)
      toast.error('Não foi possível salvar as alterações. Tente novamente.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleConfirmCancellation = async () => {
    if (!appointmentBeingCancelled || !onCancelAppointment) {
      return
    }

    let finalReason = ''
    if (cancelReasonType === 'a-pedido') {
      finalReason = 'Cancelado a pedido'
    } else if (cancelReasonType === 'faltou') {
      finalReason = 'Faltou'
    } else {
      finalReason = customCancelReason.trim()
    }

    if (!finalReason) {
      toast.error('Informe o motivo do cancelamento para continuar.')
      return
    }

    const metadata: StatusChangeHistory['metadata'] = {
      cancellationCategory:
        cancelReasonType === 'faltou'
          ? 'no-show'
          : cancelReasonType === 'a-pedido'
            ? 'user-request'
            : 'other',
      cancellationReasonText: finalReason
    }

    try {
      setIsCancelling(true)
      await onCancelAppointment(appointmentBeingCancelled.id, finalReason, metadata)
      setCancelDialogOpen(false)
      setAppointmentBeingCancelled(null)
      setCustomCancelReason('')
    } catch (error) {
      console.error('[AtendimentoBoard] Erro ao cancelar atendimento', error)
      toast.error('Não foi possível cancelar o atendimento. Tente novamente.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!appointmentToDelete || !onDeleteAppointment) {
      return
    }
    try {
      setIsDeleting(true)
      await onDeleteAppointment(appointmentToDelete.id)
      setDeleteDialogOpen(false)
      setAppointmentToDelete(null)
    } catch (error) {
      console.error('[AtendimentoBoard] Erro ao excluir atendimento', error)
      toast.error('Não foi possível excluir o agendamento. Tente novamente.')
    } finally {
      setIsDeleting(false)
    }
  }

  const getLocationLabel = (appointment: Appointment) => {
    const locationKey = appointment.locationId ? String(appointment.locationId) : ''
    if (locationKey) {
      const location = locationMap.get(locationKey)
      if (location) {
        const normalizedName = location.name.trim()
        if (normalizedName) {
          return normalizedName
        }
        const normalizedAddress = location.address?.trim()
        if (normalizedAddress) {
          return normalizedAddress
        }
      }
    }

    return 'Local não informado'
  }

  const getTenantSlug = () => {
    if (typeof window === 'undefined') {
      return null
    }
    const segments = window.location.pathname.split('/').filter(Boolean)
    if (segments.length === 0) {
      return null
    }
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
          if (storedTenantId) {
            headers['x-tenant-id'] = storedTenantId
          } else if (storedTenantSlug) {
            headers['x-prefeitura-slug'] = storedTenantSlug
          }
        }

        const response = await fetch('/api/public/address-options', {
          signal: controller.signal,
          headers
        })

        if (!response.ok) {
          throw new Error(`Falha ao carregar catálogo de regiões (${response.status})`)
        }

        const payload = await response.json()
        if (!isMounted) {
          return
        }

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
          if (declaredType === 'Sede' || declaredType === 'Distrito') {
            parentType = declaredType
          } else if (normalizedParent && headquarters.some((hq: AddressLocalityOption) => hq.id === normalizedParent)) {
            parentType = 'Sede'
          } else if (normalizedParent && districts.some((district: AddressLocalityOption) => district.id === normalizedParent)) {
            parentType = 'Distrito'
          }
          return {
            id: String(item.id),
            nome: item.nome || item.name || '',
            localidadeId: normalizedParent,
            parentType
          }
        })

        setAddressOptions({ headquarters, districts, neighborhoods })
      } catch (error) {
        if (!isMounted) {
          return
        }
        const err = error as Error
        if (err.name === 'AbortError') {
          return
        }
        console.error('[AtendimentoBoard] Erro ao buscar regiões cadastradas', error)
        setAddressOptionsError('Não foi possível carregar as regiões cadastradas.')
        setAddressOptions(null)
      } finally {
        if (isMounted) {
          setAddressOptionsLoading(false)
        }
      }
    }

    loadAddressOptions()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  const openCallPanelWindow = () => {
    if (typeof window === 'undefined') {
      return
    }
    const slug = getTenantSlug()
    const targetUrl = slug ? `/${slug}/chamada` : '/chamada'
    const existingWindow = callPanelWindowRef.current
    if (existingWindow && !existingWindow.closed) {
      existingWindow.focus()
      return
    }
    const panelWindow = window.open(targetUrl, 'call-panel')
    if (panelWindow) {
      callPanelWindowRef.current = panelWindow
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const hasDateRange = Boolean(selectedDateRange?.from || selectedDateRange?.to)
  const formatDateKey = (date: Date) => format(startOfDay(date), 'yyyy-MM-dd')
  const matchesDateInterval = (appointmentDate: Date) => {
    const selectedDateStart = selectedDateRange?.from
    const selectedDateEnd = selectedDateRange?.to
    if (!selectedDateStart && !selectedDateEnd) return true
    const normalizedDate = formatDateKey(appointmentDate)
    if (selectedDateStart && selectedDateEnd) {
      const from = formatDateKey(selectedDateStart)
      const to = formatDateKey(selectedDateEnd)
      return normalizedDate >= from && normalizedDate <= to
    }
    if (selectedDateStart) {
      return normalizedDate === formatDateKey(selectedDateStart)
    }
    return true
  }

  const calledAppointmentIds = useMemo(() => {
    return new Set(calledAppointments.map(entry => entry.appointment.id))
  }, [calledAppointments])

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter(appointment => {
        const appointmentDate = parseISO(appointment.date)
        const allowPastAppointments = statusFilter === 'cancelled'
        if (!allowPastAppointments && startOfDay(appointmentDate) < today) {
          return false
        }

        const isToday = isSameDay(appointmentDate, today)
        const readyToCall = isToday && (appointment.status === 'pending' || appointment.status === 'confirmed')
        const shouldApplyTimeTab = statusFilter !== 'cancelled'
        if (shouldApplyTimeTab && !matchesTimeRange(appointmentDate)) {
          return false
        }
        if (!matchesDateInterval(appointmentDate)) {
          return false
        }

        if (normalizedSearch) {
          const haystack = `${appointment.fullName} ${appointment.cpf} ${appointment.protocol}`.toLowerCase()
          if (!haystack.includes(normalizedSearch)) {
            return false
          }
        }

        const isAlreadyCalled = calledAppointmentIds.has(appointment.id)

        switch (statusFilter) {
          case 'pending':
            return appointment.status === 'pending'
          case 'confirmed':
            return appointment.status === 'confirmed' && !isAlreadyCalled
          case 'completed':
            return completionStatuses.includes(appointment.status)
          case 'cancelled':
            if (appointment.status !== 'cancelled') {
              return false
            }
            if (cancelledCategoryFilter === 'no-show') {
              return getCancellationCategory(appointment) === 'no-show'
            }
            if (cancelledCategoryFilter === 'other') {
              return getCancellationCategory(appointment) !== 'no-show'
            }
            return true
          case 'call':
            return readyToCall
          default:
            return true
        }
      })
      .sort((a, b) => {
        const dateDiff = parseISO(a.date).getTime() - parseISO(b.date).getTime()
        if (dateDiff !== 0) {
          return dateDiff
        }
        return a.time.localeCompare(b.time)
      })
  }, [
    appointments,
    normalizedSearch,
    statusFilter,
    timeFilter,
    today,
    selectedDateRange,
    calledAppointmentIds,
    cancelledCategoryFilter
  ])

  const cancellationCounts = useMemo(() => {
    return appointments.reduce(
      (acc, appointment) => {
        if (appointment.status !== 'cancelled') {
          return acc
        }
        acc.all += 1
        const category = getCancellationCategory(appointment)
        if (category === 'no-show') {
          acc.noShow += 1
        } else {
          acc.other += 1
        }
        return acc
      },
      { all: 0, noShow: 0, other: 0 }
    )
  }, [appointments])

  const confirmedAppointments = useMemo(() => {
    return appointments
      .filter(appointment => appointment.status === 'confirmed')
      .filter(appointment => {
        const appointmentDate = parseISO(appointment.date)
        if (startOfDay(appointmentDate) < today) {
          return false
        }
        if (!matchesTimeRange(appointmentDate)) {
          return false
        }
        if (!matchesDateInterval(appointmentDate)) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        const priorityDiff = priorityOrder[(a.priority || 'normal') as AppointmentPriority] - priorityOrder[(b.priority || 'normal') as AppointmentPriority]
        if (priorityDiff !== 0) {
          return priorityDiff
        }
        const dateDiff = parseISO(a.date).getTime() - parseISO(b.date).getTime()
        if (dateDiff !== 0) {
          return dateDiff
        }
        return a.time.localeCompare(b.time)
      })
  }, [appointments, selectedDateRange, timeFilter, today])
  const isShowingCalled = statusFilter === 'call'
  const canEditProfile = profileAppointment ? 
    !['completed', 'cin-delivered', 'cancelled'].includes(profileAppointment.status) : false
  const canManageNotes = Boolean(onAddNote && onDeleteNote)
  const metrics = useMemo(() => {
    const summary = {
      awaiting: 0,
      inService: calledAppointmentIds.size,
      completed: 0
    }

    appointments.forEach(appointment => {
      if ((appointment.status === 'pending' || appointment.status === 'confirmed') && !calledAppointmentIds.has(appointment.id)) {
        summary.awaiting += 1
      }

      if (appointment.status === 'completed') {
        summary.completed += 1
      }
    })

    return summary
  }, [appointments, calledAppointmentIds])

  

  const getWaitTimeLabel = (appointment: Appointment) => {
    const dateTimeString = `${appointment.date}T${appointment.time}`
    const dateTime = parseISO(dateTimeString)
    if (Number.isNaN(dateTime.getTime())) {
      return '—'
    }
    const now = new Date()
    if (now <= dateTime) {
      return '0 min'
    }
    const totalMinutes = Math.max(0, differenceInMinutes(now, dateTime))
    if (totalMinutes < 60) {
      return `${totalMinutes} min`
    }
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`
  }

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

  const canEditCitizenProfile = (status: AppointmentStatus) =>
    !['cin-ready', 'cin-delivered'].includes(status)

  const handleOpenCallDialog = (appointmentId?: string) => {
    setFocusedAppointmentId(appointmentId || null)
    setCallDialogOpen(true)
  }

  const handleRoomChange = (appointmentId: string, value: string) => {
    setRoomAssignments(prev => ({ ...prev, [appointmentId]: value }))
  }

  const handleBoothChange = (appointmentId: string, value: string) => {
    setBoothAssignments(prev => ({ ...prev, [appointmentId]: value }))
  }

  const dispatchCallAnnouncement = (
    appointment: Appointment,
    room: string,
    booth: string | null,
    locationOverride?: string,
    options?: { repeated?: boolean }
  ) => {
    const locationName = locationOverride || getLocationLabel(appointment)
    const slug = getTenantSlug()
    const announcementId = `${appointment.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const payload = {
      announcementId,
      slug,
      id: appointment.id,
      nome: appointment.fullName,
      cpf: appointment.cpf,
      prioridade: appointment.priority || 'normal',
      sala: room,
      guiche: booth || null,
      local: locationName,
      protocolo: appointment.protocol,
      data: appointment.date,
      hora: appointment.time
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'latestCallAnnouncement',
          JSON.stringify({
            type: 'CALL_TRIGGERED',
            payload,
            announcementId,
            emittedAt: Date.now()
          })
        )

        const historyRaw = localStorage.getItem(CALL_HISTORY_STORAGE_KEY)
        const historyParsed = historyRaw ? JSON.parse(historyRaw) : []
        const historySafe = Array.isArray(historyParsed) ? historyParsed : []
        const nextHistory = [
          { payload, emittedAt: Date.now() },
          ...historySafe.filter((entry: any) => {
            const sameAnnouncement =
              payload.announcementId && entry?.payload?.announcementId
                ? entry.payload.announcementId === payload.announcementId
                : false
            const sameComposite =
              entry?.payload?.id === payload.id &&
              String(entry?.payload?.sala || '') === String(payload.sala || '') &&
              String(entry?.payload?.guiche || '') === String(payload.guiche || '')
            return !sameAnnouncement && !sameComposite
          })
        ].slice(0, 40)
        localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory))
      } catch (error) {
        console.warn('[AtendimentoBoard] Não foi possível salvar latestCallAnnouncement', error)
      }
    }

    callChannelRef.current?.postMessage({
      type: 'CALL_TRIGGERED',
      payload
    })

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        callChannelRef.current?.postMessage({
          type: 'CALL_TRIGGERED',
          payload
        })
      }, 350)
    }

    setCalledAppointments(prev => {
      const withoutCurrent = prev.filter(entry => entry.appointment.id !== appointment.id)
      const updated = [
        {
          appointment,
          room,
          booth: booth || null,
          locationName,
          calledAt: new Date().toISOString()
        },
        ...withoutCurrent
      ]
      return updated.slice(0, 50)
    })

    setStatusFilter('call')

    const verb = options?.repeated ? 'Chamando novamente' : 'Chamando'
    toast.success(`${verb} ${appointment.fullName} para a sala ${room}`)
  }

  const handleCallCitizen = (appointment: Appointment) => {
    const room = (roomAssignments[appointment.id] || userCallDefaults.room || '').trim()
    if (!room) {
      toast.error('Informe a sala para onde o cidadão deve se dirigir')
      return
    }

    const booth = (boothAssignments[appointment.id] || userCallDefaults.booth || '').trim()

    const nextDefaults = { room, booth: booth || '' }
    setUserCallDefaults(nextDefaults)
    persistUserCallDefaults(nextDefaults)

    dispatchCallAnnouncement(appointment, room, booth || null)
    if (onRollbackStatus && appointment.status !== 'confirmed') {
      const boothText = booth ? `, guichê ${booth}` : ''
      onRollbackStatus(
        appointment.id,
        'confirmed',
        `Cidadão chamado para sala ${room}${boothText}.`
      )
    }

    setCallDialogOpen(false)
    setFocusedAppointmentId(null)
  }

  const handleCallDialogInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    appointment: Appointment,
  ) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }
    event.preventDefault()
    handleCallCitizen(appointment)
  }

  const handleCallDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return
    }
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const targetElement = event.target as HTMLElement | null
    const isTextArea = targetElement?.tagName === 'TEXTAREA'
    if (isTextArea) {
      return
    }

    const visibleAppointments = focusedAppointmentId
      ? confirmedAppointments.filter((item) => item.id === focusedAppointmentId)
      : confirmedAppointments

    if (visibleAppointments.length === 1) {
      event.preventDefault()
      handleCallCitizen(visibleAppointments[0])
    }
  }

  const handleRecallCalledCitizen = (entry: CalledAppointment) => {
    if (!entry.room) {
      toast.error('Sala não registrada para este atendimento. Utilize o painel de chamada.')
      return
    }
    dispatchCallAnnouncement(entry.appointment, entry.room, entry.booth, entry.locationName, { repeated: true })
  }

  const handleCompleteCalledAppointment = async (entry: CalledAppointment) => {
    if (!onCompleteAppointment) {
      toast.error('Ação de conclusão não está disponível neste ambiente.')
      return
    }

    try {
      setCompletingId(entry.appointment.id)
      await onCompleteAppointment(entry.appointment.id)
      toast.success(`Atendimento de ${entry.appointment.fullName} concluído.`)
      setCalledAppointments(prev => prev.filter(item => item.appointment.id !== entry.appointment.id))
    } catch (error) {
      console.error('[AtendimentoBoard] Erro ao concluir atendimento', error)
      toast.error('Não foi possível concluir o atendimento. Tente novamente.')
    } finally {
      setCompletingId(null)
    }
  }

  const handleOpenPriorityDialog = (appointment: Appointment) => {
    setAppointmentToConfirm(appointment)
    setSelectedPriority((appointment.priority || 'normal') as AppointmentPriority)
    setPriorityDialogOpen(true)
  }

  const handleClosePriorityDialog = () => {
    setPriorityDialogOpen(false)
    setAppointmentToConfirm(null)
    setSelectedPriority('normal')
  }

  const handleConfirmAppointment = async (appointment: Appointment, priority?: AppointmentPriority) => {
    if (!onConfirmAppointment) {
      toast.error('Função de confirmação não disponível')
      return
    }
    try {
      setConfirmingId(appointment.id)
      if (priority && onPriorityChange) {
        await Promise.resolve(onPriorityChange(appointment.id, priority))
      }
      await onConfirmAppointment(appointment.id)
      toast.success(`${appointment.fullName} confirmado(a) com sucesso`)
    } catch (error) {
      console.error('Erro ao confirmar agendamento:', error)
      toast.error('Não foi possível confirmar o agendamento')
    } finally {
      setConfirmingId(null)
      handleClosePriorityDialog()
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <Card className="shadow-lg border-emerald-100/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ChatCircleText size={28} weight="duotone" className="text-emerald-700" />
            <div>
              <CardTitle className="text-2xl">Painel Operacional</CardTitle>
              <CardDescription>Resumo em tempo real dos atendimentos em andamento</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-yellow-200 bg-yellow-50/70 shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-yellow-700/80">Aguardando</p>
                  <p className="text-3xl font-bold text-yellow-700">{metrics.awaiting}</p>
                  <p className="text-xs text-yellow-800/70">Pendentes e confirmados não chamados</p>
                </div>
                <div className="rounded-full bg-white/80 p-3 text-yellow-600">
                  <Hourglass size={28} weight="duotone" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/70 shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-blue-700/80">Em Atendimento</p>
                  <p className="text-3xl font-bold text-blue-700">{metrics.inService}</p>
                  <p className="text-xs text-blue-800/70">Cidadãos chamados</p>
                </div>
                <div className="rounded-full bg-white/80 p-3 text-blue-600">
                  <ChatCircleText size={28} weight="duotone" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-emerald-700/80">Finalizados</p>
                  <p className="text-3xl font-bold text-emerald-700">{metrics.completed}</p>
                  <p className="text-xs text-emerald-800/70">Marcados como concluídos</p>
                </div>
                <div className="rounded-full bg-white/80 p-3 text-emerald-600">
                  <CheckCircle size={28} weight="duotone" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-emerald-100/50">
        <CardHeader>
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <MegaphoneSimple size={24} weight="duotone" className="text-emerald-700" />
              Lista de Atendimentos
            </CardTitle>
            <CardDescription>Organize a recepção por ordem de chegada e status operacional</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
            <div className="relative">
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome, CPF ou protocolo"
                className="pl-10 h-12 rounded-2xl"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {timeTabs.map((tab) => (
                <Button
                  key={tab.value}
                  variant={timeFilter === tab.value ? 'default' : 'outline'}
                  onClick={() => setTimeFilter(tab.value)}
                  className={cn('h-12 rounded-2xl px-4 text-left', timeFilter === tab.value ? 'bg-emerald-600 text-white' : 'border-muted text-muted-foreground')}
                >
                  <span className="text-sm font-semibold block">{tab.label}</span>
                  <span className="text-[11px] opacity-80">{tab.helper}</span>
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-emerald-200 text-emerald-900 flex items-center gap-2 px-4"
                  >
                    <CalendarBlank size={18} className="text-emerald-600" />
                    <span className="text-sm font-semibold">
                      {selectedDateRange?.from && selectedDateRange?.to
                        ? `${format(selectedDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(selectedDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                        : selectedDateRange?.from
                          ? format(selectedDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        : 'Filtrar data'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto max-w-full overflow-hidden bg-card space-y-3">
                  <Calendar
                    mode="range"
                    selected={selectedDateRange}
                    onSelect={setSelectedDateRange}
                    locale={ptBR}
                    initialFocus
                    className="rounded-md border max-w-full"
                  />
                  <div className="flex gap-2">
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
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setSelectedDateRange(undefined)
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <Button
                key={tab.value}
                size="sm"
                variant={statusFilter === tab.value ? 'default' : 'outline'}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'rounded-full px-4 text-sm font-semibold transition-colors',
                  statusTabStyles[tab.value][statusFilter === tab.value ? 'active' : 'inactive']
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {statusFilter === 'cancelled' && (
            <div className="bg-slate-100 rounded-lg p-1 flex items-center gap-1">
              {cancellationFilterOptions.map(option => {
                const isActive = cancelledCategoryFilter === option.value
                const count = option.value === 'all'
                  ? cancellationCounts.all
                  : option.value === 'no-show'
                    ? cancellationCounts.noShow
                    : cancellationCounts.other
                const Icon = cancellationFilterIcons[option.value]
                const visuals = cancellationFilterVisuals[option.value]

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCancelledCategoryFilter(option.value)}
                    className={cn(
                      'flex-1 flex items-center justify-between gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all hover:shadow-sm',
                      isActive ? visuals.activeClass : visuals.inactiveClass
                    )}
                  >
                    <div className="flex items-center gap-2 text-left">
                      <Icon
                        size={18}
                        weight={isActive ? 'fill' : 'regular'}
                        className={cn('transition-colors', isActive ? visuals.iconActiveClass : visuals.iconInactiveClass)}
                      />
                      <div className="flex flex-col leading-tight">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', isActive ? 'opacity-90' : 'opacity-70')}>
                          {option.helper}
                        </span>
                      </div>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold transition-colors', isActive ? visuals.badgeActiveClass : visuals.badgeInactiveClass)}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {statusFilter === 'confirmed' && (
            <div className="flex justify-end">
              <Button
                className="rounded-full gap-2"
                onClick={() => setCallDialogOpen(true)}
              >
                <MegaphoneSimple size={16} />
                Chamar Confirmados
              </Button>
            </div>
          )}

          {hasDateRange && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-2 text-xs text-emerald-900">
              <CalendarBlank size={14} className="text-emerald-700" />
              {selectedDateRange?.from && selectedDateRange?.to
                ? `Filtrando de ${format(selectedDateRange.from, "dd/MM/yyyy", { locale: ptBR })} até ${format(selectedDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                : selectedDateRange?.from
                  ? `Filtrando ${format(selectedDateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                  : 'Filtro de data aplicado'}
              <span className="text-muted-foreground">• {(isShowingCalled ? calledAppointments.length : filteredAppointments.length)} registro(s)</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-1 text-emerald-700"
                onClick={() => setSelectedDateRange(undefined)}
              >
                Limpar
              </Button>
            </div>
          )}

          <div className="rounded-3xl border border-muted bg-card shadow-inner">
            {isShowingCalled ? (
              calledAppointments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border-t border-dashed">
                  <ChatCircleText size={40} className="mx-auto mb-3 opacity-50" />
                  Nenhum cidadão foi chamado ainda.
                </div>
              ) : (
                <div className="divide-y">
                  {calledAppointments.map(entry => {
                    const { appointment, room, booth, locationName, calledAt } = entry
                    const appointmentDate = parseISO(appointment.date)
                    const priorityKey = (appointment.priority || 'normal') as AppointmentPriority
                    const priorityInfo = priorityBadges[priorityKey]
                    const calledLabel = format(new Date(calledAt), "dd/MM/yyyy 'às' HH:mm")
                    const profileEditable = canEditCitizenProfile(appointment.status)

                    return (
                      <div key={`${appointment.id}-${calledAt}`} className="px-4 py-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-muted/60 pb-3">
                          <div>
                            {profileEditable ? (
                              <button
                                type="button"
                                onClick={() => openProfileDialog(appointment)}
                                className="text-sm font-semibold text-foreground hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md cursor-pointer text-left"
                              >
                                {appointment.fullName}
                              </button>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">{appointment.fullName}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Chamado em {calledLabel} • Protocolo {appointment.protocol}
                            </p>
                          </div>
                          <Badge variant="outline" className={cn('rounded-full text-xs font-semibold px-3', priorityInfo.className)}>
                            Prioridade {priorityInfo.label}
                          </Badge>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr),minmax(0,1fr)]">
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground block">Serviço / Data</span>
                            <p className="font-semibold text-foreground">CIN {appointment.rgType || '1ª via'}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(appointmentDate, "dd/MM/yyyy", { locale: ptBR })} às {appointment.time || '—'}
                            </p>
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground block">Local do atendimento</span>
                            <p className="font-medium text-foreground">{locationName}</p>
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground block">Sala / Guichê</span>
                            <p className="font-semibold text-foreground">
                              Sala {room}
                              {booth ? ` • Guichê ${booth}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-dashed border-muted/40 pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full gap-2 border-emerald-200 text-emerald-700"
                            onClick={() => handleRecallCalledCitizen(entry)}
                          >
                            <SpeakerHigh size={16} />
                            Chamar novamente
                          </Button>
                          {onCompleteAppointment && (
                            <Button
                              size="sm"
                              className="rounded-full gap-2"
                              onClick={() => handleCompleteCalledAppointment(entry)}
                              disabled={completingId === appointment.id}
                            >
                              <CheckCircle size={16} />
                              {completingId === appointment.id ? 'Concluindo...' : 'Concluir atendimento'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : filteredAppointments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border-t border-dashed">
                <ChatCircleText size={40} className="mx-auto mb-3 opacity-50" />
                Nenhum atendimento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="divide-y">
                {filteredAppointments.map((appointment) => {
                  const appointmentDate = parseISO(appointment.date)
                  const locationName = getLocationLabel(appointment)
                  const isCalled = calledAppointmentIds.has(appointment.id)
                  const statusInfo = isCalled ? calledStatusBadge : statusDisplay[appointment.status]
                  const previousStatus = getPreviousStatus(appointment)
                  const canRollback = Boolean(previousStatus) && appointment.status !== 'cancelled'
                  const readyToCall = isSameDay(appointmentDate, today) && (appointment.status === 'pending' || appointment.status === 'confirmed')
                  const waitTimeLabel = getWaitTimeLabel(appointment)
                  const serviceLabel = `CIN ${appointment.rgType || '1ª via'}`
                  const priorityKey = (appointment.priority || 'normal') as AppointmentPriority
                  const priorityInfo = priorityBadges[priorityKey]
                  const cancellationCategory = appointment.status === 'cancelled' ? getCancellationCategory(appointment) : null
                  const shouldShowNotesButton = canManageNotes && appointment.status !== 'cin-delivered'
                  const profileEditable = canEditCitizenProfile(appointment.status)

                  return (
                    <div
                      key={appointment.id}
                      className="grid gap-4 px-4 py-4 md:grid-cols-[120px,minmax(0,1.6fr),minmax(0,1fr),150px,140px,120px] md:items-center"
                    >
                      <div className="md:col-span-full flex items-center justify-end border-b border-dashed border-muted/60 pb-3 mb-3">
                        {onDeleteAppointment ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 gap-2"
                            onClick={() => openDeleteDialog(appointment)}
                          >
                            <Trash size={16} />
                            Excluir
                          </Button>
                        ) : (
                          <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs font-semibold', priorityInfo.className)}>
                            {priorityInfo.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Badge variant="outline" className="rounded-full border-muted bg-muted/40 text-xs font-semibold text-muted-foreground">
                          {appointment.protocol}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        {profileEditable ? (
                          <button
                            type="button"
                            onClick={() => openProfileDialog(appointment)}
                            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md cursor-pointer max-w-full"
                          >
                            <User size={18} className="text-emerald-600 flex-shrink-0" />
                            <span className="text-left break-words">{appointment.fullName}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground max-w-full">
                            <User size={18} className="text-emerald-600 flex-shrink-0" />
                            <span className="text-left break-words">{appointment.fullName}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <IdentificationCard size={14} />
                          CPF: {appointment.cpf}
                        </p>
                        {appointment.gender && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User size={14} />
                            Gênero: {appointment.gender.replace('Outro:', 'Outro: ')}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">{serviceLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(appointmentDate, "dd/MM/yyyy", { locale: ptBR })} às {appointment.time || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={14} />
                          {locationName}
                        </p>
                        {(appointment.regionType || appointment.street || appointment.neighborhood) && (
                          <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
                            <p className="font-medium text-foreground">Endereço do cidadão:</p>
                            {appointment.street && (
                              <p>Logradouro: {appointment.street}{appointment.number ? `, Nº ${appointment.number}` : ''}</p>
                            )}
                            {appointment.neighborhood && <p>Bairro/Comunidade: {appointment.neighborhood}</p>}
                            {appointment.regionType && (
                              <p>Região: {appointment.regionType} - {appointment.regionName || appointment.sedeId || appointment.districtId}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Clock size={18} className="text-amber-600" />
                        {waitTimeLabel}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusInfo.className)}>
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs font-semibold', priorityInfo.className)}>
                          Prioridade {priorityInfo.label}
                        </Badge>
                        {cancellationCategory && (
                          <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-[11px] font-semibold', cancellationReasonDisplay[cancellationCategory].className)}>
                            {cancellationReasonDisplay[cancellationCategory].label}
                          </Badge>
                        )}
                        {readyToCall && appointment.status === 'confirmed' && (
                          <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]">
                            Pronto para chamar
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
                        {canRollback && previousStatus && onRollbackStatus && (
                          <StatusChangeDialog
                            currentStatus={appointment.status}
                            newStatus={previousStatus}
                            onConfirm={(reason) => onRollbackStatus(
                              appointment.id,
                              previousStatus,
                              reason || `Status revertido de ${appointment.status} para ${previousStatus}`,
                            )}
                            triggerButton={
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full gap-2"
                              >
                                <ClockCounterClockwise size={16} />
                                Voltar status
                              </Button>
                            }
                          />
                        )}
                        {shouldShowNotesButton && onAddNote && onDeleteNote && (
                          <AppointmentNotes
                            appointment={appointment}
                            onAddNote={onAddNote}
                            onDeleteNote={onDeleteNote}
                            contextLabel={statusInfo.label.toUpperCase()}
                          />
                        )}
                        {appointment.status === 'confirmed' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCallDialog(appointment.id)}
                            className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2"
                          >
                            <MegaphoneSimple size={16} />
                            Chamar
                          </Button>
                        ) : appointment.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={confirmingId === appointment.id}
                              onClick={() => handleOpenPriorityDialog(appointment)}
                              className="rounded-full gap-2"
                            >
                              {confirmingId === appointment.id ? 'Confirmando...' : 'Confirmar'}
                            </Button>
                            {onCancelAppointment && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                                onClick={() => openCancelDialog(appointment)}
                              >
                                <XCircle size={16} />
                                Cancelar
                              </Button>
                            )}
                            {onReschedule && (
                              <RescheduleDialog
                                appointment={appointment}
                                allAppointments={appointments}
                                workingHours={effectiveWorkingHours}
                                maxAppointmentsPerSlot={effectiveMaxAppointmentsPerSlot}
                                blockedDates={blockedDates}
                                maxAdvanceDays={bookingWindowDays}
                                onReschedule={onReschedule}
                                disabled={rescheduleBlockedCpfs.has(appointment.cpf)}
                                disabledReason={rescheduleBlockedCpfs.has(appointment.cpf) ? rescheduleLimitMessage : undefined}
                              />
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ação indisponível</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={priorityDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClosePriorityDialog()
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Prioridade</DialogTitle>
            <DialogDescription>Defina o nível de prioridade deste agendamento antes de confirmar.</DialogDescription>
          </DialogHeader>

          {appointmentToConfirm && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-muted bg-muted/40 p-4 text-sm">
                <p className="font-semibold text-foreground">{appointmentToConfirm.fullName}</p>
                <p className="text-xs text-muted-foreground">Protocolo {appointmentToConfirm.protocol}</p>
              </div>

              <RadioGroup
                value={selectedPriority}
                onValueChange={(value) => setSelectedPriority(value as AppointmentPriority)}
                className="space-y-3"
              >
                {priorityOptions.map(option => {
                  const isActive = selectedPriority === option.value
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border px-4 py-3 transition',
                        isActive ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-muted bg-white'
                      )}
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={`priority-${option.value}`}
                        className="mt-1 h-4 w-4 border-emerald-500 text-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                      <Label htmlFor={`priority-${option.value}`} className="flex-1 cursor-pointer">
                        <span className={cn('block text-sm font-semibold', priorityAccent[option.value])}>{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="ghost" onClick={handleClosePriorityDialog}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleConfirmAppointment(appointmentToConfirm, selectedPriority)}
                  disabled={confirmingId === appointmentToConfirm.id}
                  className="gap-2"
                >
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
                  Status atual: {statusDisplay[profileAppointment.status].label}
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
                          {filteredNeighborhoods.map((item) => (
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

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => handleProfileDialogOpenChange(false)}>
                  Fechar
                </Button>
                <Button
                  onClick={handleSaveProfileInfo}
                  disabled={!canEditProfile || isSavingProfile || !onUpdateAppointmentDetails}
                  className="gap-2"
                >
                  {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={callDialogOpen}
        onOpenChange={(open) => {
          setCallDialogOpen(open)
          if (!open) {
            setFocusedAppointmentId(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl" onKeyDown={handleCallDialogKeyDown}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MegaphoneSimple size={22} weight="duotone" className="text-emerald-700" />
              Chamada de Cidadãos Confirmados
            </DialogTitle>
            <DialogDescription>
              Selecione quem será chamado agora, informe a sala e confirme para anunciar automaticamente no ambiente.
            </DialogDescription>
          </DialogHeader>

          {confirmedAppointments.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground border border-dashed rounded-2xl">
              Nenhum cidadão confirmado para o período selecionado.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {(focusedAppointmentId ? confirmedAppointments.filter(item => item.id === focusedAppointmentId) : confirmedAppointments).map(appointment => {
                const appointmentDate = parseISO(appointment.date)
                const locationName = getLocationLabel(appointment)
                const priorityKey = (appointment.priority || 'normal') as AppointmentPriority
                const priorityInfo = priorityBadges[priorityKey]
                const isFocused = focusedAppointmentId === appointment.id
                const roomValue = roomAssignments[appointment.id] || userCallDefaults.room || ''

                return (
                  <div
                    key={appointment.id}
                    className={cn(
                      'rounded-2xl border bg-white p-4 shadow-sm transition',
                      isFocused ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-muted'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{appointment.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(appointmentDate, 'dd/MM/yyyy', { locale: ptBR })} às {appointment.time || '—'} • Protocolo {appointment.protocol}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('rounded-full text-xs font-semibold px-3', priorityInfo.className)}>
                        Prioridade {priorityInfo.label}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr,220px]">
                      <div className="flex flex-col text-sm">
                        <span className="text-muted-foreground text-xs">Horário agendado</span>
                        <span className="font-medium text-foreground">{appointment.time || '—'}</span>
                      </div>
                      <div className="flex flex-col text-sm">
                        <span className="text-muted-foreground text-xs">Local / Unidade</span>
                        <span className="font-medium text-foreground">{locationName}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Input
                          value={roomValue}
                          onChange={(event) => handleRoomChange(appointment.id, event.target.value)}
                          onKeyDown={(event) => handleCallDialogInputKeyDown(event, appointment)}
                          placeholder="Sala (obrigatório)"
                          className="h-10"
                        />
                        <Input
                          value={boothAssignments[appointment.id] || userCallDefaults.booth || ''}
                          onChange={(event) => handleBoothChange(appointment.id, event.target.value)}
                          onKeyDown={(event) => handleCallDialogInputKeyDown(event, appointment)}
                          placeholder="Guichê (opcional)"
                          className="h-10"
                        />
                        <Button
                          size="sm"
                          className="gap-2 w-full"
                          onClick={() => handleCallCitizen(appointment)}
                        >
                          <SpeakerHigh size={16} weight="duotone" />
                          Chamar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={cancelDialogOpen} onOpenChange={handleCancelDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle size={20} className="text-rose-600" />
              Cancelar atendimento
            </DialogTitle>
            <DialogDescription>
              Escolha o motivo do cancelamento. Motivos de falta são usados para bloquear CPFs que não comparecem.
            </DialogDescription>
          </DialogHeader>
          {appointmentBeingCancelled && (
            <div className="space-y-4">
              <div className="rounded-lg border border-muted px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">{appointmentBeingCancelled.fullName}</p>
                <p className="text-xs text-muted-foreground">Protocolo {appointmentBeingCancelled.protocol}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancel-reason-select">Motivo</Label>
                <Select
                  value={cancelReasonType}
                  onValueChange={(value) => setCancelReasonType(value as CancelReasonType)}
                >
                  <SelectTrigger id="cancel-reason-select">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a-pedido">A pedido</SelectItem>
                    <SelectItem value="faltou">Faltou</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cancelReasonType === 'outro' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-cancel-reason">Descreva o motivo</Label>
                  <Textarea
                    id="custom-cancel-reason"
                    placeholder="Digite o motivo do cancelamento"
                    value={customCancelReason}
                    onChange={(event) => setCustomCancelReason(event.target.value)}
                  />
                </div>
              )}
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {cancelReasonType === 'faltou'
                  ? 'Ao registrar falta, o CPF poderá ser bloqueado por 7 dias se acumular 3 ausências no período.'
                  : 'Use "a pedido" quando o cidadão solicitar o cancelamento. "Outro" permite detalhar motivos específicos.'}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleCancelDialogOpenChange(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancellation}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash size={20} />
              Excluir agendamento
            </DialogTitle>
            <DialogDescription>
              Deseja excluir este agendamento? <strong>Essa ação não poderá ser revertida.</strong>
            </DialogDescription>
          </DialogHeader>
          {appointmentToDelete && (
            <div className="rounded-lg border border-muted px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{appointmentToDelete.fullName}</p>
              <p className="text-xs text-muted-foreground">Protocolo {appointmentToDelete.protocol}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(appointmentToDelete.date), 'dd/MM/yyyy', { locale: ptBR })} às {appointmentToDelete.time}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleDeleteDialogChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
