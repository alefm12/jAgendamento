import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Calendar, Search, X as XIcon, MapPin, CheckCircle, Clock } from 'lucide-react'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AylaAvatar } from './AylaAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { validateCPF, validatePhone, validateEmail, generateProtocol } from '@/lib/validators'
import { toast } from 'sonner'
import type { Location, BlockedDate, TimeSlot } from '@/lib/types'

type MessageType = 'bot' | 'user'
type ConversationStep = 
  | 'welcome' 
  | 'menu'
  | 'schedule-location'
  | 'schedule-date'
  | 'schedule-time'
  | 'schedule-form-name'
  | 'schedule-form-cpf'
  | 'schedule-form-rgtype'
  | 'schedule-form-rgnumber'
  | 'schedule-form-gender'
  | 'schedule-form-phone'
  | 'schedule-form-email'
  | 'schedule-form-region'
  | 'schedule-form-district'
  | 'schedule-form-street'
  | 'schedule-form-number'
  | 'schedule-form-neighborhood'
  | 'schedule-confirmation'
  | 'consult-cpf'
  | 'consult-result'
  | 'cancel-cpf'
  | 'cancel-code'
  | 'cancel-result'
  | 'locations-list'

interface Message {
  id: string
  type: MessageType
  content: string | React.ReactNode
  timestamp: Date
}

interface AylaChatProps {
  tenantSlug?: string
  onClose: () => void
}

interface AylaAvailabilityAppointment {
  id: string
  locationId: string
  date: string
  time: string
  status: string
}

interface PublicScheduleConfig {
  workingHours: string[]
  maxAppointmentsPerSlot: number
  bookingWindowDays: number
}

interface AvailabilitySnapshot {
  fetchedAt: number
  appointments: AylaAvailabilityAppointment[]
  blockedDates: BlockedDate[]
  scheduleConfig: PublicScheduleConfig
}

const normalizeDateKey = (value: unknown): string => {
  if (!value) return ''

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  const raw = String(value).trim()
  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return raw.slice(0, 10)
}

const normalizeTimeKey = (value: unknown): string => {
  if (!value) return ''

  const raw = String(value).trim()
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    return raw
  }

  const [, hour, minute] = match
  return `${hour.padStart(2, '0')}:${minute}`
}

const isCancelledStatus = (value: unknown): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized.startsWith('cancel')
}

const DEFAULT_WORKING_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

const DEFAULT_SCHEDULE_CONFIG: PublicScheduleConfig = {
  workingHours: DEFAULT_WORKING_HOURS,
  maxAppointmentsPerSlot: 2,
  bookingWindowDays: 60
}

const AVAILABILITY_CACHE_TTL_MS = 20_000

