import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'wouter'
import { format, parseISO, subDays, startOfDay, isBefore } from 'date-fns'
import { toast } from 'sonner'
import { LocationStep } from './wizard/LocationStep'
import { DateStep } from './wizard/DateStep'
import { TimeStep } from './wizard/TimeStep'
import { PersonalDataStep } from './wizard/PersonalDataStep'
import { ConfirmationScreen } from '@/components/ConfirmationScreen'
import { UserDashboard } from '@/components/UserDashboard'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/Modal'
import { LGPDConsent } from '@/components/LGPDConsent'
import { validateCPF, validatePhone, validateEmail, generateProtocol } from '@/lib/validators'
import { createAuditLog } from '@/lib/audit-logger'
import { BLOCK_WINDOW_DAYS, isRescheduleBlocked, MAX_RESCHEDULES_PER_WINDOW } from '@/lib/appointment-limits'
import { api } from '@/lib/api'
import { sendConfirmationNotification } from '@/lib/notifications'
import type {
  Appointment,
  AppointmentStatus,
  BlockedDate,
  Location,
  StatusChangeHistory,
  SystemConfig,
  TimeSlot,
  LGPDConsent as LGPDConsentType
} from '@/lib/types'

const DEFAULT_WORKING_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

const DEFAULT_MAX_APPOINTMENTS_PER_SLOT = 2

interface AddressDistrict {
  id: number
  nome: string
}

interface AddressHeadquarter {
  id: number
  nome: string
}

interface AddressNeighborhood {
  id: number
  nome: string
  distritoId?: number | null
  isSede?: boolean
}

interface AddressOptions {
  sedes?: AddressHeadquarter[]
  headquarters?: AddressHeadquarter[]
  distritos?: AddressDistrict[]
  districts: AddressDistrict[]
  bairros?: AddressNeighborhood[]
  neighborhoods: AddressNeighborhood[]
}

const EMPTY_FORM = {
  fullName: '',
  cpf: '',
  rg: '',
  phone: '',
  email: '',
  gender: '',
  locationId: '',
  street: '',
  number: '',
  neighborhood: '',
  rgType: '',
  regionType: '',
  sedeId: '',
  districtId: '',
  neighborhoodId: ''
}

type StepId = 'location' | 'date' | 'time' | 'form' | 'confirmation'

interface NovoAgendamentoProps {
  appointments?: Appointment[]
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[] | undefined>>
  locations: Location[]
  blockedDates?: BlockedDate[]
  systemConfig?: SystemConfig
  requiresLgpdConsent?: boolean
  defaultWorkingHours?: string[]
  defaultMaxAppointmentsPerSlot?: number
  onUserCancelAppointment?: (appointmentId: string, reason: string) => Promise<void> | void
  tenantSlug?: string
}