export function AylaChat({ tenantSlug, onClose }: AylaChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentStep, setCurrentStep] = useState<ConversationStep>('welcome')
  const [conversationData, setConversationData] = useState<any>({})
  const [locations, setLocations] = useState<Location[]>([])
  const [scheduleConfig, setScheduleConfig] = useState<PublicScheduleConfig>(DEFAULT_SCHEDULE_CONFIG)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const availabilitySnapshotRef = useRef<AvailabilitySnapshot | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Mensagem de boas-vindas
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold text-lg">Olá, eu sou a Ayla! 👋</p>
        <p>Assistente Virtual desenvolvida para lhe ajudar.</p>
        <p className="text-sm opacity-90">Conte conosco para um atendimento rápido e eficiente!</p>
      </div>
    )
    
    setTimeout(() => {
      showMainMenu()
    }, 1000)

    // Carregar dados iniciais
    loadLocations()
    loadScheduleConfig()
  }, [])

  useEffect(() => {
    availabilitySnapshotRef.current = null
  }, [tenantSlug])

  const normalizeLocation = (location: any): Location => ({
    id: String(location?.id ?? ''),
    name: String(location?.name ?? location?.nome_local ?? location?.nome ?? ''),
    address: String(location?.address ?? location?.endereco ?? ''),
    city: location?.city,
    type: location?.type,
    googleMapsUrl: location?.googleMapsUrl ?? location?.link_mapa,
    isActive: typeof location?.isActive === 'boolean'
      ? location.isActive
      : (typeof location?.ativo === 'boolean' ? location.ativo : true),
    createdAt: String(location?.createdAt ?? location?.criado_em ?? new Date().toISOString())
  })

  const loadScheduleConfig = async () => {
    if (!tenantSlug) {
      setScheduleConfig(DEFAULT_SCHEDULE_CONFIG)
      return DEFAULT_SCHEDULE_CONFIG
    }

    try {
      const response = await api.get<{
        workingHours?: string[] | null
        maxAppointmentsPerSlot?: number
        bookingWindowDays?: number
      }>(`/public/horarios/${tenantSlug}`, { skipAuthHeaders: true })

      const effectiveConfig: PublicScheduleConfig = {
        workingHours: Array.isArray(response?.workingHours) && response.workingHours.length > 0
          ? response.workingHours
          : DEFAULT_WORKING_HOURS,
        maxAppointmentsPerSlot: Number(response?.maxAppointmentsPerSlot) > 0
          ? Number(response?.maxAppointmentsPerSlot)
          : DEFAULT_SCHEDULE_CONFIG.maxAppointmentsPerSlot,
        bookingWindowDays: Number(response?.bookingWindowDays) > 0
          ? Number(response?.bookingWindowDays)
          : DEFAULT_SCHEDULE_CONFIG.bookingWindowDays
      }

      setScheduleConfig(effectiveConfig)
      return effectiveConfig
    } catch (error) {
      console.error('[Ayla] Erro ao carregar configuração de horários:', error)
      setScheduleConfig(DEFAULT_SCHEDULE_CONFIG)
      return DEFAULT_SCHEDULE_CONFIG
    }
  }

  const loadLocations = async () => {
    try {
      console.log('[Ayla] Carregando locais, tenantSlug:', tenantSlug)
      
      let response: Location[]
      if (tenantSlug) {
        // Rota pública para tenant específico
        response = await api.get<Location[]>(`/public/locations/${tenantSlug}`, { skipAuthHeaders: true })
      } else {
        // Rota geral
        response = await api.get<Location[]>('/locations')
      }
      
      const normalized = Array.isArray(response)
        ? response.map(normalizeLocation).filter((location) => location.name)
        : []

      console.log('[Ayla] Locais carregados:', normalized)
      setLocations(normalized)
      return normalized
    } catch (error) {
      console.error('[Ayla] Erro ao carregar locais:', error)
      setLocations([])
      return []
    }
  }

  const loadAvailabilityAppointments = async (): Promise<AylaAvailabilityAppointment[]> => {
    if (!tenantSlug) {
      return []
    }

    try {
      const response = await api.get<any[]>(`/public/appointments/${tenantSlug}`, {
        skipAuthHeaders: true
      })

      if (!Array.isArray(response)) {
        return []
      }

      return response.map((item) => ({
        id: String(item?.id ?? ''),
        locationId: String(item?.locationId ?? item?.local_id ?? item?.localId ?? ''),
        date: normalizeDateKey(item?.date ?? item?.data_agendamento),
        time: normalizeTimeKey(item?.time ?? item?.hora_agendamento),
        status: String(item?.status ?? '').trim().toLowerCase()
      }))
    } catch (error) {
      console.error('[Ayla] Erro ao carregar agendamentos públicos para disponibilidade:', error)
      return []
    }
  }

  const loadBlockedDatesForAvailability = async (): Promise<BlockedDate[]> => {
    if (!tenantSlug) {
      return []
    }

    try {
      const blockedDatesData = await api.get<any[]>(`/public/blocked-dates/${tenantSlug}`, {
        skipAuthHeaders: true
      })

      return blockedDatesData.map((item: any) => ({
        id: String(item.id),
        date: normalizeDateKey(item.date),
        reason: String(item.reason || ''),
        blockType: item.blockType,
        blockedTimes: Array.isArray(item.blockedSlots)
          ? item.blockedSlots.map((time: unknown) => normalizeTimeKey(time)).filter(Boolean)
          : [],
        createdBy: String(item.createdBy || ''),
        createdAt: String(item.createdAt || new Date().toISOString())
      }))
    } catch (error) {
      console.error('[Ayla] Erro ao carregar bloqueios públicos para disponibilidade:', error)
      return []
    }
  }

  const invalidateAvailabilityCache = () => {
    availabilitySnapshotRef.current = null
  }

  const getAvailabilitySnapshot = async (forceRefresh = false): Promise<AvailabilitySnapshot> => {
    const cached = availabilitySnapshotRef.current
    const now = Date.now()

    if (!forceRefresh && cached && now - cached.fetchedAt <= AVAILABILITY_CACHE_TTL_MS) {
      return cached
    }

    const [appointments, blockedDates, loadedConfig] = await Promise.all([
      loadAvailabilityAppointments(),
      loadBlockedDatesForAvailability(),
      loadScheduleConfig()
    ])

    const snapshot: AvailabilitySnapshot = {
      fetchedAt: now,
      appointments,
      blockedDates,
      scheduleConfig: {
        ...loadedConfig,
        workingHours: loadedConfig.workingHours.map((time) => normalizeTimeKey(time)).filter(Boolean)
      }
    }

    availabilitySnapshotRef.current = snapshot
    return snapshot
  }

  const addBotMessage = (content: string | React.ReactNode) => {
    const message: Message = {
      id: crypto.randomUUID(),
      type: 'bot',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  const simulateTyping = (duration = 800) => {
    setIsTyping(true)
    return new Promise(resolve => {
      setTimeout(() => {
        setIsTyping(false)
        resolve(true)
      }, duration)
    })
  }

  const showMainMenu = async () => {
    await simulateTyping()
    setCurrentStep('menu')
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">Como posso ajudar você hoje?</p>
        <div className="space-y-2">
          <MenuButton 
            icon={<Calendar size={18} />}
            label="Agendar Atendimento"
            onClick={() => handleMenuOption('schedule')}
          />
          <MenuButton 
            icon={<Search size={18} />}
            label="Consultar Status do CIN"
            onClick={() => handleMenuOption('consult')}
          />
          <MenuButton 
            icon={<XIcon size={18} />}
            label="Cancelar Agendamento"
            onClick={() => handleMenuOption('cancel')}
          />
          <MenuButton 
            icon={<MapPin size={18} />}
            label="Locais de Atendimento"
            onClick={() => handleMenuOption('locations')}
          />
        </div>
      </div>
    )
  }

  const handleMenuOption = async (option: string) => {
    addUserMessage(getOptionLabel(option))
    await simulateTyping()

    switch (option) {
      case 'schedule':
        startSchedulingFlow()
        break
      case 'consult':
        startConsultFlow()
        break
      case 'cancel':
        startCancelFlow()
        break
      case 'locations':
        showLocations()
        break
    }
  }

  const getOptionLabel = (option: string) => {
    const labels: Record<string, string> = {
      schedule: '📅 Agendar Atendimento',
      consult: '🔍 Consultar Status do CIN',
      cancel: '❌ Cancelar Agendamento',
      locations: '📍 Locais de Atendimento'
    }
    return labels[option] || option
  }

  const startSchedulingFlow = async () => {
    setCurrentStep('schedule-location')

    console.log('[Ayla] Iniciando fluxo de agendamento')
    console.log('[Ayla] Locais disponíveis:', locations)
    
    // Se não há locais carregados ainda, aguardar o carregamento
    let availableLocations = locations
    if (locations.length === 0) {
      try {
        availableLocations = await loadLocations()
      } catch (error) {
        console.error('[Ayla] Erro ao carregar locais:', error)
        availableLocations = []
      }
    }
    
    const activeLocations = availableLocations.filter(l => l.isActive !== false)
    console.log('[Ayla] Locais ativos:', activeLocations)
    
    if (activeLocations.length === 0) {
      addBotMessage(
        <div className="space-y-3">
          <p className="text-amber-600">⚠️ Não há locais de atendimento disponíveis no momento.</p>
          <p className="text-sm">Por favor, tente novamente mais tarde ou entre em contato conosco.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
      return
    }
    
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">Ótimo! Vamos fazer seu agendamento. 📋</p>
        <p>Primeiro, escolha o local de atendimento:</p>
        <div className="space-y-2">
          {activeLocations.map(location => (
            <MenuButton
              key={location.id}
              icon={<MapPin size={16} />}
              label={location.name}
              onClick={() => handleLocationSelect(location)}
              small
            />
          ))}
        </div>
      </div>
    )
  }

  const handleLocationSelect = async (location: Location) => {
    addUserMessage(location.name)
    
    await simulateTyping()
    setCurrentStep('schedule-date')
    
    const availability = await getAvailabilitySnapshot()
    setConversationData((prev: any) => ({ ...prev, location, blockedDates: availability.blockedDates }))
    showDateSelection(location, availability)
  }

  const showDateSelection = async (location: Location, availability: AvailabilitySnapshot) => {
    const today = startOfDay(new Date())
    const availableDates: Date[] = []

    const blockedDates = availability.blockedDates
    const appointments = availability.appointments
    const workingHours = availability.scheduleConfig.workingHours
    const maxAppointmentsPerSlot = availability.scheduleConfig.maxAppointmentsPerSlot
    const bookingWindowDays = Math.max(1, Math.min(365, availability.scheduleConfig.bookingWindowDays))
    const maxDate = addDays(today, bookingWindowDays)
    
    // Gerar próximas 14 dias disponíveis usando a mesma lógica do DateSelector
    for (let i = 0; i <= bookingWindowDays && availableDates.length < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const normalizedDate = startOfDay(date)

      if (normalizedDate > maxDate) {
        continue
      }
      
      const dateStr = format(date, 'yyyy-MM-dd')
      
      // Verificar se é bloqueio de dia inteiro
      const hasFullDayBlock = blockedDates.some(
        (block) => block.date === dateStr && block.blockType === 'full-day'
      )
      if (hasFullDayBlock) continue
      
      // Obter horários bloqueados específicos
      const blockedTimes = new Set<string>()
      blockedDates
        .filter((block) => block.date === dateStr && block.blockType === 'specific-times')
        .forEach((block) => (block.blockedTimes || []).forEach((time: string) => blockedTimes.add(normalizeTimeKey(time))))
      
      // Verificar se a data é hoje e filtrar horários que já passaram
      const now = new Date()
      const todayStr = format(now, 'yyyy-MM-dd')
      const isToday = dateStr === todayStr
      const currentTime = isToday ? format(now, 'HH:mm') : null
      
      // Contar horários disponíveis
      const appointmentsOnDate = appointments.filter(
        (appt) =>
          appt.date === dateStr &&
          String(appt.locationId) === String(location.id) &&
          !isCancelledStatus(appt.status)
      )
      
      let availableCount = 0
      for (const time of workingHours) {
        // Pular horários que já passaram se for hoje
        if (isToday && currentTime && time <= currentTime) {
          continue
        }
        
        // Pular se horário está bloqueado
        if (blockedTimes.has(time)) {
          continue
        }
        
        // Contar agendamentos neste horário
        const count = appointmentsOnDate.filter((appt: any) => normalizeTimeKey(appt.time) === time).length
        
        // Se ainda há vagas, incrementar contador
        if (count < maxAppointmentsPerSlot) {
          availableCount++
        }
      }
      
      // Se tem pelo menos 1 horário disponível, adicionar a data
      if (availableCount > 0) {
        availableDates.push(date)
      }
    }
    
    if (availableDates.length === 0) {
      addBotMessage(
        <div className="space-y-3">
          <p className="text-amber-600">⚠️ Não há datas disponíveis no momento para este local.</p>
          <p className="text-sm">Por favor, tente novamente mais tarde ou escolha outro local.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
      return
    }
    
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">Ótimo! Agora escolha uma data disponível:</p>
        <div className="grid grid-cols-2 gap-2">
          {availableDates.map(date => (
            <button
              key={date.toISOString()}
              onClick={() => handleDateSelect(date, location, availability)}
              className="p-3 bg-white hover:bg-purple-50 border border-gray-200 rounded-lg text-left transition-all hover:border-purple-300 hover:shadow-sm"
            >
              <div className="font-medium text-sm">
                {format(date, 'dd/MM/yyyy')}
              </div>
              <div className="text-xs text-gray-500">
                {format(date, 'EEEE', { locale: ptBR })}
              </div>
            </button>
          ))}
        </div>
        <BackToMenuButton onClick={showMainMenu} />
      </div>
    )
  }

  const handleDateSelect = async (date: Date, location: Location, availability: AvailabilitySnapshot) => {
    addUserMessage(format(date, 'dd/MM/yyyy'))
    const blockedDates = availability.blockedDates
    
    // Atualizar conversationData com a data, location e blockedDates
    setConversationData((prev: any) => ({ ...prev, date, location, blockedDates }))
    
    await simulateTyping()
    setCurrentStep('schedule-time')
    
    console.log('[Ayla] handleDateSelect - iniciando', { date, location })
    
    // Calcular horários disponíveis localmente
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      console.log('[Ayla] Data formatada:', dateStr)
      
      // Buscar agendamentos para esta data (snapshot para evitar inconsistência entre telas)
      console.log('[Ayla] Usando snapshot de disponibilidade para horários...')
      const appointments = availability.appointments
      console.log('[Ayla] Agendamentos públicos carregados:', appointments.length)

      const workingHours = availability.scheduleConfig.workingHours
      const maxAppointmentsPerSlot = availability.scheduleConfig.maxAppointmentsPerSlot
      
      // Filtrar appointments para este local e data
      const appointmentsOnDate = appointments.filter(
        (appt) => {
          const apptDate = appt.date
          const apptLocationId = String(appt.locationId)
          const targetLocationId = String(location.id)
          return (
            apptDate === dateStr &&
            apptLocationId === targetLocationId &&
            !isCancelledStatus(appt.status)
          )
        }
      )
      console.log('[Ayla] Agendamentos nesta data:', appointmentsOnDate.length)
      
      // Verificar se é bloqueio de dia inteiro
      const hasFullDayBlock = blockedDates.some(
        (block) => block.date === dateStr && block.blockType === 'full-day'
      )
      
      if (hasFullDayBlock) {
        console.log('[Ayla] Data bloqueada (dia inteiro)')
        addBotMessage(
          <div className="space-y-2">
            <p className="text-amber-600">⚠️ Esta data está bloqueada.</p>
            <p className="text-sm">Por favor, escolha outra data.</p>
            <BackToMenuButton onClick={showMainMenu} />
          </div>
        )
        return
      }
      
      // Obter horários bloqueados específicos
      const blockedTimes = new Set<string>()
      blockedDates
        .filter((block) => block.date === dateStr && block.blockType === 'specific-times')
        .forEach((block) => (block.blockedTimes || []).forEach((time) => blockedTimes.add(normalizeTimeKey(time))))
      
      console.log('[Ayla] Horários bloqueados:', Array.from(blockedTimes))
      
      // Verificar se a data é hoje e filtrar horários que já passaram
      const now = new Date()
      const todayStr = format(now, 'yyyy-MM-dd')
      const isToday = dateStr === todayStr
      const currentTime = isToday ? format(now, 'HH:mm') : null
      
      console.log('[Ayla] É hoje?', isToday, 'Hora atual:', currentTime)
      
      // Calcular slots disponíveis
      const slots: TimeSlot[] = workingHours.map((time) => {
        // Bloquear horários que já passaram se for hoje
        if (isToday && currentTime && time <= currentTime) {
          return { time, available: false, count: 0 }
        }
        
        // Bloquear se horário está bloqueado
        if (blockedTimes.has(time)) {
          return { time, available: false, count: 0 }
        }
        
        // Contar agendamentos neste horário
        const count = appointmentsOnDate.filter((appt) => normalizeTimeKey(appt.time) === time).length
        
        return {
          time,
          available: count < maxAppointmentsPerSlot,
          count
        }
      })
      
      console.log('[Ayla] Slots calculados:', slots)
      console.log('[Ayla] Slots disponíveis:', slots.filter(s => s.available).length)
      
      showTimeSelection(slots)
    } catch (error: any) {
      console.error('[Ayla] Erro ao calcular horários:', error)
      console.error('[Ayla] Stack:', error.stack)
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao carregar horários disponíveis.</p>
          <p className="text-xs text-gray-500">{error.message}</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const showTimeSelection = (slots: TimeSlot[]) => {
    const availableSlots = slots.filter(slot => slot.available)
    
    if (availableSlots.length === 0) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-amber-600">⚠️ Não há horários disponíveis para esta data.</p>
          <p className="text-sm">Por favor, escolha outra data.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
      return
    }
    
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">Perfeito! Escolha um horário:</p>
        <div className="grid grid-cols-3 gap-2">
          {availableSlots.map(slot => (
            <button
              key={slot.time}
              onClick={() => handleTimeSelect(slot.time)}
              className="p-2 bg-white hover:bg-purple-50 border border-gray-200 rounded-lg text-center transition-all hover:border-purple-300 hover:shadow-sm"
            >
              <Clock size={16} className="mx-auto mb-1 text-purple-500" />
              <div className="font-medium text-sm">{slot.time}</div>
            </button>
          ))}
        </div>
        <BackToMenuButton onClick={showMainMenu} />
      </div>
    )
  }

  const handleTimeSelect = async (time: string) => {
    addUserMessage(time)
    setConversationData((prev: any) => ({ ...prev, time }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-name')
    
    addBotMessage(
      <div className="space-y-2">
        <p className="font-semibold">Agora preciso de alguns dados pessoais. 📋</p>
        <p>Por favor, digite seu <span className="font-semibold">nome completo</span>:</p>
      </div>
    )
  }

  const handleNameInput = async (name: string) => {
    if (name.trim().split(' ').length < 2) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Por favor, digite seu nome completo (nome e sobrenome).</p>
        </div>
      )
      return
    }
    
    addUserMessage(name)
    setConversationData((prev: any) => ({ ...prev, fullName: name }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-cpf')
    
    addBotMessage(
      <div className="space-y-2">
        <p>Obrigada, {name.split(' ')[0]}! 😊</p>
        <p>Agora digite seu <span className="font-semibold">CPF</span>:</p>
      </div>
    )
  }

  const handleCpfInput = async (cpf: string) => {
    if (!validateCPF(cpf)) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ CPF inválido. Por favor, digite um CPF válido.</p>
        </div>
      )
      return
    }
    
    addUserMessage(cpf)
    setConversationData((prev: any) => ({ ...prev, cpf }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-rgtype')
    
    addBotMessage(
      <div className="space-y-3">
        <p>Perfeito! Agora escolha o <span className="font-semibold">tipo de CIN</span>:</p>
        <div className="space-y-2">
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="1ª Via"
            onClick={() => handleRgTypeSelect('primeira-via')}
            small
          />
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="2ª Via"
            onClick={() => handleRgTypeSelect('segunda-via')}
            small
          />
        </div>
      </div>
    )
  }

  const handleRgTypeSelect = async (rgType: string) => {
    const label = rgType === 'primeira-via' ? '1ª Via' : '2ª Via'
    addUserMessage(label)
    setConversationData((prev: any) => ({ ...prev, rgType }))
    
    await simulateTyping()
    
    // Se for 2ª via, perguntar se possui RG anterior
    if (rgType === 'segunda-via') {
      setCurrentStep('schedule-form-rgnumber')
      addBotMessage(
        <div className="space-y-3">
          <p>Você possui o número do <span className="font-semibold">RG anterior</span>?</p>
          <div className="space-y-2">
            <MenuButton
              icon={<CheckCircle size={16} />}
              label="Sim, vou informar"
              onClick={() => handleHasOldRg(true)}
              small
            />
            <MenuButton
              icon={<XIcon size={16} />}
              label="Não possuo"
              onClick={() => handleHasOldRg(false)}
              small
            />
          </div>
        </div>
      )
    } else {
      // Se for 1ª via, pular para gênero
      askGender()
    }
  }

  const handleHasOldRg = async (hasRg: boolean) => {
    if (hasRg) {
      addUserMessage('Sim, vou informar')
      await simulateTyping()
      addBotMessage(
        <div className="space-y-2">
          <p>Por favor, digite o <span className="font-semibold">número do RG anterior</span>:</p>
        </div>
      )
    } else {
      addUserMessage('Não possuo')
      setConversationData((prev: any) => ({ ...prev, rgNumber: '' }))
      askGender()
    }
  }

  const handleRgNumberInput = async (rgNumber: string) => {
    addUserMessage(rgNumber)
    setConversationData((prev: any) => ({ ...prev, rgNumber }))
    
    await simulateTyping()
    askGender()
  }

  const askGender = async () => {
    setCurrentStep('schedule-form-gender')
    addBotMessage(
      <div className="space-y-3">
        <p>Qual é o seu <span className="font-semibold">gênero</span>?</p>
        <div className="space-y-2">
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Masculino"
            onClick={() => handleGenderSelect('Masculino')}
            small
          />
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Feminino"
            onClick={() => handleGenderSelect('Feminino')}
            small
          />
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Não binário"
            onClick={() => handleGenderSelect('Não binário')}
            small
          />
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Prefiro não informar"
            onClick={() => handleGenderSelect('Prefiro não informar')}
            small
          />
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Outro"
            onClick={() => handleGenderSelect('Outro')}
            small
          />
        </div>
      </div>
    )
  }

  const handleGenderSelect = async (gender: string) => {
    addUserMessage(gender)
    setConversationData((prev: any) => ({ ...prev, gender }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-phone')
    
    addBotMessage(
      <div className="space-y-2">
        <p>Agora digite seu <span className="font-semibold">telefone</span> (com DDD):</p>
        <p className="text-xs text-gray-500">Exemplo: (85) 98765-4321</p>
      </div>
    )
  }

  const handlePhoneInput = async (phone: string) => {
    if (!validatePhone(phone)) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Telefone inválido. Por favor, digite um telefone válido (ex: 85987654321).</p>
        </div>
      )
      return
    }
    
    addUserMessage(phone)
    setConversationData((prev: any) => ({ ...prev, phone }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-email')
    
    addBotMessage(
      <div className="space-y-2">
        <p>Ótimo! Agora digite seu <span className="font-semibold">e-mail</span>:</p>
      </div>
    )
  }

  const handleEmailInput = async (email: string) => {
    if (!validateEmail(email)) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ E-mail inválido. Por favor, digite um e-mail válido.</p>
        </div>
      )
      return
    }
    
    addUserMessage(email)
    setConversationData((prev: any) => ({ ...prev, email }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-region')
    
    // Buscar opções de região (sede/distrito)
    try {
      const addressOptions = await api.get<any>('/public/address-options')
      setConversationData((prev: any) => ({ ...prev, addressOptions }))
      
      const sedes = addressOptions.sedes || addressOptions.headquarters || []
      const distritos = addressOptions.distritos || addressOptions.districts || []
      
      addBotMessage(
        <div className="space-y-3">
          <p>Qual é a sua <span className="font-semibold">região</span>?</p>
          <div className="space-y-2">
            <MenuButton
              icon={<MapPin size={16} />}
              label="Sede"
              onClick={() => handleRegionTypeSelect('Sede', sedes, distritos)}
              small
            />
            <MenuButton
              icon={<MapPin size={16} />}
              label="Distrito"
              onClick={() => handleRegionTypeSelect('Distrito', sedes, distritos)}
              small
            />
          </div>
        </div>
      )
    } catch (error) {
      console.error('[Ayla] Erro ao buscar opções de endereço:', error)
      // Se falhar, pular para logradouro
      askStreet()
    }
  }

  const handleRegionTypeSelect = async (regionType: string, sedes: any[], distritos: any[]) => {
    addUserMessage(regionType)
    setConversationData((prev: any) => ({ ...prev, regionType }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-district')
    
    const options = regionType === 'Sede' ? sedes : distritos
    
    if (options.length === 0) {
      // Se não houver opções, pular para logradouro
      askStreet()
      return
    }
    
    if (options.length === 1) {
      // Se houver apenas uma opção, selecionar automaticamente
      handleDistrictSelect(options[0].id, options[0].nome)
      return
    }
    
    addBotMessage(
      <div className="space-y-3">
        <p>Escolha {regionType === 'Sede' ? 'a sede' : 'o distrito'}:</p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {options.map((option: any) => (
            <MenuButton
              key={option.id}
              icon={<MapPin size={16} />}
              label={option.nome}
              onClick={() => handleDistrictSelect(option.id, option.nome)}
              small
            />
          ))}
        </div>
      </div>
    )
  }

  const handleDistrictSelect = async (districtId: number, districtName: string) => {
    addUserMessage(districtName)
    setConversationData((prev: any) => ({ ...prev, districtId, districtName }))
    
    await simulateTyping()
    askStreet()
  }

  const askStreet = () => {
    setCurrentStep('schedule-form-street')
    addBotMessage(
      <div className="space-y-2">
        <p>Digite o <span className="font-semibold">logradouro</span> (rua, avenida, etc.):</p>
        <p className="text-xs text-gray-500">Exemplo: Rua das Flores</p>
      </div>
    )
  }

  const handleStreetInput = async (street: string) => {
    if (!street.trim()) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Por favor, digite o logradouro.</p>
        </div>
      )
      return
    }
    
    addUserMessage(street)
    setConversationData((prev: any) => ({ ...prev, street }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-number')
    
    addBotMessage(
      <div className="space-y-2">
        <p>Agora digite o <span className="font-semibold">número</span> da residência:</p>
        <p className="text-xs text-gray-500">Se não tiver número, digite "S/N"</p>
      </div>
    )
  }

  const handleNumberInput = async (number: string) => {
    if (!number.trim()) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Por favor, digite o número.</p>
        </div>
      )
      return
    }
    
    addUserMessage(number)
    setConversationData((prev: any) => ({ ...prev, number }))
    
    await simulateTyping()
    setCurrentStep('schedule-form-neighborhood')
    
    // Buscar bairros do distrito/sede selecionado
    const { addressOptions, districtId, regionType } = conversationData
    
    if (addressOptions && districtId) {
      const bairros = addressOptions.bairros || addressOptions.neighborhoods || []
      
      // Filtrar bairros pela localidade (distrito/sede)
      const filteredBairros = bairros.filter((bairro: any) => {
        const parentId = bairro.localidadeId || bairro.localidade_id
        return String(parentId) === String(districtId)
      })
      
      console.log('[Ayla] Bairros filtrados:', filteredBairros)
      
      if (filteredBairros.length > 0) {
        addBotMessage(
          <div className="space-y-3">
            <p>Escolha o <span className="font-semibold">bairro/localidade</span>:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredBairros.map((bairro: any) => (
                <MenuButton
                  key={bairro.id}
                  icon={<MapPin size={16} />}
                  label={bairro.nome}
                  onClick={() => handleNeighborhoodSelect(bairro.nome)}
                  small
                />
              ))}
            </div>
          </div>
        )
        return
      }
    }
    
    // Se não houver bairros cadastrados, mostrar mensagem de erro
    addBotMessage(
      <div className="space-y-2">
        <p className="text-amber-600">⚠️ Não há bairros cadastrados para esta região.</p>
        <p className="text-sm">Por favor, entre em contato com o suporte.</p>
        <BackToMenuButton onClick={showMainMenu} />
      </div>
    )
  }

  const handleNeighborhoodSelect = async (neighborhood: string) => {
    addUserMessage(neighborhood)
    
    console.log('[Ayla] handleNeighborhoodSelect - ANTES conversationData:', conversationData)
    
    // Usar callback para pegar o estado mais recente
    setConversationData((prevData: any) => {
      const updatedData = { ...prevData, neighborhood }
      
      console.log('[Ayla] handleNeighborhoodSelect - prevData:', prevData)
      console.log('[Ayla] handleNeighborhoodSelect - updatedData:', updatedData)
      
      // Agendar a próxima etapa para o próximo tick
      setTimeout(() => {
        simulateTyping().then(() => {
          askTermsConsent(updatedData)
        })
      }, 0)
      
      return updatedData
    })
  }

  const askTermsConsent = (currentData: any) => {
    console.log('[Ayla] askTermsConsent - currentData:', currentData)
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">📋 Termos e Consentimentos</p>
        <p className="text-sm">Para finalizar, precisamos do seu consentimento:</p>
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg space-y-2 text-sm">
          <p className="font-semibold text-blue-900">Termos de Uso e LGPD</p>
          <p className="text-blue-800">
            Ao continuar, você concorda com o uso dos seus dados pessoais para finalidades de 
            agendamento e emissão do CIN, conforme a Lei Geral de Proteção de Dados (LGPD).
          </p>
        </div>
        <div className="space-y-2">
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Aceito os termos"
            onClick={() => handleTermsAccept(true, currentData)}
            small
          />
          <MenuButton
            icon={<XIcon size={16} />}
            label="Não aceito"
            onClick={() => handleTermsAccept(false, currentData)}
            small
          />
        </div>
      </div>
    )
  }

  const handleTermsAccept = async (accepted: boolean, currentData: any) => {
    console.log('[Ayla] handleTermsAccept - currentData:', currentData)
    if (!accepted) {
      addUserMessage('Não aceito')
      await simulateTyping()
      addBotMessage(
        <div className="space-y-2">
          <p className="text-amber-600">⚠️ É necessário aceitar os termos para realizar o agendamento.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
      return
    }
    
    addUserMessage('Aceito os termos')
    const updatedData = { ...currentData, termsAccepted: true }
    setConversationData(updatedData)
    
    await simulateTyping()
    
    // Perguntar sobre notificações
    askNotificationConsent(updatedData)
  }

  const askNotificationConsent = (currentData: any) => {
    console.log('[Ayla] askNotificationConsent - currentData:', currentData)
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">🔔 Notificações</p>
        <p className="text-sm">Deseja receber notificações sobre seu agendamento?</p>
        <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-sm">
          <p className="text-purple-800">
            Você receberá atualizações por e-mail e WhatsApp sobre o status do seu agendamento, 
            lembretes e avisos quando o CIN estiver pronto para retirada.
          </p>
        </div>
        <div className="space-y-2">
          <MenuButton
            icon={<CheckCircle size={16} />}
            label="Sim, quero receber notificações"
            onClick={() => handleNotificationConsent(true, currentData)}
            small
          />
          <MenuButton
            icon={<XIcon size={16} />}
            label="Não, obrigado"
            onClick={() => handleNotificationConsent(false, currentData)}
            small
          />
        </div>
      </div>
    )
  }

  const handleNotificationConsent = async (accepted: boolean, currentData: any) => {
    console.log('[Ayla] handleNotificationConsent - currentData:', currentData)
    addUserMessage(accepted ? 'Sim, quero receber notificações' : 'Não, obrigado')
    
    await simulateTyping(1000)
    
    // Criar o agendamento diretamente com todos os dados
    await handleConfirmAppointmentWithConsent(accepted, currentData)
  }

  const handleConfirmAppointmentWithConsent = async (notificationsAccepted: boolean, currentData: any) => {
    setIsTyping(true)
    
    try {
      const { 
        location, date, time, fullName, cpf, phone, email, rgType, rgNumber,
        gender, regionType, districtId, districtName, street, number, neighborhood,
        termsAccepted
      } = currentData
      
      console.log('[Ayla] Dados completos do currentData:', currentData)
      console.log('[Ayla] Data:', date)
      console.log('[Ayla] Time:', time)
      console.log('[Ayla] Location:', location)
      
      // Validações
      if (!location || !date || !time || !fullName || !cpf) {
        throw new Error('Dados incompletos. Por favor, tente novamente.')
      }
      
      // Criar agendamento
      const protocol = generateProtocol()
      
      // Garantir que date seja um objeto Date válido
      let formattedDate: string
      try {
        if (date instanceof Date) {
          formattedDate = format(date, 'yyyy-MM-dd')
        } else if (typeof date === 'string') {
          formattedDate = format(new Date(date), 'yyyy-MM-dd')
        } else {
          throw new Error('Data inválida')
        }
      } catch (err) {
        console.error('[Ayla] Erro ao formatar data:', err)
        throw new Error('Erro ao processar a data do agendamento')
      }
      
      const appointmentData = {
        protocol,
        name: fullName,
        cidadao_nome: fullName,
        cpf: cpf,
        cidadao_cpf: cpf,
        telefone: phone,
        phone,
        email,
        gender: gender || 'Não informado',
        genero: gender || 'Não informado',
        cinType: rgType === 'primeira-via' ? '1ª Via' : '2ª Via',
        tipo_cin: rgType === 'primeira-via' ? '1ª Via' : '2ª Via',
        cinNumber: rgNumber || null,
        numero_cin: rgNumber || null,
        regionType: regionType || '',
        regiao_tipo: regionType || '',
        region: districtName || '',
        regiao_nome: districtName || '',
        street: street || '',
        endereco_rua: street || '',
        number: number || '',
        endereco_numero: number || '',
        neighborhood: neighborhood || '',
        bairro_nome: neighborhood || '',
        date: formattedDate,
        data_agendamento: formattedDate,
        time: time,
        hora_agendamento: time,
        locationId: parseInt(location.id),
        local_id: parseInt(location.id),
        status: 'pendente',
        termsAccepted: termsAccepted || true,
        aceite_termos: termsAccepted || true,
        notificationsAccepted: notificationsAccepted,
        aceite_notificacoes: notificationsAccepted,
        prefeituraId: 1,
        tenantId: 1
      }
      
      console.log('[Ayla] Enviando agendamento:', appointmentData)
      
      await api.post('/agendamentos', appointmentData)
      invalidateAvailabilityCache()
      
      setIsTyping(false)
      setCurrentStep('schedule-confirmation')
      
      // Formatar data para exibição
      const dateObj = date instanceof Date ? date : new Date(date)
      
      addBotMessage(
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <p className="font-bold text-xl text-green-700">✅ Agendamento Confirmado!</p>
          </div>
          
          <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg space-y-2 text-sm">
            <p className="font-bold text-green-900 text-base mb-2">📋 Dados do Agendamento</p>
            <p><span className="font-semibold">Protocolo:</span> <span className="text-green-700 font-bold">{protocol}</span></p>
            <p><span className="font-semibold">Nome:</span> {fullName}</p>
            <p><span className="font-semibold">CPF:</span> {cpf}</p>
            <p><span className="font-semibold">Local:</span> {location.name}</p>
            <p><span className="font-semibold">Endereço:</span> {location.address || 'Consultar no local'}</p>
            <p><span className="font-semibold">Data:</span> {format(dateObj, "dd/MM/yyyy - EEEE", { locale: ptBR })}</p>
            <p><span className="font-semibold">Horário:</span> {time}</p>
            <p><span className="font-semibold">Tipo de CIN:</span> {rgType === 'primeira-via' ? '1ª Via' : '2ª Via'}</p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg space-y-3 text-sm">
            <p className="font-bold text-blue-900 text-base flex items-center gap-2">
              📄 Documentos Necessários
            </p>
            <div className="space-y-2 text-blue-900">
              <p className="font-semibold">⚠️ Leve no dia do atendimento:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>CPF (original ou cópia autenticada)</li>
                <li>Certidão de Nascimento ou Casamento (original ou cópia autenticada)</li>
                <li>Comprovante de residência atualizado (últimos 3 meses)</li>
                
                {rgType === 'segunda-via' && rgNumber && (
                  <li>RG anterior (se possuir)</li>
                )}
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                💡 Dica: Chegue com 10 minutos de antecedência
              </p>
            </div>
          </div>

          {notificationsAccepted ? (
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-sm">
              <p className="text-purple-900">
                <span className="font-semibold">📧 Notificações ativadas!</span>
              </p>
              <p className="text-purple-800 mt-1">
                Você receberá atualizações no e-mail <span className="font-semibold">{email}</span> e no telefone <span className="font-semibold">{phone}</span>
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
              <p className="text-amber-900">
                <span className="font-semibold">⚠️ Importante:</span> Anote seu protocolo <span className="font-bold">{protocol}</span> para consultas futuras.
              </p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs text-gray-700">
            <p className="font-semibold mb-1">ℹ️ Informações importantes:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>Guarde o número do protocolo para consultas</li>
              <li>Em caso de falta, reagende o mais rápido possível</li>
              <li>Cancelamentos podem ser feitos até 24h antes</li>
              <li>Leve todos os documentos originais ou cópias autenticadas</li>
            </ul>
          </div>

          <div className="bg-red-50 border-2 border-red-200 p-3 rounded-lg text-sm">
            <p className="font-bold text-red-900 mb-2">⚠️ ATENÇÃO - Política de Faltas e Cancelamentos</p>
            <p className="text-red-800">
              Se você <span className="font-bold">faltar ou cancelar 3 vezes</span> em um período de 7 dias, 
              seu CPF será <span className="font-bold">bloqueado temporariamente por 7 dias</span> para novos agendamentos.
            </p>
            <p className="text-red-700 mt-2 text-xs">
              💡 Por favor, cancele com antecedência se não puder comparecer!
            </p>
          </div>

          <BackToMenuButton onClick={() => {
            setConversationData({})
            showMainMenu()
          }} />
        </div>
      )
      
      toast.success('Agendamento realizado com sucesso!', {
        description: `Protocolo: ${protocol}`
      })
      
    } catch (error: any) {
      setIsTyping(false)
      console.error('[Ayla] Erro ao criar agendamento:', error)
      console.error('[Ayla] Stack trace:', error.stack)
      
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao criar agendamento.</p>
          <p className="text-sm">{error.message || 'Tente novamente mais tarde.'}</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const showFinalConfirmation = () => {
    const data = conversationData
    const { location, date, time, fullName, cpf, rgType, gender, phone, email, regionType, districtName, street, number, neighborhood, termsAccepted, notificationsAccepted } = data
    
    const dateFormatted = format(date, 'dd/MM/yyyy')
    const rgLabel = rgType === 'primeira-via' ? '1ª Via' : '2ª Via'
    
    addBotMessage(
      <div className="space-y-4">
        <p className="font-semibold text-lg">📋 Confirme todos os seus dados:</p>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm max-h-80 overflow-y-auto">
          <p><span className="font-semibold">Nome:</span> {fullName}</p>
          <p><span className="font-semibold">CPF:</span> {cpf}</p>
          <p><span className="font-semibold">Tipo de CIN:</span> {rgLabel}</p>
          {data.rgNumber && <p><span className="font-semibold">RG Anterior:</span> {data.rgNumber}</p>}
          <p><span className="font-semibold">Gênero:</span> {gender}</p>
          <p><span className="font-semibold">Telefone:</span> {phone}</p>
          <p><span className="font-semibold">E-mail:</span> {email}</p>
          <p><span className="font-semibold">Região:</span> {regionType}</p>
          {districtName && <p><span className="font-semibold">{regionType}:</span> {districtName}</p>}
          <p><span className="font-semibold">Logradouro:</span> {street}</p>
          <p><span className="font-semibold">Número:</span> {number}</p>
          <p><span className="font-semibold">Bairro/Localidade:</span> {neighborhood}</p>
          <hr className="my-3" />
          <p><span className="font-semibold">Local:</span> {location.name}</p>
          <p><span className="font-semibold">Data:</span> {dateFormatted}</p>
          <p><span className="font-semibold">Horário:</span> {time}</p>
          <hr className="my-3" />
          <p><span className="font-semibold">Termos aceitos:</span> {termsAccepted ? '✅ Sim' : '❌ Não'}</p>
          <p><span className="font-semibold">Notificações:</span> {notificationsAccepted ? '✅ Sim' : '❌ Não'}</p>
        </div>
        <div className="space-y-2">
          <Button
            onClick={handleConfirmAppointment}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            ✓ Confirmar Agendamento
          </Button>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      </div>
    )
  }

  const handleConfirmAppointment = async () => {
    setIsTyping(true)
    
    try {
      const { 
        location, date, time, fullName, cpf, phone, email, rgType, rgNumber,
        gender, regionType, districtId, districtName, street, number, neighborhood,
        termsAccepted, notificationsAccepted
      } = conversationData
      
      // Criar agendamento
      const protocol = generateProtocol()
      const appointmentData = {
        protocol,
        name: fullName,
        cidadao_nome: fullName,
        cpf: cpf,
        cidadao_cpf: cpf,
        telefone: phone,
        phone,
        email,
        gender: gender || 'Não informado',
        genero: gender || 'Não informado',
        cinType: rgType === 'primeira-via' ? '1ª Via' : '2ª Via',
        tipo_cin: rgType === 'primeira-via' ? '1ª Via' : '2ª Via',
        cinNumber: rgNumber || null,
        numero_cin: rgNumber || null,
        regionType: regionType || '',
        regiao_tipo: regionType || '',
        region: districtName || '',
        regiao_nome: districtName || '',
        street: street || '',
        endereco_rua: street || '',
        number: number || '',
        endereco_numero: number || '',
        neighborhood: neighborhood || '',
        bairro_nome: neighborhood || '',
        date: format(date, 'yyyy-MM-dd'),
        data_agendamento: format(date, 'yyyy-MM-dd'),
        time: time,
        hora_agendamento: time,
        locationId: parseInt(location.id),
        local_id: parseInt(location.id),
        status: 'pendente',
        termsAccepted: termsAccepted || true,
        aceite_termos: termsAccepted || true,
        notificationsAccepted: notificationsAccepted || false,
        aceite_notificacoes: notificationsAccepted || false,
        prefeituraId: 1,
        tenantId: 1
      }
      
      console.log('[Ayla] Enviando agendamento:', appointmentData)
      
      await api.post('/agendamentos', appointmentData)
      invalidateAvailabilityCache()
      
      setIsTyping(false)
      setCurrentStep('schedule-confirmation')
      
      addBotMessage(
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <p className="font-bold text-xl text-green-700">✅ Agendamento Confirmado!</p>
          </div>
          
          <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg space-y-2 text-sm">
            <p className="font-bold text-green-900 text-base mb-2">📋 Dados do Agendamento</p>
            <p><span className="font-semibold">Protocolo:</span> <span className="text-green-700 font-bold">{protocol}</span></p>
            <p><span className="font-semibold">Nome:</span> {fullName}</p>
            <p><span className="font-semibold">CPF:</span> {cpf}</p>
            <p><span className="font-semibold">Local:</span> {location.name}</p>
            <p><span className="font-semibold">Endereço:</span> {location.address || 'Consultar no local'}</p>
            <p><span className="font-semibold">Data:</span> {format(date, "dd/MM/yyyy - EEEE", { locale: ptBR })}</p>
            <p><span className="font-semibold">Horário:</span> {time}</p>
            <p><span className="font-semibold">Tipo de CIN:</span> {rgType === 'primeira-via' ? '1ª Via' : '2ª Via'}</p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg space-y-3 text-sm">
            <p className="font-bold text-blue-900 text-base flex items-center gap-2">
              📄 Documentos Necessários
            </p>
            <div className="space-y-2 text-blue-900">
              <p className="font-semibold">⚠️ Leve no dia do atendimento:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>CPF (original ou cópia autenticada)</li>
                <li>Certidão de Nascimento ou Casamento (original ou cópia autenticada)</li>
                <li>Comprovante de residência atualizado (últimos 3 meses)</li>
                
                {rgType === 'segunda-via' && rgNumber && (
                  <li>RG anterior (se possuir)</li>
                )}
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                💡 Dica: Chegue com 15 minutos de antecedência
              </p>
            </div>
          </div>

          {notificationsAccepted ? (
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-sm">
              <p className="text-purple-900">
                <span className="font-semibold">📧 Notificações ativadas!</span>
              </p>
              <p className="text-purple-800 mt-1">
                Você receberá atualizações no e-mail <span className="font-semibold">{email}</span> e no telefone <span className="font-semibold">{phone}</span>
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
              <p className="text-amber-900">
                <span className="font-semibold">⚠️ Importante:</span> Anote seu protocolo <span className="font-bold">{protocol}</span> para consultas futuras.
              </p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs text-gray-700">
            <p className="font-semibold mb-1">ℹ️ Informações importantes:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>Guarde o número do protocolo para consultas</li>
              <li>Em caso de falta, reagende o mais rápido possível</li>
              <li>Cancelamentos podem ser feitos até 24h antes</li>
              <li>Leve todos os documentos originais ou cópias autenticadas</li>
            </ul>
          </div>

          <div className="bg-red-50 border-2 border-red-200 p-3 rounded-lg text-sm">
            <p className="font-bold text-red-900 mb-2">⚠️ ATENÇÃO - Política de Faltas e Cancelamentos</p>
            <p className="text-red-800">
              Se você <span className="font-bold">faltar ou cancelar 3 vezes</span> em um período de 7 dias, 
              seu CPF será <span className="font-bold">bloqueado temporariamente por 7 dias</span> para novos agendamentos.
            </p>
            <p className="text-red-700 mt-2 text-xs">
              💡 Por favor, cancele com antecedência se não puder comparecer!
            </p>
          </div>

          <BackToMenuButton onClick={() => {
            setConversationData({})
            showMainMenu()
          }} />
        </div>
      )
      
      toast.success('Agendamento realizado com sucesso!', {
        description: `Protocolo: ${protocol}`
      })
      
    } catch (error: any) {
      setIsTyping(false)
      console.error('[Ayla] Erro ao criar agendamento:', error)
      
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao criar agendamento.</p>
          <p className="text-sm">{error.message || 'Tente novamente mais tarde.'}</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const startConsultFlow = async () => {
    setCurrentStep('consult-cpf')
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">Consulta de Status do CIN 🔍</p>
        <p>Por favor, digite seu CPF para consultar:</p>
      </div>
    )
  }

  const handleConsultCPF = async (cpf: string) => {
    if (!validateCPF(cpf)) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ CPF inválido. Por favor, digite um CPF válido.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
      return
    }

    addUserMessage(cpf)
    await simulateTyping(1000)

    try {
      const response = await api.get<any>(`/agendamentos/consultar/${cpf}`)
      const data = response

      if (data.found && data.appointments && data.appointments.length > 0) {
        const appointment = data.appointments[0]
        addBotMessage(
          <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
            <p className="font-semibold text-blue-900">✅ Agendamento Encontrado!</p>
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">Protocolo:</span> {appointment.protocol}</p>
              <p><span className="font-semibold">Data:</span> {new Date(appointment.date).toLocaleDateString('pt-BR')}</p>
              <p><span className="font-semibold">Horário:</span> {appointment.time}</p>
              <p><span className="font-semibold">Status:</span> {getStatusLabel(appointment.status)}</p>
            </div>
            <BackToMenuButton onClick={showMainMenu} />
          </div>
        )
      } else {
        addBotMessage(
          <div className="space-y-2">
            <p>❌ Nenhum agendamento encontrado para este CPF.</p>
            <BackToMenuButton onClick={showMainMenu} />
          </div>
        )
      }
    } catch (error) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao consultar agendamento. Tente novamente.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const startCancelFlow = async () => {
    setCurrentStep('cancel-cpf')
    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">Cancelamento de Agendamento ❌</p>
        <p>Digite seu CPF para localizar o agendamento:</p>
      </div>
    )
  }

  const handleCancelCPF = async (cpf: string) => {
    if (!validateCPF(cpf)) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ CPF inválido. Por favor, digite um CPF válido.</p>
        </div>
      )
      return
    }

    addUserMessage(cpf)
    setConversationData((prev: any) => ({ ...prev, cancelCpf: cpf }))
    await simulateTyping(1000)

    try {
      const data = await api.get<any>(`/agendamentos/consultar/${cpf}`)

      if (data.found && data.appointments && data.appointments.length > 0) {
        const pendingAppointment = data.appointments.find((apt: any) =>
          apt.status === 'pending' || apt.status === 'pendente'
        )

        if (pendingAppointment) {
          setConversationData((prev: any) => ({ ...prev, cancelCpf: cpf, appointmentToCancel: pendingAppointment }))
          addBotMessage(
            <div className="space-y-3">
              <p className="font-semibold">Agendamento encontrado:</p>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm space-y-1">
                <p><span className="font-semibold">Protocolo:</span> {pendingAppointment.protocol}</p>
                <p><span className="font-semibold">Nome:</span> {pendingAppointment.name || pendingAppointment.fullName}</p>
                <p><span className="font-semibold">Data:</span> {new Date(pendingAppointment.date).toLocaleDateString('pt-BR')}</p>
                <p><span className="font-semibold">Horário:</span> {pendingAppointment.time}</p>
              </div>
              <p className="text-sm text-gray-600">Deseja cancelar este agendamento?</p>
              <div className="space-y-2">
                <Button
                  onClick={() => handleRequestCancelCode(pendingAppointment)}
                  className="w-full bg-red-500 hover:bg-red-600"
                >
                  ❌ Sim, cancelar agendamento
                </Button>
                <BackToMenuButton onClick={showMainMenu} />
              </div>
            </div>
          )
        } else {
          addBotMessage(
            <div className="space-y-2">
              <p>ℹ️ Não há agendamentos pendentes para cancelar.</p>
              <BackToMenuButton onClick={showMainMenu} />
            </div>
          )
        }
      } else {
        addBotMessage(
          <div className="space-y-2">
            <p>❌ Nenhum agendamento encontrado para este CPF.</p>
            <BackToMenuButton onClick={showMainMenu} />
          </div>
        )
      }
    } catch (error) {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao buscar agendamento. Tente novamente.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const handleRequestCancelCode = async (appointment: any) => {
    await simulateTyping(800)
    try {
      const res = await fetch(`/api/agendamentos/${appointment.id}/solicitar-cancelamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        addBotMessage(
          <div className="space-y-2">
            <p className="text-red-600">❌ {body.message || 'Erro ao solicitar código.'}</p>
            <BackToMenuButton onClick={showMainMenu} />
          </div>
        )
        return
      }

      setCurrentStep('cancel-code')

      const devHint = body.developmentCode
        ? <p className="text-xs text-gray-400 mt-1">(Dev) Código: <span className="font-mono font-bold">{body.developmentCode}</span></p>
        : null

      addBotMessage(
        <div className="space-y-3">
          <p className="font-semibold">📲 Código enviado via WhatsApp!</p>
          <p className="text-sm text-gray-600">Digite abaixo o código de 6 dígitos que você recebeu para confirmar o cancelamento:</p>
          {devHint}
        </div>
      )
    } catch {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao solicitar código. Tente novamente.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const handleCancelCode = async (code: string) => {
    const { appointmentToCancel } = conversationData
    if (!appointmentToCancel) {
      showMainMenu()
      return
    }

    addUserMessage(code)
    await simulateTyping(800)

    try {
      const res = await fetch(`/api/agendamentos/${appointmentToCancel.id}/confirmar-cancelamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        addBotMessage(
          <div className="space-y-3">
            <p className="text-red-600">❌ {body.message || 'Código inválido ou expirado.'}</p>
            <p className="text-sm text-gray-500">Verifique o código e tente novamente, ou solicite um novo.</p>
            <Button
              onClick={() => handleRequestCancelCode(appointmentToCancel)}
              variant="outline"
              className="w-full text-sm"
            >
              Reenviar código
            </Button>
            <BackToMenuButton onClick={showMainMenu} />
          </div>
        )
        return
      }

      invalidateAvailabilityCache()
      setCurrentStep('cancel-result')
      setConversationData((prev: any) => ({ ...prev, appointmentToCancel: undefined }))

      addBotMessage(
        <div className="space-y-3">
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="font-bold text-lg text-green-700">✅ Agendamento cancelado!</p>
          </div>
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm">
            <p>O agendamento do protocolo <span className="font-bold">{appointmentToCancel.protocol}</span> foi cancelado com sucesso.</p>
          </div>
          <BackToMenuButton onClick={() => {
            setConversationData({})
            showMainMenu()
          }} />
        </div>
      )
    } catch {
      addBotMessage(
        <div className="space-y-2">
          <p className="text-red-600">❌ Erro ao confirmar cancelamento. Tente novamente.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
    }
  }

  const showLocations = async () => {
    setCurrentStep('locations-list')
    let availableLocations = locations

    if (availableLocations.length === 0) {
      availableLocations = await loadLocations()
    }

    const activeLocations = availableLocations.filter((l) => l.isActive !== false)
    
    if (activeLocations.length === 0) {
      addBotMessage(
        <div className="space-y-2">
          <p>Nenhum local de atendimento disponível no momento.</p>
          <BackToMenuButton onClick={showMainMenu} />
        </div>
      )
      return
    }

    addBotMessage(
      <div className="space-y-3">
        <p className="font-semibold">📍 Locais de Atendimento Disponíveis</p>
        <div className="space-y-3">
          {activeLocations.map(location => (
            <div key={location.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900">{location.name}</p>
              <p className="text-sm text-gray-600 mt-1">📍 {location.address || 'Endereço não informado'}</p>
              {location.googleMapsUrl && (
                <a
                  href={location.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 hover:underline"
                >
                  Ver no mapa
                </a>
              )}
            </div>
          ))}
        </div>
        <BackToMenuButton onClick={showMainMenu} />
      </div>
    )
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '🟡 Pendente',
      pendente: '🟡 Pendente',
      confirmed: '🟢 Confirmado',
      confirmado: '🟢 Confirmado',
      cancelled: '🔴 Cancelado',
      cancelado: '🔴 Cancelado',
      completed: '✅ Concluído',
      concluido: '✅ Concluído'
    }
    return labels[status] || status
  }

  const handleSendMessage = () => {
    if (!input.trim()) return

    const message = input.trim()
    setInput('')

    // Processar baseado no passo atual
    if (currentStep === 'consult-cpf') {
      handleConsultCPF(message)
    } else if (currentStep === 'cancel-cpf') {
      handleCancelCPF(message)
    } else if (currentStep === 'cancel-code') {
      handleCancelCode(message)
    } else if (currentStep === 'schedule-form-name') {
      handleNameInput(message)
    } else if (currentStep === 'schedule-form-cpf') {
      handleCpfInput(message)
    } else if (currentStep === 'schedule-form-rgnumber') {
      handleRgNumberInput(message)
    } else if (currentStep === 'schedule-form-phone') {
      handlePhoneInput(message)
    } else if (currentStep === 'schedule-form-email') {
      handleEmailInput(message)
    } else if (currentStep === 'schedule-form-street') {
      handleStreetInput(message)
    } else if (currentStep === 'schedule-form-number') {
      handleNumberInput(message)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 flex items-center gap-3">
        <AylaAvatar size={50} animate={false} />
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg">Ayla</h3>
          <p className="text-white/90 text-xs">Assistente Virtual • Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        <AnimatePresence>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <div className="bg-white rounded-2xl rounded-bl-none p-3 shadow-sm">
              <div className="flex gap-1">
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {(currentStep === 'consult-cpf' || 
        currentStep === 'cancel-cpf' || 
        currentStep === 'cancel-code' ||
        currentStep === 'schedule-form-name' ||
        currentStep === 'schedule-form-cpf' ||
        currentStep === 'schedule-form-rgnumber' ||
        currentStep === 'schedule-form-phone' ||
        currentStep === 'schedule-form-email' ||
        currentStep === 'schedule-form-street' ||
        currentStep === 'schedule-form-number') && (
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Digite aqui..."
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!input.trim()}
              size="icon"
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// Componentes auxiliares
function MessageBubble({ message }: { message: Message }) {
  const isBot = message.type === 'bot'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}
    >
      {isBot && (
        <div className="flex-shrink-0">
          <AylaAvatar size={35} animate={false} />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
          isBot
            ? 'bg-white text-gray-900 rounded-tl-none'
            : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-tr-none'
        }`}
      >
        {typeof message.content === 'string' ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          message.content
        )}
        <p className={`text-[10px] mt-1 ${isBot ? 'text-gray-400' : 'text-white/70'}`}>
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  )
}

function MenuButton({ 
  icon, 
  label, 
  onClick, 
  small = false 
}: { 
  icon: React.ReactNode
  label: string
  onClick: () => void
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-all hover:shadow-md hover:scale-[1.02] ${
        small ? 'p-2 text-sm' : 'p-3'
      }`}
    >
      <div className={`flex-shrink-0 ${small ? 'text-purple-500' : 'text-purple-600'}`}>
        {icon}
      </div>
      <span className={`font-medium text-gray-900 text-left ${small ? 'text-sm' : ''}`}>
        {label}
      </span>
    </button>
  )
}

function BackToMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-2 hover:underline"
    >
      ← Voltar ao menu principal
    </button>
  )
}