export function NovoAgendamento({
  appointments,
  setAppointments,
  locations,
  blockedDates,
  systemConfig,
  requiresLgpdConsent,
  defaultWorkingHours = DEFAULT_WORKING_HOURS,
  defaultMaxAppointmentsPerSlot = DEFAULT_MAX_APPOINTMENTS_PER_SLOT,
  onUserCancelAppointment,
  tenantSlug
}: NovoAgendamentoProps) {
  const [currentPath, navigate] = useLocation()
  const [step, setStep] = useState<StepId>('location')
  const [availableLocations, setAvailableLocations] = useState<Location[]>(locations)
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedTime, setSelectedTime] = useState<string | undefined>()
  const [locationBlockedDates, setLocationBlockedDates] = useState<BlockedDate[]>([])
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [lgpdConsentData, setLgpdConsentData] = useState<LGPDConsentType | null>(null)
  const [showLgpdModal, setShowLgpdModal] = useState(false)
  const [notificationConsentChecked, setNotificationConsentChecked] = useState(false)
  const [addressOptions, setAddressOptions] = useState<AddressOptions | null>(null)
  const [cpfBloqueado, setCpfBloqueado] = useState<boolean>(false)
  const [cpfBloqueioInfo, setCpfBloqueioInfo] = useState<{
    dataDesbloqueio?: string;
    motivo?: string;
  } | null>(null)
  const [cpfTemAgendamentoPendente, setCpfTemAgendamentoPendente] = useState<boolean>(false)
  const [agendamentoPendenteInfo, setAgendamentoPendenteInfo] = useState<{
    protocolo?: string;
    data?: string;
    hora?: string;
  } | null>(null)

  const safeAppointments = appointments || []
  const bookingWindowDays = Math.max(1, systemConfig?.bookingWindowDays || 60)
  const effectiveWorkingHours = systemConfig?.workingHours || defaultWorkingHours
  const effectiveMaxPerSlot = systemConfig?.maxAppointmentsPerSlot || defaultMaxAppointmentsPerSlot
  const steps = [
    { id: 'location', label: '1. Escolher Local' },
    { id: 'date', label: '2. Escolher Data' },
    { id: 'time', label: '3. Escolher Horário' },
    { id: 'form', label: '4. Dados Pessoais' }
  ] as const
  const needsLgpdConsent = requiresLgpdConsent !== false
  const shouldShowPublicHeader = Boolean(currentPath?.includes('/agendar'))
  const derivedTenantSlug = useMemo(() => {
    if (tenantSlug) return tenantSlug
    if (!currentPath) return undefined
    const segments = currentPath.split('/').filter(Boolean)
    return segments.length > 0 ? segments[0] : undefined
  }, [tenantSlug, currentPath])
  const handleBackToHome = useCallback(() => {
    const targetPath = derivedTenantSlug ? `/${derivedTenantSlug}` : '/'
    navigate(targetPath)
  }, [derivedTenantSlug, navigate])

  useEffect(() => {
    setAvailableLocations(locations)
  }, [locations])

  useEffect(() => {
    const loadAddressOptions = async () => {
      try {
        const headers: Record<string, string> = {}
        if (typeof window !== 'undefined') {
          const storedTenantId = localStorage.getItem('tenantId')
          const storedTenantSlug = derivedTenantSlug || localStorage.getItem('tenantSlug')
          if (storedTenantId) {
            headers['x-tenant-id'] = storedTenantId
          } else if (storedTenantSlug) {
            headers['x-prefeitura-slug'] = storedTenantSlug
          }
        }
        console.log('[NovoAgendamento] Carregando address-options com headers:', headers)
        const response = await fetch('/api/public/address-options', { headers })
        if (response.ok) {
          const data = await response.json()
          console.log('[NovoAgendamento] Address options carregadas:', data)
          setAddressOptions(data)
        } else {
          console.error('[NovoAgendamento] Erro ao carregar address-options:', response.status)
        }
      } catch (error) {
        console.error('[NovoAgendamento] Erro ao carregar opções de endereço:', error)
      }
    }
    loadAddressOptions()
  }, [derivedTenantSlug])

  useEffect(() => {
    const active = availableLocations.filter((location) => location.isActive !== false)
    if (active.length === 1) {
      const single = active[0]
      setSelectedLocationId(single.id)
      setFormData((prev) => ({ ...prev, locationId: single.id }))
      setLocationBlockedDates([])
    }
  }, [availableLocations])

  useEffect(() => {
    if (selectedLocationId) {
      setFormData((prev) => ({ ...prev, locationId: selectedLocationId }))
    }
  }, [selectedLocationId])

  const fetchBlockedDatesByLocation = useCallback(async (locationId: string) => {
    return (blockedDates || []).filter((entry) => !entry.locationId || entry.locationId === locationId)
  }, [blockedDates])

  const availableTimeSlots = useMemo<TimeSlot[]>(() => {
    if (!selectedDate || !selectedLocationId) return []

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    // Exclui cancelados: não ocupam vagas no horário
    const appointmentsOnDate = safeAppointments.filter(
      (appt) =>
        appt.date === dateStr &&
        String(appt.locationId) === String(selectedLocationId) &&
        appt.status !== 'cancelled'
    )

    const hasFullDayBlock = locationBlockedDates.some(
      (block) => block.date === dateStr && block.blockType === 'full-day'
    )

    const blockedTimes = new Set<string>()
    locationBlockedDates
      .filter((block) => block.date === dateStr && block.blockType === 'specific-times')
      .forEach((block) => (block.blockedTimes || []).forEach((time) => blockedTimes.add(time)))

    // Verificar se a data selecionada é hoje
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const isToday = dateStr === today
    const currentTime = isToday ? format(now, 'HH:mm') : null

    return effectiveWorkingHours.map((time) => {
      // Bloquear horários que já passaram se for hoje
      if (isToday && currentTime && time <= currentTime) {
        return { time, available: false, count: 0 }
      }

      if (hasFullDayBlock || blockedTimes.has(time)) {
        return { time, available: false, count: 0 }
      }

      const count = appointmentsOnDate.filter((appt) => appt.time === time).length
      return {
        time,
        available: count < effectiveMaxPerSlot,
        count
      }
    })
  }, [selectedDate, selectedLocationId, safeAppointments, locationBlockedDates, effectiveWorkingHours, effectiveMaxPerSlot])

  const handleFormChange = (field: string, value: string) => {
    if (field === 'locationId') {
      toast.info('Para alterar o local, retorne ao Passo 1.')
      return
    }

    if (field === 'email' && emailError) {
      setEmailError(null)
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const registerLgpdConsent = useCallback((notificationOverride?: boolean) => {
    const notificationAccepted = typeof notificationOverride === 'boolean'
      ? notificationOverride
      : notificationConsentChecked
    const consentRecord: LGPDConsentType = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      userCPF: formData.cpf || '',
      consentDate: new Date().toISOString(),
      consentVersion: systemConfig?.lgpdSettings?.consentVersion || '1.0',
      dataUsageAccepted: true,
      notificationAccepted,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    }
    setLgpdConsentData(consentRecord)
  }, [formData.cpf, notificationConsentChecked, systemConfig?.lgpdSettings?.consentVersion])

  const handleLgpdModalAccept = useCallback(() => {
    setNotificationConsentChecked(true)
    registerLgpdConsent(true)
    setShowLgpdModal(false)
  }, [registerLgpdConsent])

  const handleLgpdModalDecline = useCallback(() => {
    setShowLgpdModal(false)
    setLgpdConsentData(null)
    setNotificationConsentChecked(false)
  }, [])

  const handleOpenLgpdModal = useCallback(() => {
    setShowLgpdModal(true)
  }, [])

  const handleNotificationConsentChange = useCallback((checked: boolean) => {
    setNotificationConsentChecked(checked)
    setLgpdConsentData((prev) => (prev ? { ...prev, notificationAccepted: checked } : prev))
  }, [])

  useEffect(() => {
    if (!lgpdConsentData) return
    setNotificationConsentChecked(lgpdConsentData.notificationAccepted)
  }, [lgpdConsentData])

  const validateRequiredFields = () => {
    const errors: string[] = []
    const fullName = typeof formData.fullName === 'string' ? formData.fullName.trim() : ''
    const cpfValue = typeof formData.cpf === 'string' ? formData.cpf : ''
    const phoneValue = typeof formData.phone === 'string' ? formData.phone : ''
    const emailFilled = typeof formData.email === 'string' ? formData.email.trim() !== '' : false
    const locationValue = typeof formData.locationId === 'string' && formData.locationId.trim()
      ? formData.locationId.trim()
      : selectedLocationId || ''
    const rgTypeValue = typeof formData.rgType === 'string' ? formData.rgType.trim() : ''

    if (fullName.split(' ').length < 2) {
      errors.push('Nome completo válido')
    }

    if (!validateCPF(cpfValue)) {
      errors.push('CPF válido')
    }

    if (!validatePhone(phoneValue)) {
      errors.push('Telefone válido')
    }

    if (!emailFilled) {
      errors.push('Email informado')
    }

    if (!locationValue) {
      errors.push('Local de atendimento selecionado')
    }

    if (!rgTypeValue) {
      errors.push('Tipo de CIN selecionado')
    }

    const customFields = systemConfig?.customFields || []
    for (const field of customFields) {
      if (field.enabled && field.required) {
        const value = formData[field.id as keyof typeof formData]
        if (!value || !String(value).trim()) {
          errors.push(field.label)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const hasLgpdConsent = !needsLgpdConsent || !!lgpdConsentData?.dataUsageAccepted
  const canSubmitAppointment = hasLgpdConsent

  const resetFlow = () => {
    setStep('location')
    setSelectedDate(undefined)
    setSelectedTime(undefined)
    setLocationBlockedDates([])
    setConfirmedAppointment(null)
    setFormData((prev) => ({ ...EMPTY_FORM, locationId: prev.locationId }))
    setLgpdConsentData(null)
    setShowLgpdModal(false)
    setNotificationConsentChecked(false)
    setCpfBloqueado(false)
    setCpfBloqueioInfo(null)
    setCpfTemAgendamentoPendente(false)
    setAgendamentoPendenteInfo(null)
  }
  
  const verificarBloqueioCP = async (cpf: string) => {
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
      setCpfBloqueado(false)
      setCpfBloqueioInfo(null)
      setCpfTemAgendamentoPendente(false)
      setAgendamentoPendenteInfo(null)
      return
    }
    
    try {
      // 1. Verificar bloqueio
      const responseBloqueio = await api.get(`/bloqueio/verificar/${cpf}`)
      const bloqueio = responseBloqueio.data
      
      if (bloqueio.bloqueado) {
        setCpfBloqueado(true)
        const dataFormatada = bloqueio.dataDesbloqueio 
          ? new Date(bloqueio.dataDesbloqueio).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'indeterminada'
        
        setCpfBloqueioInfo({
          dataDesbloqueio: dataFormatada,
          motivo: bloqueio.motivo
        })
        
        toast.error(`CPF bloqueado temporariamente até ${dataFormatada}`, {
          duration: 6000,
          description: `Você cancelou ${bloqueio.cancelamentosCount} agendamentos nos últimos 7 dias.`
        })
        return
      } else {
        setCpfBloqueado(false)
        setCpfBloqueioInfo(null)
      }
      
      // 2. Verificar se tem agendamento pendente
      try {
        const responseConsulta = await api.get(`/agendamentos/consultar/${cpf}`)
        const consultaData = responseConsulta.data
        
        if (consultaData.found && consultaData.appointments) {
          const agendamentoPendente = consultaData.appointments.find((apt: any) => 
            apt.status === 'pending' || apt.status === 'pendente'
          )
          
          if (agendamentoPendente) {
            setCpfTemAgendamentoPendente(true)
            setAgendamentoPendenteInfo({
              protocolo: agendamentoPendente.protocol,
              data: agendamentoPendente.date,
              hora: agendamentoPendente.time
            })
            
            toast.warning('Você já possui um agendamento pendente', {
              duration: 8000,
              description: `Protocolo: ${agendamentoPendente.protocol}. Cancele-o para realizar um novo agendamento.`
            })
          } else {
            setCpfTemAgendamentoPendente(false)
            setAgendamentoPendenteInfo(null)
          }
        } else {
          setCpfTemAgendamentoPendente(false)
          setAgendamentoPendenteInfo(null)
        }
      } catch (consultaError) {
        console.log('[NovoAgendamento] Nenhum agendamento encontrado ou erro na consulta')
        setCpfTemAgendamentoPendente(false)
        setAgendamentoPendenteInfo(null)
      }
      
    } catch (error) {
      console.error('[NovoAgendamento] Erro ao verificar bloqueio:', error)
      setCpfBloqueado(false)
      setCpfBloqueioInfo(null)
      setCpfTemAgendamentoPendente(false)
      setAgendamentoPendenteInfo(null)
    }
  }

  const handleSubmit = async () => {
    if (!selectedLocationId || !selectedDate || !selectedTime) {
      toast.error('Selecione local, data e horário antes de confirmar.')
      return
    }
    
    // Verifica se o CPF está bloqueado
    if (cpfBloqueado) {
      toast.error('CPF bloqueado temporariamente', {
        duration: 6000,
        description: cpfBloqueioInfo?.motivo || 'Você não pode realizar agendamentos no momento.'
      })
      return
    }
    
    // Verifica se já tem agendamento pendente
    if (cpfTemAgendamentoPendente) {
      toast.error('Você já possui um agendamento pendente', {
        duration: 8000,
        description: 'Cancele o agendamento existente para realizar um novo.'
      })
      return
    }

    const { isValid, errors } = validateRequiredFields()
    if (!isValid) {
      console.warn('[NovoAgendamento] Campos obrigatórios pendentes:', errors)
      const errorMessage = errors.length === 1
        ? `Corrija o campo: ${errors[0]}`
        : `Corrija os campos obrigatórios: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
      toast.error(errorMessage)
      return
    }

    if (needsLgpdConsent && !hasLgpdConsent) {
      toast.error('É necessário aceitar o consentimento LGPD para continuar.')
      return
    }

    const notificationsAccepted = needsLgpdConsent
      ? Boolean(lgpdConsentData?.notificationAccepted ?? notificationConsentChecked)
      : true

    const cpfValue = typeof formData.cpf === 'string' ? formData.cpf : ''
    const userAppointments = safeAppointments.filter((appt) => appt.cpf === cpfValue)
    const todayStart = startOfDay(new Date())
    const blockWindowStart = subDays(todayStart, BLOCK_WINDOW_DAYS)

    const recentNoShows = userAppointments.filter((appt) => {
      if (!['pending', 'confirmed'].includes(appt.status)) return false
      const appointmentDate = parseISO(appt.date)
      return isBefore(appointmentDate, todayStart) && appointmentDate >= blockWindowStart
    })

    if (recentNoShows.length >= 3) {
      toast.error('Você atingiu o limite de 3 faltas nos últimos 7 dias. Aguarde 7 dias para tentar novamente.')
      return
    }

    if (isRescheduleBlocked(safeAppointments, cpfValue)) {
      toast.error(`Você atingiu o limite de ${MAX_RESCHEDULES_PER_WINDOW} reagendamentos nos últimos ${BLOCK_WINDOW_DAYS} dias. Aguarde 7 dias para tentar novamente.`)
      return
    }

    const recentCancellations = userAppointments.filter((appt) => {
      if (appt.status !== 'cancelled') return false
      const referenceDate = appt.lastModified ? new Date(appt.lastModified) : parseISO(appt.date)
      return referenceDate >= blockWindowStart
    })

    if (recentCancellations.length >= 3) {
      toast.error('Você atingiu o limite de 3 cancelamentos/faltas registradas nos últimos 7 dias. Aguarde 7 dias para tentar novamente.')
      return
    }

    const activeStatuses: AppointmentStatus[] = ['pending', 'confirmed', 'awaiting-issuance', 'cin-ready']
    const existingActiveAppointment = userAppointments.find((appt) => {
      if (!activeStatuses.includes(appt.status)) return false
      const appointmentDate = parseISO(appt.date)
      return !isBefore(appointmentDate, todayStart)
    })

    if (existingActiveAppointment) {
      const locationName = availableLocations.find((loc) => loc.id === existingActiveAppointment.locationId)?.name || 'local selecionado'
      const formattedDate = format(parseISO(existingActiveAppointment.date), 'dd/MM/yyyy')
      toast.error(`Você já possui um agendamento para o dia ${formattedDate}, às ${existingActiveAppointment.time}, no ${locationName}. Se desejar remarcar, cancele o agendamento anterior na aba "Consultar Agendamento" e faça um novo agendamento após o cancelamento.`)
      return
    }

    const emailValue = typeof formData.email === 'string' ? formData.email : ''
    if (!validateEmail(emailValue)) {
      setEmailError('Por favor, insira um email válido')
      return
    }

    setEmailError(null)

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existingAppointment = userAppointments.find(
      (appt) => appt.date === dateStr && appt.status !== 'cancelled'
    )

    if (existingAppointment) {
      toast.error('Já existe um agendamento para este CPF nesta data.')
      return
    }

    setIsSubmitting(true)

    try {
      const initialHistory: StatusChangeHistory = {
        id: crypto.randomUUID(),
        from: null,
        to: 'pending',
        changedBy: formData.fullName,
        changedAt: new Date().toISOString(),
        reason: 'Agendamento criado pelo usuário'
      }

      const customFieldValues: Record<string, unknown> = {}
      const customFields = systemConfig?.customFields || []
      customFields.forEach((field) => {
        if (field.enabled && formData[field.id as keyof typeof formData]) {
          customFieldValues[field.id] = formData[field.id as keyof typeof formData]
        }
      })

      // Buscar o nome da região
      let regionName = ''
      console.log('[NovoAgendamento] Buscando nome da região:', {
        regionType: formData.regionType,
        sedeId: formData.sedeId,
        districtId: formData.districtId,
        addressOptions
      })
      
      if (formData.regionType === 'Sede' && formData.sedeId && addressOptions) {
        const sedesList = addressOptions.sedes || addressOptions.headquarters || []
        const sede = sedesList.find(h => h.id.toString() === formData.sedeId)
        regionName = sede?.nome || formData.sedeId
        console.log('[NovoAgendamento] Sede encontrada:', sede, 'regionName:', regionName)
      } else if (formData.regionType === 'Distrito' && formData.districtId && addressOptions) {
        const distritosList = addressOptions.distritos || addressOptions.districts || []
        const distrito = distritosList.find(d => d.id.toString() === formData.districtId)
        regionName = distrito?.nome || formData.districtId
        console.log('[NovoAgendamento] Distrito encontrado:', distrito, 'regionName:', regionName)
      }

      const newAppointment: Appointment = {
        id: crypto.randomUUID(),
        protocol: generateProtocol(),
        fullName: formData.fullName,
        cpf: formData.cpf,
        rg: formData.rg,
        phone: formData.phone,
        email: emailValue,
        gender: formData.gender,
        locationId: selectedLocationId,
        street: formData.street,
        number: formData.number,
        neighborhood: formData.neighborhood,
        rgType: formData.rgType as '1ª via' | '2ª via',
        regionType: formData.regionType || undefined,
        regionName: regionName || undefined,
        sedeId: formData.sedeId || undefined,
        districtId: formData.districtId || undefined,
        neighborhoodId: formData.neighborhoodId || undefined,
        date: dateStr,
        time: selectedTime,
        status: 'pending' as AppointmentStatus,
        createdAt: new Date().toISOString(),
        statusHistory: [initialHistory],
        customFieldValues,
        lgpdConsent: lgpdConsentData || undefined
      }

      // ENVIAR PARA O BACKEND POSTGRESQL
      try {
        console.log('[NovoAgendamento] Enviando para API:', newAppointment)
        
        // Buscar o nome da região para enviar ao backend
        let regionNameForBackend = ''
        if (formData.regionType === 'Sede' && formData.sedeId && addressOptions) {
          const sedesList = addressOptions.sedes || addressOptions.headquarters || []
          const sede = sedesList.find(h => h.id.toString() === formData.sedeId)
          regionNameForBackend = sede?.nome || formData.sedeId
        } else if (formData.regionType === 'Distrito' && formData.districtId && addressOptions) {
          const distritosList = addressOptions.distritos || addressOptions.districts || []
          const distrito = distritosList.find(d => d.id.toString() === formData.districtId)
          regionNameForBackend = distrito?.nome || formData.districtId
        }
        
        const savedRecord = await api.post<{ id: number | string } & Record<string, unknown>>('/agendamentos', {
          protocol: newAppointment.protocol,
          name: formData.fullName,
          cpf: formData.cpf,
          phone: formData.phone,
          email: emailValue,
          gender: formData.gender,
          cinType: formData.rgType,
          cinNumber: formData.rg,
          street: formData.street,
          number: formData.number,
          regionType: formData.regionType,
          region: regionNameForBackend || formData.sedeId || formData.districtId,
          neighborhood: formData.neighborhood,
          date: dateStr,
          time: selectedTime,
          termsAccepted: true,
          notificationsAccepted,
          locationId: selectedLocationId,
          customFieldValues
        })
        // Usa o ID real do banco (integer) em vez do UUID gerado no frontend
        if (savedRecord?.id) {
          newAppointment.id = String(savedRecord.id)
        }
        console.log('[NovoAgendamento] ✅ Salvo no PostgreSQL com sucesso! ID do banco:', newAppointment.id)
      } catch (apiError: any) {
        console.error('[NovoAgendamento] ❌ Erro ao salvar no PostgreSQL:', apiError)
        
        // Verifica se é erro de bloqueio de CPF
        if (apiError.response?.status === 403 && apiError.response?.data?.bloqueado) {
          const errorData = apiError.response.data;
          toast.error(errorData.message || 'CPF bloqueado temporariamente', {
            duration: 8000,
            description: errorData.motivo
          })
          throw apiError
        }
        
        toast.error('Erro ao salvar no banco de dados. Tente novamente.')
        throw apiError
      }

      setAppointments((current) => [...(current || []), newAppointment])
      setConfirmedAppointment(newAppointment)
      setStep('confirmation')
      toast.success('Agendamento realizado com sucesso!')

      await createAuditLog({
        action: 'appointment_created',
        description: `Agendamento criado para ${formData.fullName} no dia ${format(selectedDate, 'dd/MM/yyyy')} às ${selectedTime}`,
        performedBy: formData.fullName,
        performedByRole: 'user',
        targetType: 'appointment',
        targetId: newAppointment.id,
        targetName: `${formData.fullName} - ${newAppointment.protocol}`,
        metadata: {
          protocol: newAppointment.protocol,
          date: dateStr,
          time: selectedTime,
          locationId: selectedLocationId,
          rgType: formData.rgType
        }
      })

      const location = availableLocations.find((loc) => loc.id === selectedLocationId)

      if (notificationsAccepted) {
        try {
          const appointmentWithConsent = {
            ...newAppointment,
            lgpdConsent: { notificationAccepted: true }
          }
          const notificationResult = await sendConfirmationNotification(
            appointmentWithConsent,
            systemConfig,
            location?.address,
            location?.googleMapsUrl,
            location?.name
          )
          if (notificationResult.success) {
            const channels: string[] = []
            if (notificationResult.emailSent) channels.push('Email')
            if (notificationResult.whatsappSent) channels.push('WhatsApp')
            toast.success(`Confirmação enviada via ${channels.join(', ')}`)
          }
        } catch (error) {
          console.error('[NovoAgendamento] Falha ao enviar confirmação:', error)
        }
      } else {
        toast.info('Notificações não enviadas: cidadão desmarcou o recebimento nos termos.')
      }
    } catch (error) {
      console.error('[NovoAgendamento] Falha ao concluir agendamento', error)
      toast.error('Não foi possível concluir o agendamento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (step === 'confirmation' && confirmedAppointment) {
    return (
      <ConfirmationScreen
        appointment={confirmedAppointment}
        locations={availableLocations}
        onNewAppointment={resetFlow}
      />
    )
  }

  return (
    <>
      <div className="space-y-8">
        {shouldShowPublicHeader && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-2 px-0 text-primary hover:bg-primary/10"
              onClick={handleBackToHome}
            >
              <span aria-hidden="true">←</span>
              Voltar para o início
            </Button>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Serviço
              </p>
              <p className="text-lg font-semibold text-foreground">Agendamento de CIN (Carteira de Identidade Nacional)</p>
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-4">
          {steps.map(({ id, label }) => (
            <div
              key={id}
              className={`rounded-2xl border p-4 text-center text-sm font-semibold transition-colors ${
                step === id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {step === 'location' && (
          <LocationStep
            locations={availableLocations}
            selectedLocationId={selectedLocationId}
            onSelect={(id) => {
              setSelectedLocationId(id)
              setSelectedDate(undefined)
              setSelectedTime(undefined)
              setLocationBlockedDates([])
            }}
            onContinue={() => setStep('date')}
            onLocationsLoaded={setAvailableLocations}
            autoAdvance={false}
            tenantSlug={tenantSlug}
          />
        )}

        {step === 'date' && (
          <DateStep
            locationId={selectedLocationId}
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              setSelectedDate(date)
              setSelectedTime(undefined)
              if (date) {
                setStep('time')
              }
            }}
            fetchBlockedDates={fetchBlockedDatesByLocation}
            onBlockedDatesChange={setLocationBlockedDates}
            onBack={() => setStep('location')}
            maxAdvanceDays={bookingWindowDays}
            appointments={safeAppointments}
            workingHours={effectiveWorkingHours}
            maxAppointmentsPerSlot={effectiveMaxPerSlot}
          />
        )}

        {step === 'time' && (
          <TimeStep
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            slots={availableTimeSlots}
            onSelect={(time) => {
              setSelectedTime(time)
              setStep('form')
            }}
            onBack={() => { setSelectedTime(undefined); setStep('date') }}
          />
        )}

        {step === 'form' && (
          <div className="space-y-6">
            {formData.cpf && validateCPF(formData.cpf) && onUserCancelAppointment && !cpfTemAgendamentoPendente && (
              <UserDashboard
                userCPF={formData.cpf}
                appointments={safeAppointments}
                onCancelAppointment={onUserCancelAppointment}
              />
            )}
            
            <PersonalDataStep
              formData={formData}
              onChange={handleFormChange}
              locations={availableLocations}
              customFields={systemConfig?.customFields}
              onBack={() => setStep('time')}
              onSubmit={handleSubmit}
              canSubmit={canSubmitAppointment}
              isSubmitting={isSubmitting}
              emailError={emailError}
              requiresLgpdConsent={needsLgpdConsent}
              lgpdConsent={lgpdConsentData}
              notificationConsentChecked={notificationConsentChecked}
              onNotificationConsentChange={handleNotificationConsentChange}
              onOpenLgpdModal={handleOpenLgpdModal}
              tenantSlug={derivedTenantSlug}
              onCpfBlur={verificarBloqueioCP}
              hasPendingAppointment={cpfTemAgendamentoPendente}
              pendingAppointmentInfo={agendamentoPendenteInfo}
            />
          </div>
        )}
      </div>

      <Modal isOpen={showLgpdModal} onClose={handleLgpdModalDecline}>
        <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="max-h-[78vh] overflow-y-auto px-6 py-6">
            <LGPDConsent config={systemConfig} />
          </div>
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleLgpdModalDecline}
              className="h-11 flex-1 border-destructive text-destructive hover:bg-destructive/10"
            >
              Não Aceito
            </Button>
            <Button onClick={handleLgpdModalAccept} className="h-11 flex-1 font-semibold">
              Aceito
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
