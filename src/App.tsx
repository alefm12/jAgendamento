import { useState, useEffect, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { useReminders } from '@/hooks/use-reminders'
import { useScheduledReportExecutor } from '@/hooks/use-scheduled-report-executor'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SecretaryPanel } from '@/components/SecretaryPanel'
import { NotificationIndicator } from '@/components/NotificationIndicator'
import TenantLocations from '@/components/TenantLocations'
import { LoginForm } from '@/components/LoginForm'
import { AdvancedAdminPanel } from '@/components/AdvancedAdminPanel'
import SystemConfigPanel from '@/components/SystemConfigPanel'
import { UserManagement } from '@/components/UserManagement'
import { BlockedDatesManager } from '@/components/BlockedDatesManager'
import { RGDeliveryQueue } from '@/components/RGDeliveryQueue'
import { RGDeliveryReport } from '@/components/RGDeliveryReport'
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import { DataImportDialog } from '@/components/DataImportDialog'
import { NovoAgendamento } from '@/components/public/NovoAgendamento'
import { ScrollToTop } from '@/components/ScrollToTop'
import { SmoothScrollWrapper, SmoothScrollContainer, FadeIn, ScaleIn } from '@/components/SmoothScrollWrapper'
import { FilteredReportExport } from '@/components/FilteredReportExport'
import { ReportTemplateManager } from '@/components/ReportTemplateManager'
import { ReportTemplateDesigner } from '@/components/ReportTemplateDesigner'
import { ReportTemplateViewer } from '@/components/ReportTemplateViewer'
import { ScheduledReportManager } from '@/components/ScheduledReportManager'
import { ReportExecutionHistory } from '@/components/ReportExecutionHistory'
import { AuditLogViewer } from '@/components/AuditLogViewer'
import { ReminderHistory } from '@/components/ReminderHistory'
import { ReminderStatusIndicator } from '@/components/ReminderStatusIndicator'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationTestPanel } from '@/components/NotificationTestPanel'
import { AtendimentoBoard } from '@/components/AtendimentoBoard'
import { List, IdentificationCard, MapPin, Gear, SignOut, CalendarBlank, Package, ChartBar, Upload, Download, UserCircle, FilePlus, ClockClockwise, ClipboardText, ShieldCheck, Bell, PaperPlaneRight, UsersThree } from '@phosphor-icons/react'
import type { ReportTemplate, ReportExecutionLog } from '@/lib/types'
import { generateProtocol } from '@/lib/validators'
import { sendConfirmationNotification, sendStatusUpdateNotification, sendCancellationNotification, sendReadyForDeliveryNotification, sendRescheduleNotification } from '@/lib/notifications'
import { exportToCSV, exportToJSON, exportToPDF, exportToExcel } from '@/lib/export-utils'
import { useConfirm } from '@/components/ConfirmDialog'
import { createAuditLog } from '@/lib/audit-logger'
import { getReportExecutionLogs } from '@/lib/report-logger'
import { locationsService } from '@/lib/locations-service'
import { api } from '@/lib/api'
import { toFirstAndSecondName } from '@/lib/name-utils'
import { requestAndStoreClientLocation } from '@/lib/client-location'
import { format, parseISO } from 'date-fns'
import type { Appointment, AppointmentStatus, AppointmentPriority, StatusChangeHistory, Location, SecretaryUser, SystemConfig, BlockedDate, RGDelivery, LGPDConsent as LGPDConsentType, ScheduledReport } from '@/lib/types'
import { BLOCK_WINDOW_DAYS, isRescheduleBlocked, MAX_RESCHEDULES_PER_WINDOW } from '@/lib/appointment-limits'

const DEFAULT_WORKING_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

const DEFAULT_MAX_APPOINTMENTS_PER_SLOT = 2

const DEFAULT_CONFIG: SystemConfig = {
  systemName: 'Agendamento CIN',
  primaryColor: 'oklch(0.45 0.15 145)',
  secondaryColor: 'oklch(0.65 0.1 180)',
  accentColor: 'oklch(0.55 0.18 145)',
  bookingWindowDays: 60
}

type AppView =
  | 'user'
  | 'secretary'
  | 'atendimento'
  | 'locations'
  | 'admin'
  | 'blocked-dates'
  | 'rg-delivery'
  | 'rg-report'
  | 'analytics'
  | 'import-export'
  | 'report-templates'
  | 'scheduled-reports'
  | 'execution-history'
  | 'audit-logs'
  | 'reminder-history'
  | 'notification-test'

interface AppProps {
  initialView?: AppView
}

type EmailSettingsConfig = {
  host?: string
  port?: number
  user?: string
  password?: string
  senderName?: string
  replyTo?: string
  secure?: boolean
  enabled?: boolean
}

type WhatsappSettingsConfig = {
  apiUrl?: string
  apiKey?: string
  instanceId?: string
  businessNumber?: string
  enabled?: boolean
}

type ExtendedSystemConfig = SystemConfig & {
  emailSettings?: EmailSettingsConfig
  whatsappSettings?: WhatsappSettingsConfig
}
const SYSTEM_CONFIG_CACHE_KEY = 'system_config_cache_v1'
const REPORT_TEMPLATES_CACHE_KEY = 'report-templates-v1'
const SECRETARY_SESSION_USER_KEY = 'secretary_session_user_v1'
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000

const translateStatus = (status: AppointmentStatus): string => {
  const labels: Record<AppointmentStatus, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
    completed: 'Concluído',
    'awaiting-issuance': 'Aguardando Emissão',
    'cin-ready': 'CIN Pronta',
    'cin-delivered': 'CIN Entregue'
  }
  return labels[status] || status
}

function App({ initialView = 'user' }: AppProps) {
  const { confirm, ConfirmDialogNode } = useConfirm()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [secretaryUsers, setSecretaryUsers] = useState<SecretaryUser[]>([])
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([])
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([])
  const [executionLogs, setExecutionLogs] = useState<ReportExecutionLog[]>([])
  const [systemConfig, setSystemConfig] = useState<ExtendedSystemConfig>({
    systemName: 'Agendamento CIN',
    primaryColor: 'oklch(0.45 0.15 145)',
    secondaryColor: 'oklch(0.65 0.1 180)',
    accentColor: 'oklch(0.55 0.18 145)',
    reminderMessage: 'Olá {nome}, lembramos que você tem agendamento para {data} às {hora} para emissão de CIN. Local: {endereco}. Não esqueça de trazer seus documentos pessoais!',
    bookingWindowDays: 60,
    secretaryConfig: {
      dashboardColor: '#3b82f6',
      accentColor: '#10b981',
      enabledReports: ['appointments', 'by-location', 'by-neighborhood', 'by-status', 'by-period', 'audit-log'],
      allowDateBlocking: true,
      allowReschedule: true,
      allowCancel: true,
      allowPriorityChange: true
    },
    lgpdSettings: {
      enabled: true,
      consentVersion: '1.0',
      dataRetentionDays: 90
    },
    rgDeliverySettings: {
      reminderAfterDays: 7,
      autoReminderEnabled: true
    }
  })
  const [isOwner, setIsOwner] = useState(false)
  const [currentUser, setCurrentUser] = useState<SecretaryUser | null>(() => {
    if (typeof window === 'undefined' || initialView === 'user') return null
    try {
      const raw = sessionStorage.getItem(SECRETARY_SESSION_USER_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed as SecretaryUser
    } catch {
      return null
    }
  })
  const [currentView, setCurrentView] = useState<AppView>(initialView)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null)
  const shortCurrentUserName = toFirstAndSecondName(currentUser?.fullName) || currentUser?.fullName || ''
  
  useReminders(appointments || [], setAppointments, systemConfig, locations || [])

  const refreshReportTemplates = useCallback(() => {
    try {
      const raw = localStorage.getItem(REPORT_TEMPLATES_CACHE_KEY)
      if (!raw) {
        setReportTemplates([])
        return
      }
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setReportTemplates(parsed)
      } else {
        setReportTemplates([])
      }
    } catch (error) {
      console.error('[App] Erro ao carregar templates salvos', error)
      setReportTemplates([])
    }
  }, [])

  const refreshExecutionLogs = useCallback(async () => {
    try {
      const logs = await getReportExecutionLogs()
      setExecutionLogs(logs || [])
    } catch (error) {
      console.error('[App] Erro ao carregar histórico de execuções', error)
      setExecutionLogs([])
    }
  }, [])

  const refreshServiceLocations = useCallback(async () => {
    try {
      const payload = await locationsService.listServiceLocations()
      const normalized = (payload || []).map((location) => ({
        ...location,
        id: String(location.id),
        name: location.name?.trim() || location.name,
        address: location.address || ''
      }))
      setLocations(normalized)
    } catch (error) {
      console.error('[App] Erro ao sincronizar locais de atendimento', error)
      toast.error('Não foi possível carregar os locais de atendimento.')
    }
  }, [setLocations])

  useEffect(() => {
    refreshServiceLocations()
  }, [refreshServiceLocations])

  useEffect(() => {
    refreshReportTemplates()
  }, [refreshReportTemplates])

  useEffect(() => {
    refreshExecutionLogs()
  }, [refreshExecutionLogs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (currentUser) {
        sessionStorage.setItem(SECRETARY_SESSION_USER_KEY, JSON.stringify(currentUser))
      } else {
        sessionStorage.removeItem(SECRETARY_SESSION_USER_KEY)
      }
    } catch {}
  }, [currentUser])

  useEffect(() => {
    const handleServiceLocationsUpdated = () => {
      refreshServiceLocations()
    }
    window.addEventListener('service-locations-updated', handleServiceLocationsUpdated)
    return () => {
      window.removeEventListener('service-locations-updated', handleServiceLocationsUpdated)
    }
  }, [refreshServiceLocations])

  useEffect(() => {
    const handleTemplatesUpdated = () => {
      refreshReportTemplates()
    }
    const handleStorageUpdated = (event: StorageEvent) => {
      if (event.key === REPORT_TEMPLATES_CACHE_KEY) {
        refreshReportTemplates()
      }
    }
    window.addEventListener('report-templates-updated', handleTemplatesUpdated)
    window.addEventListener('storage', handleStorageUpdated)
    return () => {
      window.removeEventListener('report-templates-updated', handleTemplatesUpdated)
      window.removeEventListener('storage', handleStorageUpdated)
    }
  }, [refreshReportTemplates])

  useEffect(() => {
    const handleExecutionLogged = () => {
      refreshExecutionLogs()
    }
    window.addEventListener('report-execution-logged', handleExecutionLogged)
    return () => {
      window.removeEventListener('report-execution-logged', handleExecutionLogged)
    }
  }, [refreshExecutionLogs])

  // Carregar agendamentos do PostgreSQL
  const refreshAppointments = useCallback(async () => {
    try {
      const response = await api.get<any[]>('/agendamentos')
      const normalized = (response || []).map((apt: any) => {
        // Mapeamento correto de status do backend
        let mappedStatus = apt.status || 'pending'
        if (mappedStatus === 'pendente') mappedStatus = 'pending'
        if (mappedStatus === 'confirmado') mappedStatus = 'confirmed'
        if (mappedStatus === 'cancelado') mappedStatus = 'cancelled'
        if (mappedStatus === 'concluido') mappedStatus = 'completed'
        if (mappedStatus === 'reagendado') mappedStatus = 'rescheduled'
        if (mappedStatus === 'em_espera') mappedStatus = 'waiting'
        
        const notificationsAccepted = apt.notificationsAccepted ?? apt.aceite_notificacoes
        const lgpdConsent = apt.lgpdConsent || (
          notificationsAccepted !== undefined
            ? {
                id: `lgpd-${apt.id}`,
                userId: String(apt.id),
                userCPF: apt.cpf || apt.cidadao_cpf || '',
                consentDate: apt.createdAt || apt.created_at || new Date().toISOString(),
                consentVersion: '1.0',
                dataUsageAccepted: Boolean(apt.aceite_termos ?? true),
                // Regra de negócio: só bloqueia notificação se estiver explicitamente false.
                notificationAccepted: notificationsAccepted === false ? false : true
              }
            : undefined
        )

        return {
          id: String(apt.id),
          protocol: apt.protocol || `AGD-${apt.id}`,
          fullName: apt.fullName || apt.name || apt.cidadao_nome || '',
          name: apt.name || apt.cidadao_nome,
          cpf: apt.cpf || apt.cidadao_cpf,
          phone: apt.phone || apt.telefone,
          email: apt.email,
          gender: apt.gender || apt.genero,
          date: apt.date || apt.data_agendamento,
          time: apt.time || apt.hora_agendamento,
          status: mappedStatus,
          locationId: String(apt.locationId || apt.local_id || ''),
          locationName: apt.locationName || null,
          cinType: apt.cinType || apt.tipo_cin,
          rgType: apt.rgType || apt.cinType || apt.tipo_cin,
          address: apt.address || '',
          street: apt.street || apt.endereco_rua,
          number: apt.number || apt.endereco_numero,
          neighborhood: apt.neighborhood || apt.bairro_nome,
          regionType: apt.regionType || apt.regiao_tipo,
          regionName: apt.regionName || apt.regiao_nome,
          createdAt: apt.createdAt || apt.created_at || new Date().toISOString(),
          completedAt: apt.completedAt || apt.concluido_em || undefined,
          completedBy: apt.completedBy || apt.concluido_por || undefined,
          lastModified: apt.lastModified || apt.ultima_modificacao || apt.atualizado_em || undefined,
          notes: apt.notes || [],
          priority: apt.priority || 'normal',
          statusHistory: apt.statusHistory || [],
          customFieldValues: apt.customFieldValues || apt.custom_field_values || {},
          lgpdConsent
        }
      })
      setAppointments(normalized)
    } catch (error) {
      console.error('[App] Erro ao carregar agendamentos', error)
      setAppointments([]) // Define array vazio em caso de erro
    }
  }, [])

  // Carregar datas bloqueadas do PostgreSQL
  const refreshBlockedDates = useCallback(async () => {
    try {
      const response = await api.get<any[]>('/agendamentos/datas-bloqueadas')
      const normalized = (response || []).map((item: any) => ({
        id: String(item.id),
        date: item.date || item.data,
        reason: item.reason || item.motivo,
        blockType: item.blockType || item.tipo_bloqueio,
        blockedSlots: item.blockedSlots || item.horarios_bloqueados,
        createdBy: item.createdBy || item.criado_por || 'sistema',
        createdAt: item.createdAt || item.criado_em || new Date().toISOString()
      }))
      setBlockedDates(normalized)
    } catch (error) {
      console.error('[App] Erro ao carregar datas bloqueadas', error)
      setBlockedDates([]) // Define array vazio em caso de erro
    }
  }, [])

  // Carregar configurações do sistema do PostgreSQL
  const refreshSystemConfig = useCallback(async () => {
    try {
      const response = await api.get<ExtendedSystemConfig>('/system-config')
      try {
        localStorage.setItem(SYSTEM_CONFIG_CACHE_KEY, JSON.stringify(response))
      } catch {}
      setSystemConfig(response || {
        systemName: 'Sistema de Agendamento',
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
        accentColor: '#6366f1'
      })
    } catch (error) {
      console.error('[App] Erro ao carregar configurações', error)
      // Fallback para cache local (evita "apagar" dados se API falhar)
      try {
        const cached = localStorage.getItem(SYSTEM_CONFIG_CACHE_KEY)
        if (cached) {
          setSystemConfig(JSON.parse(cached))
          return
        }
      } catch {}
      setSystemConfig({
        systemName: 'Sistema de Agendamento',
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
        accentColor: '#6366f1'
      })
    }
  }, [])

  // Carregar usuários da secretaria do PostgreSQL
  const refreshSecretaryUsers = useCallback(async () => {
    try {
      const response = await api.get<SecretaryUser[]>('/secretary-users')
      setSecretaryUsers(response || [])
    } catch (error) {
      console.error('[App] Erro ao carregar usuários', error)
      setSecretaryUsers([]) // Define array vazio em caso de erro
    }
  }, [])

  useEffect(() => {
    const handleLocationDataUpdated = () => {
      refreshServiceLocations()
      refreshAppointments()
      refreshBlockedDates()
    }
    window.addEventListener('location-data-updated', handleLocationDataUpdated)
    return () => {
      window.removeEventListener('location-data-updated', handleLocationDataUpdated)
    }
  }, [refreshServiceLocations, refreshAppointments, refreshBlockedDates])

  // Carregar dados iniciais
  useEffect(() => {
    refreshAppointments()
    refreshBlockedDates()
    refreshSystemConfig()
    refreshSecretaryUsers()
  }, [refreshAppointments, refreshBlockedDates, refreshSystemConfig, refreshSecretaryUsers])

  const handleUpdateScheduledReport = (id: string, updates: Partial<ScheduledReport>) => {
    setScheduledReports(current =>
      (current || []).map(report =>
        report.id === id ? { ...report, ...updates } : report
      )
    )
  }

  useScheduledReportExecutor(scheduledReports, handleUpdateScheduledReport)

  const allowedLocationIds = useMemo(() => {
    if (!currentUser) return [] as string[]
    return (currentUser.permissions?.allowedLocationIds || [])
      .map((value) => String(value).trim())
      .filter(Boolean)
  }, [currentUser])

  const canViewAllLocations = useMemo(() => {
    if (!currentUser || isOwner) return true
    if (currentUser.adminType === 'system') return true
    if (currentUser.permissions?.canViewAllLocations) return true
    if (!currentUser.adminType && currentUser.isAdmin && allowedLocationIds.length === 0) return true
    return false
  }, [allowedLocationIds.length, currentUser, isOwner])

  const visibleLocations = useMemo(() => {
    if (canViewAllLocations) return locations || []
    return (locations || []).filter((location) => allowedLocationIds.includes(String(location.id)))
  }, [allowedLocationIds, canViewAllLocations, locations])

  const visibleAppointments = useMemo(() => {
    if (canViewAllLocations) return appointments || []
    return (appointments || []).filter((appointment) => allowedLocationIds.includes(String(appointment.locationId)))
  }, [allowedLocationIds, appointments, canViewAllLocations])

  const hiddenViews = useMemo(() => {
    return new Set(
      (currentUser?.permissions?.hiddenTabs || [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  }, [currentUser])

  const canManageSystem = Boolean(isOwner || currentUser?.adminType === 'system')
  const canManageLocations = Boolean(canManageSystem || currentUser?.permissions?.canManageLocations)
  const canManageBlockedDates = Boolean(canManageSystem || currentUser?.permissions?.canBlockDates)
  const canViewAnalytics = Boolean(canManageSystem || currentUser?.permissions?.canViewReports)
  const canExportOrImport = Boolean(canManageSystem || currentUser?.permissions?.canExportData)
  const canUseRGDelivery = Boolean(canManageSystem || currentUser?.permissions?.canCompleteAppointment)
  const canViewMonitoring = Boolean(canManageSystem || currentUser?.permissions?.canViewReports)
  const canTestNotifications = Boolean(canManageSystem || currentUser?.permissions?.canChangeSystemSettings)

  const canAccessView = useCallback((view: AppView) => {
    if (hiddenViews.has(view)) return false

    switch (view) {
      case 'user':
      case 'secretary':
      case 'atendimento':
        return true
      case 'rg-delivery':
      case 'rg-report':
        return canUseRGDelivery
      case 'analytics':
      case 'report-templates':
      case 'scheduled-reports':
      case 'execution-history':
        return canViewAnalytics
      case 'import-export':
        return canExportOrImport
      case 'audit-logs':
      case 'reminder-history':
        return canViewMonitoring
      case 'notification-test':
        return canTestNotifications
      case 'locations':
        return canManageLocations
      case 'blocked-dates':
        return canManageBlockedDates
      case 'admin':
        return canManageSystem
      default:
        return false
    }
  }, [
    canExportOrImport,
    canManageBlockedDates,
    canManageLocations,
    canManageSystem,
    canTestNotifications,
    canUseRGDelivery,
    canViewAnalytics,
    canViewMonitoring,
    hiddenViews
  ])

  useEffect(() => {
    if (!currentUser) return
    if (canAccessView(currentView)) return

    const fallbackOrder: AppView[] = [
      'secretary',
      'atendimento',
      'rg-delivery',
      'analytics',
      'import-export',
      'report-templates',
      'scheduled-reports',
      'execution-history',
      'audit-logs',
      'reminder-history',
      'notification-test',
      'locations',
      'blocked-dates',
      'admin',
      'user'
    ]

    const nextView = fallbackOrder.find((view) => canAccessView(view)) || 'user'
    setCurrentView(nextView)
  }, [canAccessView, currentUser, currentView])

  const pendingDeliveryCount = useMemo(() => {
    return (visibleAppointments || []).filter(apt =>
      apt.status === 'awaiting-issuance' || apt.status === 'cin-ready'
    ).length
  }, [visibleAppointments])

  useEffect(() => {
    const resizeObserverErrorHandler = (e: ErrorEvent) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
          e.message === 'ResizeObserver loop limit exceeded') {
        e.stopImmediatePropagation()
        e.preventDefault()
        return true
      }
      return false
    }

    const unhandledRejectionHandler = (e: PromiseRejectionEvent) => {
      if (e.reason?.message?.includes('ResizeObserver')) {
        e.preventDefault()
        return true
      }
      return false
    }

    window.addEventListener('error', resizeObserverErrorHandler)
    window.addEventListener('unhandledrejection', unhandledRejectionHandler)

    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes('ResizeObserver')) {
        return
      }
      originalConsoleError.apply(console, args)
    }

    return () => {
      window.removeEventListener('error', resizeObserverErrorHandler)
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
      console.error = originalConsoleError
    }
  }, [])

  useEffect(() => {
    window.spark.user().then(user => {
      if (user) {
        setIsOwner(user.isOwner)
      }
    })
  }, [])

  useEffect(() => {
    if (!appointments || appointments.length === 0) return

    const hasLegacyStatuses = appointments.some(apt => {
      const status = apt.status as string
      return status === 'ready-for-delivery' || status === 'delivered'
    })

    if (!hasLegacyStatuses) return

    setAppointments(current => {
      const list = current ?? []
      return list.map(apt => {
        const status = apt.status as string
        if (status === 'ready-for-delivery') {
          return { ...apt, status: 'awaiting-issuance' }
        }
        if (status === 'delivered') {
          return { ...apt, status: 'cin-delivered' }
        }
        return apt
      })
    })
  }, [appointments, setAppointments])

  const handleStatusChange = async (
    id: string,
    status: AppointmentStatus,
    reason?: string,
    options?: { metadata?: StatusChangeHistory['metadata'] }
  ) => {
    const appointment = appointments?.find(apt => apt.id === id)
    if (!appointment) return

    const previousStatus = appointment.status
    const user = await window.spark.user()
    const changerName = currentUser?.fullName || user?.login || 'Secretaria'

    const historyEntry: StatusChangeHistory = {
      id: crypto.randomUUID(),
      from: previousStatus,
      to: status,
      changedBy: changerName,
      changedAt: new Date().toISOString(),
      reason: reason || options?.metadata?.cancellationReasonText || `Status alterado de ${translateStatus(previousStatus)} para ${translateStatus(status)}`,
      metadata: options?.metadata
    }

    const isCompletingAppointment = status === 'completed'
    const isMarkingCinReady = status === 'cin-ready'
    const resultingStatus: AppointmentStatus = isCompletingAppointment ? 'awaiting-issuance' : status

    const updates: Partial<Appointment> = {
      status: resultingStatus,
      lastModified: new Date().toISOString()
    }

    if (status === 'cancelled') {
      updates.cancelledBy = 'secretary'
      updates.cancellationReason = options?.metadata?.cancellationReasonText || reason
      
      // Registrar cancelamento na tabela de cancelamentos
      try {
        await api.post('/agendamentos/cancelamentos', {
          agendamentoId: id,
          canceladoPor: 'secretaria',
          usuarioNome: changerName,
          usuarioEmail: currentUser?.email || user?.login || '',
          motivo: options?.metadata?.cancellationReasonText || reason || 'Cancelado pela secretaria',
          observacoes: options?.metadata?.cancellationCategory || ''
        })
      } catch (error) {
        console.error('[APP] Erro ao registrar cancelamento:', error)
      }
    }

    let nextHistory = [...(appointment.statusHistory || []), historyEntry]

    if (isCompletingAppointment) {
      updates.completedAt = new Date().toISOString()
      updates.completedBy = changerName
      const issuanceHistoryEntry: StatusChangeHistory = {
        id: crypto.randomUUID(),
        from: 'completed',
        to: 'awaiting-issuance',
        changedBy: 'Sistema',
        changedAt: new Date().toISOString(),
        reason: 'CIN aguardando emissão'
      }
      nextHistory = [...nextHistory, issuanceHistoryEntry]
    }

    updates.statusHistory = nextHistory

    setAppointments(current =>
      (current || []).map(apt => 
        apt.id === id 
          ? { ...apt, ...updates } 
          : apt
      )
    )
    
    // Salvar no backend
    try {
      await api.patch(`/agendamentos/${id}`, updates)
      console.log('[APP] Status atualizado no backend com sucesso')
    } catch (error) {
      console.error('[APP] Erro ao atualizar status no backend:', error)
      toast.error('Erro ao salvar alteração no servidor')
    }
    
    await createAuditLog({
      action: 'appointment_status_changed',
      description: `Status do agendamento de ${appointment.fullName} alterado de "${previousStatus}" para "${resultingStatus}"${reason ? `: ${reason}` : ''}`,
      performedBy: changerName,
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'appointment',
      targetId: appointment.id,
      targetName: `${appointment.fullName} - ${appointment.protocol}`,
      changes: {
        status: { from: previousStatus, to: resultingStatus }
      },
      metadata: {
        protocol: appointment.protocol,
        reason: reason || options?.metadata?.cancellationReasonText || historyEntry.reason,
        cancellationCategory: options?.metadata?.cancellationCategory
      }
    })

    if (isCompletingAppointment) {
      toast.success('Atendimento concluído! CIN aguardando emissão.', {
        description: 'O atendimento foi encerrado e o CIN entrou na fila de emissão antes da entrega.',
        duration: 6000
      })

      const location = locations?.find(loc => loc.id === appointment.locationId)
      const notificationResult = await sendStatusUpdateNotification(
        { ...appointment, status: 'completed' },
        previousStatus,
        'completed',
        systemConfig,
        location?.address,
        location?.googleMapsUrl,
        location?.name
      )
      if (notificationResult.success) {
        const channels: string[] = []
        if (notificationResult.emailSent) channels.push('📧 Email')
        if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')
        toast.success(`Notificação de atendimento concluído enviada via ${channels.join(', ')}!`, { duration: 5000 })
      }
    } else if (isMarkingCinReady) {
      toast.success('CIN marcada como pronta para retirada.', {
        description: 'Agora o documento aparece na fila de entrega para registro.',
        duration: 6000
      })

      const location = locations?.find(loc => loc.id === appointment.locationId)
      const notificationResult = await sendReadyForDeliveryNotification(
        { ...appointment, status: 'cin-ready' },
        systemConfig,
        location?.address,
        location?.googleMapsUrl,
        location?.name
      )
      
      if (notificationResult.success) {
        const channels: string[] = []
        if (notificationResult.emailSent) channels.push('📧 Email')
        if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')
        toast.success(`Notificação de CIN pronta enviada via ${channels.join(', ')}!`, { 
          description: `${appointment.fullName} foi avisado que o CIN pode ser retirado.`,
          duration: 7000 
        })
      }
    } else {
      toast.success('Status atualizado com sucesso')

      // Notificações apenas para cancelamento e entrega de CIN
      const shouldNotify = resultingStatus === 'cancelled' || resultingStatus === 'cin-delivered'
      if (shouldNotify) {
        const location = locations?.find(loc => loc.id === appointment.locationId)
        const notificationResult = await sendStatusUpdateNotification(
          { ...appointment, status: resultingStatus },
          previousStatus,
          resultingStatus,
          systemConfig,
          location?.address,
          location?.googleMapsUrl,
          location?.name
        )
        if (notificationResult.success) {
          const statusLabel = resultingStatus === 'cancelled' ? 'cancelamento' : 'entrega de CIN'
          const channels: string[] = []
          if (notificationResult.emailSent) channels.push('📧 Email')
          if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')
          toast.success(`Notificação de ${statusLabel} enviada via ${channels.join(', ')}!`, { duration: 5000 })
        }
      }
    }
  }

  const handleAddNote = async (appointmentId: string, noteText: string, options?: { contextLabel?: string }) => {
    const appointment = (appointments || []).find(apt => apt.id === appointmentId)
    const user = await window.spark.user()
    const newNote = {
      id: crypto.randomUUID(),
      text: noteText,
      author: currentUser?.fullName || user?.login || 'Secretaria',
      timestamp: new Date().toISOString(),
      contextLabel: options?.contextLabel
    }

    setAppointments(current =>
      (current || []).map(apt => 
        apt.id === appointmentId 
          ? { ...apt, notes: [...(apt.notes || []), newNote], lastModified: new Date().toISOString() }
          : apt
      )
    )

    try {
      const updated = (appointments || []).find(apt => apt.id === appointmentId)
      const nextNotes = [...(updated?.notes || []), newNote]
      await api.patch(`/agendamentos/${appointmentId}`, {
        notes: nextNotes,
        lastModified: new Date().toISOString()
      })
    } catch (error) {
      console.error('[APP] Erro ao salvar nota no backend:', error)
      toast.error('Erro ao salvar nota no servidor')
      refreshAppointments()
      return
    }
    
    toast.success('Nota adicionada com sucesso')

    if (appointment) {
      await createAuditLog({
        action: 'appointment_note_added',
        description: `Nota adicionada ao agendamento de ${appointment.fullName}: "${noteText.substring(0, 50)}${noteText.length > 50 ? '...' : ''}"`,
        performedBy: currentUser?.fullName || user?.login || 'Secretaria',
        performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
        targetType: 'appointment',
        targetId: appointment.id,
        targetName: `${appointment.fullName} - ${appointment.protocol}`,
        metadata: {
          protocol: appointment.protocol,
          noteText,
          contextLabel: options?.contextLabel
        }
      })
    }
  }

  const handleDeleteNote = async (appointmentId: string, noteId: string) => {
    const appointment = (appointments || []).find(apt => apt.id === appointmentId)
    const note = appointment?.notes?.find(n => n.id === noteId)
    
    setAppointments(current =>
      (current || []).map(apt =>
        apt.id === appointmentId
          ? { ...apt, notes: (apt.notes || []).filter(n => n.id !== noteId), lastModified: new Date().toISOString() }
          : apt
      )
    )

    try {
      const updated = (appointments || []).find(apt => apt.id === appointmentId)
      const nextNotes = (updated?.notes || []).filter(n => n.id !== noteId)
      await api.patch(`/agendamentos/${appointmentId}`, {
        notes: nextNotes,
        lastModified: new Date().toISOString()
      })
    } catch (error) {
      console.error('[APP] Erro ao remover nota no backend:', error)
      toast.error('Erro ao remover nota no servidor')
      refreshAppointments()
      return
    }
    
    toast.success('Nota removida')

    if (appointment && note) {
      const user = await window.spark.user()
      await createAuditLog({
        action: 'appointment_note_deleted',
        description: `Nota removida do agendamento de ${appointment.fullName}`,
        performedBy: currentUser?.fullName || user?.login || 'Secretaria',
        performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
        targetType: 'appointment',
        targetId: appointment.id,
        targetName: `${appointment.fullName} - ${appointment.protocol}`,
        oldValue: note,
        metadata: {
          protocol: appointment.protocol,
          deletedNoteText: note.text
        }
      })
    }
  }

  const handleReschedule = async (appointmentId: string, newDate: string, newTime: string) => {
    const appointment = appointments?.find(apt => apt.id === appointmentId)
    if (!appointment) return

    if (isRescheduleBlocked(appointments || [], appointment.cpf)) {
      toast.error(`Limite de ${MAX_RESCHEDULES_PER_WINDOW} reagendamentos em ${BLOCK_WINDOW_DAYS} dias atingido para este CPF. Aguarde 7 dias para tentar novamente.`)
      return
    }

    const oldDate = appointment.date
    const oldTime = appointment.time
    const user = await window.spark.user()

    const historyEntry: StatusChangeHistory = {
      id: crypto.randomUUID(),
      from: appointment.status,
      to: 'pending',
      changedBy: user?.login || 'Secretaria',
      changedAt: new Date().toISOString(),
      reason: 'Reagendamento realizado — aguardando nova confirmação',
      metadata: {
        oldDate,
        oldTime,
        newDate,
        newTime
      }
    }

    setAppointments(current =>
      (current || []).map(apt =>
        apt.id === appointmentId
          ? { 
              ...apt, 
              date: newDate, 
              time: newTime, 
              status: 'pending',
              lastModified: new Date().toISOString(),
              statusHistory: [...(apt.statusHistory || []), historyEntry]
            }
          : apt
      )
    )

    try {
      await api.patch(`/agendamentos/${appointmentId}`, {
        date: newDate,
        time: newTime,
        status: 'pending',
        statusHistory: [...(appointment.statusHistory || []), historyEntry],
        lastModified: new Date().toISOString()
      })
      console.log('[APP] Reagendamento salvo no backend com sucesso')
    } catch (error) {
      console.error('[APP] Erro ao salvar reagendamento no backend:', error)
      toast.error('Erro ao salvar reagendamento no servidor')
      refreshAppointments()
      return
    }

    toast.success(`Agendamento reagendado para ${format(parseISO(newDate), 'dd/MM/yyyy')} às ${newTime}. O status voltou para pendente.`)

    await createAuditLog({
      action: 'appointment_rescheduled',
      description: `Agendamento de ${appointment.fullName} reagendado de ${format(parseISO(oldDate), 'dd/MM/yyyy')} ${oldTime} para ${format(parseISO(newDate), 'dd/MM/yyyy')} ${newTime}`,
      performedBy: user?.login || 'Secretaria',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'appointment',
      targetId: appointment.id,
      targetName: `${appointment.fullName} - ${appointment.protocol}`,
      changes: {
        date: { from: oldDate, to: newDate },
        time: { from: oldTime, to: newTime }
      },
      metadata: {
        protocol: appointment.protocol
      }
    })

    const location = locations?.find(loc => loc.id === appointment.locationId)
    const notificationResult = await sendRescheduleNotification(
      { ...appointment, date: newDate, time: newTime },
      systemConfig,
      location?.address,
      location?.googleMapsUrl,
      location?.name
    )
    if (notificationResult.success) {
      const channels: string[] = []
      if (notificationResult.emailSent) channels.push('📧 Email')
      if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')
      toast.success(`Notificação de reagendamento enviada via ${channels.join(', ')}!`, { duration: 5000 })
    }
  }

  const handleUpdateAppointmentDetails = async (
    appointmentId: string,
    updates: Pick<Appointment, 'fullName' | 'email' | 'phone' | 'street' | 'number' | 'neighborhood' | 'cpf' | 'regionType' | 'sedeId' | 'districtId' | 'neighborhoodId'>
  ) => {
    const appointment = appointments?.find(apt => apt.id === appointmentId)
    if (!appointment) {
      toast.error('Agendamento não encontrado.')
      return
    }

    type EditableField = 'fullName' | 'email' | 'phone' | 'street' | 'number' | 'neighborhood' | 'cpf' | 'regionType' | 'sedeId' | 'districtId' | 'neighborhoodId'
    const editableFields: EditableField[] = ['fullName', 'email', 'phone', 'street', 'number', 'neighborhood', 'cpf', 'regionType', 'sedeId', 'districtId', 'neighborhoodId']
    const changes: Record<string, { from: string | undefined; to: string | undefined }> = {}
    const sanitizedUpdates: Partial<Appointment> = {}

    editableFields.forEach(field => {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field]
        if ((updates[field] || '') !== (appointment[field] || '')) {
          changes[field] = {
            from: (appointment[field] as string | undefined) || '',
            to: (updates[field] as string | undefined) || ''
          }
        }
      }
    })

    if (Object.keys(changes).length === 0) {
      toast.info('Nenhuma alteração foi detectada nos dados do cidadão.')
      return
    }

    try {
      // Enviar alterações ao banco de dados via API
      await api.patch(`/agendamentos/${appointmentId}`, {
        fullName: updates.fullName,
        email: updates.email,
        phone: updates.phone,
        cpf: updates.cpf,
        street: updates.street,
        number: updates.number,
        neighborhood: updates.neighborhood,
        regionType: updates.regionType,
      })
    } catch (err) {
      console.error('[App] Falha ao persistir dados pessoais no banco:', err)
      toast.error('Erro ao salvar as alterações. Tente novamente.')
      return
    }

    setAppointments(current =>
      (current || []).map(apt =>
        apt.id === appointmentId
          ? { ...apt, ...sanitizedUpdates, lastModified: new Date().toISOString() }
          : apt
      )
    )

    toast.success('Dados pessoais atualizados com sucesso.')

    const user = await window.spark.user()
    await createAuditLog({
      action: 'appointment_updated',
      description: `Dados pessoais de ${appointment.fullName} atualizados (${Object.keys(changes).join(', ')})`,
      performedBy: currentUser?.fullName || user?.login || 'Secretaria',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'appointment',
      targetId: appointment.id,
      targetName: `${appointment.fullName} - ${appointment.protocol}`,
      changes,
      metadata: {
        protocol: appointment.protocol
      }
    })
  }

  const handleBulkDelete = async (ids: string[]) => {
    const deletedAppointments = (appointments || []).filter(apt => ids.includes(apt.id))
    
    try {
      // EXCLUIR DO BACKEND POSTGRESQL
      console.log('[App] Excluindo agendamentos via API:', ids)
      await Promise.all(
        ids.map(id => api.delete(`/agendamentos/${id}`))
      )
      console.log('[App] ✅ Agendamentos excluídos do PostgreSQL')
      
      // Atualizar estado local
      setAppointments(current =>
        (current || []).filter(apt => !ids.includes(apt.id))
      )
      
      toast.success(`${ids.length} agendamento(s) excluído(s)`)

      const user = await window.spark.user()
      await createAuditLog({
        action: 'appointment_bulk_deleted',
        description: `Exclusão em massa de ${ids.length} agendamento(s)`,
        performedBy: currentUser?.fullName || user?.login || 'Secretaria',
        performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
        targetType: 'appointment',
        metadata: {
          deletedCount: ids.length,
          appointmentIds: ids,
          appointments: deletedAppointments.map(apt => ({
            protocol: apt.protocol,
            name: apt.fullName,
            cpf: apt.cpf,
            date: apt.date,
            time: apt.time
          }))
        },
        tags: ['bulk-delete', 'critical-action']
      })
    } catch (error) {
      console.error('[App] ❌ Erro ao excluir agendamentos:', error)
      toast.error('Erro ao excluir agendamento(s). Tente novamente.')
      // Recarregar lista em caso de erro
      refreshAppointments()
    }
  }

  const handleDeleteAppointment = async (appointmentId: string) => {
    await handleBulkDelete([appointmentId])
  }

  const handlePriorityChange = async (appointmentId: string, priority: AppointmentPriority) => {
    const previous = (appointments || []).find(apt => apt.id === appointmentId)?.priority || 'normal'
    const nowIso = new Date().toISOString()
    setAppointments(current =>
      (current || []).map(apt =>
        apt.id === appointmentId
          ? { ...apt, priority, lastModified: nowIso }
          : apt
      )
    )

    try {
      await api.patch(`/agendamentos/${appointmentId}`, {
        priority,
        lastModified: nowIso
      })
    } catch (error) {
      console.error('[APP] Erro ao salvar prioridade no backend:', error)
      setAppointments(current =>
        (current || []).map(apt =>
          apt.id === appointmentId
            ? { ...apt, priority: previous, lastModified: nowIso }
            : apt
        )
      )
      toast.error('Erro ao salvar prioridade no servidor')
      return
    }
    
    const priorityLabels = { normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
    toast.success(`Prioridade alterada para ${priorityLabels[priority]}`)
  }

  const handleUserCancelAppointment = async (appointmentId: string, reason: string) => {
    const appointment = appointments?.find(apt => apt.id === appointmentId)
    if (!appointment) return

    const normalizedReason = reason?.trim() || 'Solicitado pelo usuário'
    const historyEntry: StatusChangeHistory = {
      id: crypto.randomUUID(),
      from: appointment.status,
      to: 'cancelled',
      changedBy: appointment.fullName,
      changedAt: new Date().toISOString(),
      reason: `Cancelado pelo usuário: ${normalizedReason}`,
      metadata: {
        cancellationCategory: 'user-request',
        cancellationReasonText: normalizedReason
      }
    }

    setAppointments(current =>
      (current || []).map(apt =>
        apt.id === appointmentId
          ? {
              ...apt,
              status: 'cancelled' as AppointmentStatus,
              cancelledBy: 'user' as const,
              cancellationReason: normalizedReason,
              lastModified: new Date().toISOString(),
              statusHistory: [...(apt.statusHistory || []), historyEntry]
            }
          : apt
      )
    )

    toast.success('Agendamento cancelado com sucesso')

    await createAuditLog({
      action: 'appointment_cancelled',
      description: `Agendamento de ${appointment.fullName} cancelado pelo usuário: ${normalizedReason}`,
      performedBy: appointment.fullName,
      performedByRole: 'user',
      targetType: 'appointment',
      targetId: appointment.id,
      targetName: `${appointment.fullName} - ${appointment.protocol}`,
      metadata: {
        protocol: appointment.protocol,
        reason: normalizedReason,
        date: appointment.date,
        time: appointment.time
      }
    })

    const notificationResult = await sendCancellationNotification(appointment, systemConfig)
    if (notificationResult.success) {
      const channels: string[] = []
      if (notificationResult.emailSent) channels.push('📧 Email')
      if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')
      toast.success(`Confirmação de cancelamento enviada via ${channels.join(', ')}!`, { duration: 5000 })
    }
  }

  const handleAddLocation = async (locationData: Omit<Location, 'id' | 'createdAt'>) => {
    const newLocation: Location = {
      ...locationData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    setLocations(current => [...(current || []), newLocation])

    const user = await window.spark.user()
    await createAuditLog({
      action: 'location_created',
      description: `Nova localidade criada: ${locationData.name}${locationData.type ? ` (${locationData.type})` : ''}`,
      performedBy: currentUser?.fullName || user?.login || 'Admin',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'location',
      targetId: newLocation.id,
      targetName: newLocation.name,
      metadata: {
        locationType: locationData.type || 'não informado',
        address: locationData.address,
        city: locationData.city
      }
    })
  }

  const handleUpdateLocation = async (id: string, locationData: Omit<Location, 'id' | 'createdAt'>) => {
    const oldLocation = (locations || []).find(loc => loc.id === id)
    
    setLocations(current => 
      (current || []).map(loc => 
        loc.id === id 
          ? { ...loc, ...locationData }
          : loc
      )
    )

    const changes: Record<string, { from: any; to: any }> = {}
    if (oldLocation?.name !== locationData.name) {
      changes.name = { from: oldLocation?.name, to: locationData.name }
    }
    if (oldLocation?.type !== locationData.type) {
      changes.type = { from: oldLocation?.type, to: locationData.type }
    }
    if (oldLocation?.googleMapsUrl !== locationData.googleMapsUrl) {
      changes.googleMapsUrl = { from: oldLocation?.googleMapsUrl, to: locationData.googleMapsUrl }
    }

    const user = await window.spark.user()
    await createAuditLog({
      action: 'location_updated',
      description: `Localidade atualizada: ${locationData.name}`,
      performedBy: currentUser?.fullName || user?.login || 'Admin',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'location',
      targetId: id,
      targetName: locationData.name,
      oldValue: oldLocation,
      newValue: { ...oldLocation, ...locationData },
      changes,
      tags: ['update', 'location']
    })
  }

  const handleDeleteLocation = async (id: string) => {
    const location = (locations || []).find(loc => loc.id === id)
    setLocations(current => (current || []).filter(loc => loc.id !== id))

    if (location) {
      const user = await window.spark.user()
      await createAuditLog({
        action: 'location_deleted',
        description: `Localidade excluída: ${location.name}`,
        performedBy: currentUser?.fullName || user?.login || 'Admin',
        performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
        targetType: 'location',
        targetId: location.id,
        targetName: location.name,
        oldValue: location,
        tags: ['delete', 'location']
      })
    }
  }

  const handleRegisterUser = (userData: Omit<SecretaryUser, 'id' | 'createdAt'>) => {
    const newUser: SecretaryUser = {
      ...userData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    setSecretaryUsers(current => [...(current || []), newUser])
    setCurrentUser(newUser)
  }

  const handleAddSecretaryUser = async (userData: Omit<SecretaryUser, 'id' | 'createdAt'>) => {
    try {
      const created = await api.post<SecretaryUser>('/secretary-users', userData)
      setSecretaryUsers(current => [...(current || []), created])
      toast.success('Usuário criado')
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      const message = error instanceof Error ? error.message : 'Erro ao criar usuário'
      throw new Error(message)
    }
  }

  const handleLogin = async (user: SecretaryUser) => {
    setCurrentUser(user)
    setCurrentView('secretary')

    try {
      await requestAndStoreClientLocation()
    } catch (error) {
      console.warn('[geolocation] Permissão de localização negada ou indisponível:', error)
      toast.warning('Permita a localização para registrar cidade real nos logs de auditoria.')
    }
    
    await createAuditLog({
      action: 'user_login',
      description: `${user.fullName} fez login no sistema`,
      performedBy: user.fullName,
      performedByRole: user.isAdmin ? 'admin' : 'secretary',
      targetType: 'user',
      targetId: user.id,
      targetName: user.fullName,
      metadata: {
        username: user.username,
        isAdmin: user.isAdmin
      }
    })
  }

  const logoutUser = useCallback(async (reason: 'manual' | 'timeout' = 'manual') => {
    if (currentUser) {
      await createAuditLog({
        action: 'user_logout',
        description:
          reason === 'timeout'
            ? `${currentUser.fullName} saiu do sistema por inatividade`
            : `${currentUser.fullName} saiu do sistema`,
        performedBy: currentUser.fullName,
        performedByRole: currentUser.isAdmin ? 'admin' : 'secretary',
        targetType: 'user',
        targetId: currentUser.id,
        targetName: currentUser.fullName
      })
    }

    try { sessionStorage.removeItem(SECRETARY_SESSION_USER_KEY) } catch {}
    try { localStorage.removeItem('token') } catch {}
    setCurrentUser(null)
    setCurrentView('secretary')
    toast.info(reason === 'timeout' ? 'Sessão encerrada por 10 minutos sem interação' : 'Você saiu do sistema')
  }, [currentUser])

  const handleLogout = useCallback(async () => {
    await logoutUser('manual')
  }, [logoutUser])

  useEffect(() => {
    if (!currentUser || typeof window === 'undefined') return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const resetInactivityTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        void logoutUser('timeout')
      }, INACTIVITY_TIMEOUT_MS)
    }

    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true })
    })

    resetInactivityTimer()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer)
      })
    }
  }, [currentUser, logoutUser])

  const handleUpdateConfig = async (config: ExtendedSystemConfig) => {
    const oldConfig = systemConfig
    setSystemConfig(config)
    try { localStorage.setItem(SYSTEM_CONFIG_CACHE_KEY, JSON.stringify(config)) } catch {}
    
    const root = document.documentElement
    root.style.setProperty('--primary', config.primaryColor)
    root.style.setProperty('--secondary', config.secondaryColor)
    root.style.setProperty('--accent', config.accentColor)
    root.style.setProperty('--ring', config.accentColor)

    try {
      // Salvar configuração principal (inclui logo e dados institucionais)
      await api.put('/system-config', config)

      // Salvar configurações de SMTP somente quando vierem dados de credenciais
      const hasSmtpCredentials =
        Boolean(config.emailSettings?.host) ||
        Boolean(config.emailSettings?.user) ||
        Boolean(config.emailSettings?.password) ||
        Boolean(config.emailSettings?.replyTo) ||
        Boolean(config.emailSettings?.senderName) ||
        typeof config.emailSettings?.port === 'number' ||
        typeof config.emailSettings?.secure === 'boolean'

      if (config.emailSettings && hasSmtpCredentials) {
        await api.put('/system-config/smtp/1', {
          smtp_host: config.emailSettings.host,
          smtp_port: config.emailSettings.port,
          smtp_user: config.emailSettings.user,
          smtp_password: config.emailSettings.password,
          smtp_from_name: config.emailSettings.senderName,
          smtp_from_email: config.emailSettings.replyTo,
          smtp_secure: config.emailSettings.secure,
          ativo: config.emailSettings.enabled,
        });
      }

      // Salvar configurações do WhatsApp somente quando vierem credenciais válidas
      const hasWhatsappCredentials =
        Boolean(config.whatsappSettings?.instanceId) ||
        Boolean(config.whatsappSettings?.apiKey) ||
        Boolean(config.whatsappSettings?.businessNumber) ||
        Boolean(config.whatsappSettings?.apiUrl)

      if (config.whatsappSettings && hasWhatsappCredentials) {
        await api.put('/system-config/whatsapp/1', {
          api_url: config.whatsappSettings.apiUrl,
          api_token: config.whatsappSettings.apiKey,
          instance_id: config.whatsappSettings.instanceId,
          numero_origem: config.whatsappSettings.businessNumber,
          ativo: config.whatsappSettings.enabled,
        });
      }
      
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações. Verifique o console para mais detalhes.');
    }

    const user = await window.spark.user()
    await createAuditLog({
      action: 'system_settings_changed',
      description: `Configurações do sistema alteradas`,
      performedBy: currentUser?.fullName || user?.login || 'Admin',
      performedByRole: 'admin',
      targetType: 'config',
      targetName: 'Configurações do Sistema',
      oldValue: oldConfig,
      newValue: config,
      tags: ['config', 'system-settings']
    })
  }

  const handleUpdateUser = async (userId: string, updates: Partial<SecretaryUser>) => {
    try {
      await api.put(`/secretary-users/${userId}`, updates)
      setSecretaryUsers(current =>
        (current || []).map(user =>
          user.id === userId ? { ...user, ...updates } : user
        )
      )
      toast.success('Usuário atualizado')
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      toast.error('Erro ao atualizar usuário')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.delete(`/secretary-users/${userId}`)
      setSecretaryUsers(current => (current || []).filter(user => user.id !== userId))
      toast.success('Usuário removido')
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      toast.error('Erro ao deletar usuário')
    }
  }

  const handleAddBlockedDate = async (date: string, reason: string, blockType: 'full-day' | 'specific-times', blockedTimes?: string[], silent?: boolean) => {
    const user = await window.spark.user()
    const createdBy = currentUser?.fullName || user?.login || 'Admin'
    
    try {
      console.log('[App] Bloqueando data via API:', { date, reason, blockType, blockedTimes, createdBy })
      
      // ENVIAR PARA O BACKEND POSTGRESQL
      const response = await api.post<BlockedDate>('/agendamentos/datas-bloqueadas', {
        date,
        reason,
        blockType,
        blockedTimes,
        createdBy
      })
      
      console.log('[App] ✅ Data bloqueada salva no PostgreSQL:', response)
      
      setBlockedDates(current => [...(current || []), response])
      
      if (!silent) {
        toast.success('Data bloqueada com sucesso!')
      }

      await createAuditLog({
        action: 'blocked_date_created',
        description: `Data bloqueada: ${format(new Date(date), 'dd/MM/yyyy')} - ${reason}`,
        performedBy: createdBy,
        performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
        targetType: 'blocked_date',
        targetId: response.id,
        targetName: format(new Date(date), 'dd/MM/yyyy'),
        metadata: {
          date,
          reason,
          blockType,
          blockedTimes
        }
      })
    } catch (error) {
      console.error('[App] ❌ Erro ao bloquear data:', error)
      toast.error('Erro ao bloquear data')
    }
  }

  const handleDeleteBlockedDate = async (id: string, silent?: boolean) => {
    const blockedDate = (blockedDates || []).find(bd => bd.id === id)
    
    try {
      console.log('[App] Removendo bloqueio via API, ID:', id)
      await api.delete(`/agendamentos/datas-bloqueadas/${id}`)
      console.log('[App] ✅ Bloqueio removido do PostgreSQL')
      
      setBlockedDates(current => (current || []).filter(bd => bd.id !== id))
      
      if (!silent) {
        toast.success('Bloqueio removido')
      }

      if (blockedDate) {
        const user = await window.spark.user()
        await createAuditLog({
          action: 'blocked_date_deleted',
          description: `Bloqueio removido para ${format(new Date(blockedDate.date), 'dd/MM/yyyy')}`,
          performedBy: currentUser?.fullName || user?.login || 'Admin',
          performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
          targetType: 'blocked_date',
          targetId: blockedDate.id,
          targetName: format(new Date(blockedDate.date), 'dd/MM/yyyy'),
          oldValue: blockedDate
        })
      }
    } catch (error) {
      console.error('Erro ao desbloquear data:', error)
      toast.error('Erro ao desbloquear data')
    }
  }

  const handleMarkAsDelivered = async (appointmentId: string, deliveryData: RGDelivery) => {
    const appointment = appointments?.find(apt => apt.id === appointmentId)
    if (!appointment) return

    if (appointment.status !== 'cin-ready') {
      toast.error('Este CIN ainda não está marcado como CIN Pronta')
      return
    }

    const historyEntry: StatusChangeHistory = {
      id: crypto.randomUUID(),
      from: 'cin-ready',
      to: 'cin-delivered',
      changedBy: deliveryData.deliveredBy,
      changedAt: deliveryData.deliveredAt,
      reason: `CIN entregue a ${deliveryData.receivedByName} (${deliveryData.receivedByDocument})`
    }

    const deliveryUpdates: Partial<Appointment> = {
      status: 'cin-delivered',
      rgDelivery: deliveryData,
      lastModified: new Date().toISOString(),
      statusHistory: [...(appointment.statusHistory || []), historyEntry]
    }

    setAppointments(current =>
      (current || []).map(apt =>
        apt.id === appointmentId
          ? {
              ...apt,
              ...deliveryUpdates
            }
          : apt
      )
    )

    try {
      await api.patch(`/agendamentos/${appointmentId}`, deliveryUpdates)
    } catch (error) {
      console.error('[App] ❌ Erro ao salvar entrega de CIN no backend:', error)
      toast.error('Erro ao salvar entrega de CIN no servidor')
    }

    const location = locations?.find(loc => loc.id === appointment.locationId)
    const notificationResult = await sendStatusUpdateNotification(
      { ...appointment, ...deliveryUpdates, status: 'cin-delivered' },
      'cin-ready',
      'cin-delivered',
      systemConfig,
      location?.address,
      location?.googleMapsUrl,
      location?.name
    )

    toast.success('CIN marcado como entregue com sucesso!')

    if (notificationResult.success) {
      const channels: string[] = []
      if (notificationResult.emailSent) channels.push('📧 Email')
      if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')

      if (channels.length > 0) {
        toast.success(`Notificação de entrega de CIN enviada via ${channels.join(', ')}!`, {
          duration: 5000
        })
      }
    }

    await createAuditLog({
      action: 'rg_marked_as_delivered',
      description: `CIN entregue a ${deliveryData.receivedByName} (CPF/Doc: ${deliveryData.receivedByDocument}) - Agendamento de ${appointment.fullName}`,
      performedBy: deliveryData.deliveredBy,
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'appointment',
      targetId: appointment.id,
      targetName: `${appointment.fullName} - ${appointment.protocol}`,
      metadata: {
        protocol: appointment.protocol,
        receivedBy: deliveryData.receivedByName,
        receivedByDocument: deliveryData.receivedByDocument,
        deliveredAt: deliveryData.deliveredAt,
        notes: deliveryData.notes
      }
    })
  }

  const handleResendRGNotification = async (appointmentId: string) => {
    const appointment = appointments?.find(apt => apt.id === appointmentId)
    if (!appointment) {
      toast.error('Agendamento não encontrado')
      return
    }

    if (appointment.status !== 'cin-ready') {
      toast.error('Reenvio disponível apenas para CINs marcados como CIN Prontas')
      return
    }

    const location = locations?.find(loc => loc.id === appointment.locationId)
    const notificationResult = await sendReadyForDeliveryNotification(
      appointment,
      systemConfig,
      location?.address,
      location?.googleMapsUrl
    )

    if (notificationResult.success) {
      const channels: string[] = []
      if (notificationResult.emailSent) channels.push('📧 Email')
      if (notificationResult.whatsappSent) channels.push('💬 WhatsApp')
      
      toast.success(`Notificação reenviada com sucesso!`, {
        description: `Enviada via ${channels.join(', ')} para ${appointment.fullName}`,
        duration: 5000
      })
    } else {
      toast.error('Erro ao reenviar notificação')
    }
  }

  const handleImportData = async (importedData: Partial<Appointment>[]) => {
    const newAppointments = importedData.map(data => {
      const initialHistory: StatusChangeHistory = {
        id: crypto.randomUUID(),
        from: null,
        to: 'pending',
        changedBy: 'Sistema de Importação',
        changedAt: new Date().toISOString(),
        reason: 'Agendamento importado via arquivo'
      }

      const lgpdConsentData: LGPDConsentType = {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        userCPF: data.cpf || '',
        consentDate: new Date().toISOString(),
        consentVersion: systemConfig?.lgpdSettings?.consentVersion || '1.0',
        dataUsageAccepted: true,
        notificationAccepted: true
      }

      return {
        id: crypto.randomUUID(),
        protocol: data.protocol || generateProtocol(),
        fullName: data.fullName || '',
        cpf: data.cpf || '',
        rg: data.rg || '',
        phone: data.phone || '',
        email: data.email || '',
        locationId: data.locationId || locations?.[0]?.id || '',
        street: data.street || '',
        number: data.number || '',
        neighborhood: data.neighborhood || '',
        date: data.date || format(new Date(), 'yyyy-MM-dd'),
        time: data.time || '09:00',
        status: (data.status as AppointmentStatus) || 'pending',
        createdAt: data.createdAt || new Date().toISOString(),
        statusHistory: [initialHistory],
        priority: data.priority as AppointmentPriority || 'normal',
        lgpdConsent: lgpdConsentData
      } as Appointment
    })

    setAppointments(current => [...(current || []), ...newAppointments])
    toast.success(`${newAppointments.length} agendamento(s) importado(s) com sucesso!`)

    const user = await window.spark.user()
    await createAuditLog({
      action: 'data_imported',
      description: `Importação de ${newAppointments.length} agendamento(s) via arquivo`,
      performedBy: currentUser?.fullName || user?.login || 'Admin',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'data',
      metadata: {
        importCount: newAppointments.length,
        importedAppointments: newAppointments.map(apt => ({
          protocol: apt.protocol,
          name: apt.fullName,
          cpf: apt.cpf,
          date: apt.date,
          time: apt.time
        }))
      },
      tags: ['import', 'bulk-operation']
    })
  }

  const handleExportCSV = async () => {
    if (!appointments || appointments.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }
    exportToCSV(appointments, locations || [])
    toast.success('Dados exportados em CSV!')

    const user = await window.spark.user()
    await createAuditLog({
      action: 'data_exported',
      description: `Exportação de ${appointments.length} agendamento(s) em formato CSV`,
      performedBy: currentUser?.fullName || user?.login || 'Secretary',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'data',
      metadata: {
        exportCount: appointments.length,
        exportFormat: 'CSV'
      },
      tags: ['export', 'csv']
    })
  }

  const handleExportJSON = async () => {
    if (!appointments || appointments.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }
    exportToJSON(appointments, locations || [])
    toast.success('Dados exportados em JSON!')

    const user = await window.spark.user()
    await createAuditLog({
      action: 'data_exported',
      description: `Exportação de ${appointments.length} agendamento(s) em formato JSON`,
      performedBy: currentUser?.fullName || user?.login || 'Secretary',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'data',
      metadata: {
        exportCount: appointments.length,
        exportFormat: 'JSON'
      },
      tags: ['export', 'json']
    })
  }

  const handleExportPDF = async () => {
    if (!appointments || appointments.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }
    exportToPDF(appointments, locations || [], `${systemConfig?.systemName || 'Sistema'} - Relatório de Agendamentos`)
    toast.success('Relatório PDF gerado!')

    const user = await window.spark.user()
    await createAuditLog({
      action: 'data_exported',
      description: `Exportação de ${appointments.length} agendamento(s) em formato PDF`,
      performedBy: currentUser?.fullName || user?.login || 'Secretary',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'data',
      metadata: {
        exportCount: appointments.length,
        exportFormat: 'PDF'
      },
      tags: ['export', 'pdf']
    })
  }

  const handleExportExcel = async () => {
    if (!appointments || appointments.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }
    exportToExcel(appointments, locations || [])
    toast.success('Dados exportados em Excel!')

    const user = await window.spark.user()
    await createAuditLog({
      action: 'data_exported',
      description: `Exportação de ${appointments.length} agendamento(s) em formato Excel`,
      performedBy: currentUser?.fullName || user?.login || 'Secretary',
      performedByRole: currentUser?.isAdmin ? 'admin' : 'secretary',
      targetType: 'data',
      metadata: {
        exportCount: appointments.length,
        exportFormat: 'Excel'
      },
      tags: ['export', 'excel']
    })
  }

  useEffect(() => {
    if (systemConfig) {
      const root = document.documentElement
      root.style.setProperty('--primary', systemConfig.primaryColor)
      root.style.setProperty('--secondary', systemConfig.secondaryColor)
      root.style.setProperty('--accent', systemConfig.accentColor)
      root.style.setProperty('--ring', systemConfig.accentColor)
      
      if (systemConfig.titleFont) {
        root.style.setProperty('--font-heading', `'${systemConfig.titleFont}', system-ui, sans-serif`)
        const titleFontLink = document.getElementById('title-font-link')
        if (titleFontLink) {
          titleFontLink.remove()
        }
        const link = document.createElement('link')
        link.id = 'title-font-link'
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${systemConfig.titleFont.replace(/ /g, '+')}:wght@500;600;700&display=swap`
        document.head.appendChild(link)
      }
      
      if (systemConfig.bodyFont) {
        root.style.setProperty('--font-body', `'${systemConfig.bodyFont}', system-ui, sans-serif`)
        const bodyFontLink = document.getElementById('body-font-link')
        if (bodyFontLink) {
          bodyFontLink.remove()
        }
        const link = document.createElement('link')
        link.id = 'body-font-link'
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${systemConfig.bodyFont.replace(/ /g, '+')}:wght@400;500;600&display=swap`
        document.head.appendChild(link)
      }
      
      if (systemConfig.borderRadiusPreview) {
        root.style.setProperty('--radius', `${systemConfig.borderRadiusPreview / 16}rem`)
      }
      
      document.title = `${systemConfig.systemName} - Sistema de Agendamento`
    }
  }, [systemConfig])

  if ((currentView === 'secretary' || currentView === 'atendimento' || currentView === 'locations' || currentView === 'admin' || currentView === 'blocked-dates' || currentView === 'rg-delivery' || currentView === 'rg-report' || currentView === 'analytics' || currentView === 'import-export' || currentView === 'report-templates' || currentView === 'scheduled-reports' || currentView === 'execution-history' || currentView === 'audit-logs' || currentView === 'reminder-history' || currentView === 'notification-test') && !currentUser) {
    return (
      <>
        <LoginForm 
          onLogin={handleLogin}
          hasUsers={Boolean(secretaryUsers?.length)}
        />
        <Toaster position="top-center" />
      </>
    )
  }

  return (
    <SmoothScrollContainer>
      <SmoothScrollWrapper showProgressBar={true}>
        <div className="flex min-h-screen bg-background">
          <Toaster position="top-center" />
          <NotificationIndicator />
          <ScrollToTop />
          {ConfirmDialogNode}
          
          {currentUser && (
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.3 }}
              className="w-72 border-r bg-card flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
            >
              <div className="p-4 border-b">
                {systemConfig?.logo ? (
                  <img
                    src={systemConfig.logo}
                    alt="Logo"
                    className="w-full object-contain"
                    style={{ maxHeight: '90px' }}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <IdentificationCard className="text-primary" size={36} weight="duotone" />
                    <div>
                      <h2 className="font-semibold text-foreground text-sm">
                        {systemConfig?.systemName || 'Agendamento CIN'}
                      </h2>
                      <p className="text-xs text-muted-foreground">Sistema de Agendamento</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCircle size={24} className="text-primary" weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{shortCurrentUserName}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentUser.isAdmin ? 'Administrador' : 'Secretaria'}
                    </p>
                  </div>
                </div>
              </div>

              <nav className="p-3 space-y-1">
                {canAccessView('user') && (
                  <Button
                    variant={currentView === 'user' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => setCurrentView('user')}
                  >
                    <IdentificationCard size={20} weight={currentView === 'user' ? 'fill' : 'regular'} />
                    <span>Página Pública</span>
                  </Button>
                )}

                {canAccessView('secretary') && (
                  <Button
                    variant={currentView === 'secretary' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => setCurrentView('secretary')}
                  >
                    <List size={20} weight={currentView === 'secretary' ? 'fill' : 'regular'} />
                    <span>Secretaria</span>
                  </Button>
                )}

                {canAccessView('atendimento') && (
                  <Button
                    variant={currentView === 'atendimento' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => setCurrentView('atendimento')}
                  >
                    <UsersThree size={20} weight={currentView === 'atendimento' ? 'fill' : 'regular'} />
                    <span>Atendimento</span>
                  </Button>
                )}

                {canAccessView('rg-delivery') && (
                  <Button
                    variant={currentView === 'rg-delivery' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 h-11 relative"
                    onClick={() => setCurrentView('rg-delivery')}
                  >
                    <Package size={20} weight={currentView === 'rg-delivery' ? 'fill' : 'regular'} />
                    <span>Entrega CIN</span>
                    {pendingDeliveryCount > 0 && (
                      <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg animate-pulse">
                        {pendingDeliveryCount}
                      </span>
                    )}
                  </Button>
                )}

                {canAccessView('analytics') && (
                  <Button
                    variant={currentView === 'analytics' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => setCurrentView('analytics')}
                  >
                    <ChartBar size={20} weight={currentView === 'analytics' ? 'fill' : 'regular'} />
                    <span>Analytics</span>
                  </Button>
                )}


                {(canAccessView('import-export') || canAccessView('report-templates') || canAccessView('scheduled-reports') || canAccessView('execution-history')) && (
                  <div className="pt-2 pb-2">
                    <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Relatórios
                    </p>

                    {canAccessView('import-export') && (
                      <Button
                        variant={currentView === 'import-export' ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => setCurrentView('import-export')}
                      >
                        <Download size={20} weight={currentView === 'import-export' ? 'fill' : 'regular'} />
                        <span>Importar/Exportar</span>
                      </Button>
                    )}

                    {(canAccessView('report-templates') || canAccessView('scheduled-reports') || canAccessView('execution-history')) && (
                      <>
                        {canAccessView('report-templates') && (
                        <Button
                          variant={currentView === 'report-templates' ? 'secondary' : 'ghost'}
                          className="w-full justify-start gap-3 h-11"
                          onClick={() => setCurrentView('report-templates')}
                        >
                          <FilePlus size={20} weight={currentView === 'report-templates' ? 'fill' : 'regular'} />
                          <span>Templates</span>
                        </Button>
                        )}

                        {canAccessView('scheduled-reports') && (
                        <Button
                          variant={currentView === 'scheduled-reports' ? 'secondary' : 'ghost'}
                          className="w-full justify-start gap-3 h-11"
                          onClick={() => setCurrentView('scheduled-reports')}
                        >
                          <ClockClockwise size={20} weight={currentView === 'scheduled-reports' ? 'fill' : 'regular'} />
                          <span>Agendamentos</span>
                        </Button>
                        )}

                        {canAccessView('execution-history') && (
                        <Button
                          variant={currentView === 'execution-history' ? 'secondary' : 'ghost'}
                          className="w-full justify-start gap-3 h-11"
                          onClick={() => setCurrentView('execution-history')}
                        >
                          <ClipboardText size={20} weight={currentView === 'execution-history' ? 'fill' : 'regular'} />
                          <span>Histórico</span>
                        </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {(canAccessView('audit-logs') || canAccessView('reminder-history') || canAccessView('notification-test')) && (
                  <div className="pt-2 pb-2">
                    <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Monitoramento
                    </p>

                    {(canAccessView('audit-logs') || canAccessView('reminder-history')) && (
                      <>
                        {canAccessView('audit-logs') && (
                        <Button
                          variant={currentView === 'audit-logs' ? 'secondary' : 'ghost'}
                          className="w-full justify-start gap-3 h-11"
                          onClick={() => setCurrentView('audit-logs')}
                        >
                          <ShieldCheck size={20} weight={currentView === 'audit-logs' ? 'fill' : 'regular'} />
                          <span>Logs de Auditoria</span>
                        </Button>
                        )}

                        {canAccessView('reminder-history') && (
                        <Button
                          variant={currentView === 'reminder-history' ? 'secondary' : 'ghost'}
                          className="w-full justify-start gap-3 h-11"
                          onClick={() => setCurrentView('reminder-history')}
                        >
                          <Bell size={20} weight={currentView === 'reminder-history' ? 'fill' : 'regular'} />
                          <span>Histórico de Lembretes</span>
                        </Button>
                        )}
                      </>
                    )}

                    {canAccessView('notification-test') && (
                      <Button
                        variant={currentView === 'notification-test' ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => setCurrentView('notification-test')}
                      >
                        <PaperPlaneRight size={20} weight={currentView === 'notification-test' ? 'fill' : 'regular'} />
                        <span>Testar Notificações</span>
                      </Button>
                    )}
                  </div>
                )}

                {(canAccessView('locations') || canAccessView('blocked-dates')) && (
                  <div className="pt-2 pb-2">
                    <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Gerenciamento
                    </p>

                    {canAccessView('locations') && (
                      <Button
                        variant={currentView === 'locations' ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => setCurrentView('locations')}
                      >
                        <MapPin size={20} weight={currentView === 'locations' ? 'fill' : 'regular'} />
                        <span>Localidades</span>
                      </Button>
                    )}

                    {canAccessView('blocked-dates') && (
                      <Button
                        variant={currentView === 'blocked-dates' ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => setCurrentView('blocked-dates')}
                      >
                        <CalendarBlank size={20} weight={currentView === 'blocked-dates' ? 'fill' : 'regular'} />
                        <span>Bloqueio de Datas</span>
                      </Button>
                    )}
                  </div>
                )}

                {canAccessView('admin') && (
                  <div className="pt-2 pb-2">
                    <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Sistema
                    </p>

                    <Button
                      variant={currentView === 'admin' ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-11"
                      onClick={() => setCurrentView('admin')}
                    >
                      <Gear size={20} weight={currentView === 'admin' ? 'fill' : 'regular'} />
                      <span>Administração</span>
                    </Button>
                  </div>
                )}
              </nav>

              <div className="p-4 mt-auto border-t">
                <div className="flex items-center gap-2 mb-3">
                  <ReminderStatusIndicator config={systemConfig || DEFAULT_CONFIG} />
                  <ThemeToggle defaultTheme={systemConfig?.defaultTheme} />
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11 text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <SignOut size={20} />
                  <span>Sair do Sistema</span>
                </Button>
              </div>
            </motion.aside>
          )}

          <div className="flex-1 flex flex-col min-h-screen">
            {!currentUser && <div className="h-6" />}

            {currentUser && (
              <div className="border-b bg-card flex-shrink-0 sticky top-0 z-40 shadow-sm">
                <div className="px-6 py-4">
                  <h1 className="text-2xl font-bold text-foreground">
                    {currentView === 'user' && 'Página Pública'}
                    {currentView === 'secretary' && 'Painel da Secretaria'}
                    {currentView === 'atendimento' && 'Painel de Atendimento'}
                    {currentView === 'rg-delivery' && 'Entrega de RG'}
                    {currentView === 'analytics' && 'Analytics e Estatísticas'}
                    {currentView === 'import-export' && 'Importar/Exportar Dados'}
                    {currentView === 'report-templates' && 'Templates de Relatórios'}
                    {currentView === 'scheduled-reports' && 'Relatórios Agendados'}
                    {currentView === 'execution-history' && 'Histórico de Execuções'}
                    {currentView === 'audit-logs' && 'Logs de Auditoria'}
                    {currentView === 'reminder-history' && 'Histórico de Lembretes'}
                    {currentView === 'notification-test' && 'Testar Notificações'}
                    {currentView === 'locations' && 'Gerenciar Localidades'}
                    {currentView === 'blocked-dates' && 'Bloqueio de Datas'}
                    {currentView === 'admin' && 'Administração do Sistema'}
                  </h1>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
            {currentView === 'admin' && currentUser && (isOwner || currentUser.isAdmin) ? (
              <div className="pb-8">
                <FadeIn direction="up" delay={0.1}>
                  <SystemConfigPanel 
                    config={systemConfig || {
                      systemName: 'Agendamento CIN',
                      primaryColor: 'oklch(0.45 0.15 145)',
                      secondaryColor: 'oklch(0.65 0.1 180)',
                      accentColor: 'oklch(0.55 0.18 145)',
                      bookingWindowDays: 60
                    }}
                    onUpdateConfig={handleUpdateConfig}
                    currentUser={currentUser}
                    systemName={systemConfig?.systemName}
                    secretaryUsers={secretaryUsers || []}
                    locations={locations || []}
                    onAddSecretaryUser={handleAddSecretaryUser}
                    onUpdateSecretaryUser={handleUpdateUser}
                    onDeleteSecretaryUser={handleDeleteUser}
                  />
                </FadeIn>
              </div>
            ) : currentView === 'rg-delivery' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <RGDeliveryQueue
                    appointments={visibleAppointments || []}
                    locations={visibleLocations || []}
                    onMarkAsDelivered={handleMarkAsDelivered}
                    onResendNotification={handleResendRGNotification}
                    onStatusChange={handleStatusChange}
                    currentUserName={shortCurrentUserName}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'analytics' && currentUser ? (
              <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                <FadeIn direction="up" delay={0.1}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ChartBar size={24} weight="duotone" />
                        Analytics e Estatísticas
                      </CardTitle>
                      <CardDescription>
                        Análise completa de dados e métricas do sistema
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AnalyticsDashboard 
                        appointments={visibleAppointments || []}
                        locations={visibleLocations || []}
                        systemName={systemConfig?.systemName}
                        currentUser={shortCurrentUserName}
                        institutionalLogo={systemConfig?.logo}
                        secretariaName={systemConfig?.contactInfo?.secretariaName}
                      />
                    </CardContent>
                  </Card>
                </FadeIn>
              </div>
            ) : currentView === 'import-export' && currentUser ? (
              <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                <FadeIn direction="left" delay={0.1}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload size={24} weight="duotone" />
                        Importar Dados
                      </CardTitle>
                      <CardDescription>
                        Importe agendamentos de arquivos externos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => setShowImportDialog(true)}
                        className="gap-2"
                        size="lg"
                      >
                        <Upload size={20} />
                        Importar de Arquivo (JSON, CSV, Excel)
                      </Button>
                    </CardContent>
                  </Card>
                </FadeIn>

                <FadeIn direction="up" delay={0.15}>
                  <FilteredReportExport
                    appointments={visibleAppointments || []}
                    locations={visibleLocations || []}
                    systemName={systemConfig?.systemName}
                  />
                </FadeIn>

              </div>
            ) : currentView === 'report-templates' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <ReportTemplateManager
                    appointments={visibleAppointments || []}
                    locations={visibleLocations || []}
                    currentUser={shortCurrentUserName}
                    onRunTemplate={(template) => setActiveTemplate(template)}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'scheduled-reports' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <ScheduledReportManager
                    templates={reportTemplates || []}
                    currentUser={shortCurrentUserName}
                    locations={visibleLocations || []}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'execution-history' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <ReportExecutionHistory
                    executionLogs={executionLogs || []}
                    onViewDetails={(log) => {
                      console.log('Viewing details for log:', log)
                    }}
                    onDownloadReport={(log) => {
                      console.log('Downloading report for log:', log)
                      toast.info('Funcionalidade de download em desenvolvimento')
                    }}
                    onRefresh={async () => {
                      await refreshExecutionLogs()
                    }}
                    onClearHistory={async () => {
                      try {
                        await api.delete('/report-execution-logs')
                        await refreshExecutionLogs()
                        toast.success('Histórico de execuções limpo com sucesso.')
                      } catch (error) {
                        console.error('[App] Erro ao limpar histórico de execuções', error)
                        toast.error('Não foi possível limpar o histórico de execuções.')
                      }
                    }}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'audit-logs' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <AuditLogViewer />
                </div>
              </FadeIn>
            ) : currentView === 'reminder-history' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <ReminderHistory
                    appointments={visibleAppointments || []}
                    locations={visibleLocations || []}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'notification-test' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <NotificationTestPanel
                    config={systemConfig || DEFAULT_CONFIG}
                    locations={visibleLocations || []}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'rg-report' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <RGDeliveryReport
                    appointments={visibleAppointments || []}
                    locations={visibleLocations || []}
                    systemName={systemConfig?.systemName || 'Agendamento CIN'}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'blocked-dates' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <BlockedDatesManager
                    blockedDates={blockedDates || []}
                    onAddBlockedDate={handleAddBlockedDate}
                    onDeleteBlockedDate={handleDeleteBlockedDate}
                    currentUser={shortCurrentUserName}
                    workingHours={systemConfig?.workingHours || DEFAULT_WORKING_HOURS}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'locations' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <TenantLocations />
                </div>
              </FadeIn>
            ) : currentView === 'atendimento' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <AtendimentoBoard
                    appointments={visibleAppointments || []}
                    locations={visibleLocations || []}
                    workingHours={systemConfig?.workingHours || DEFAULT_WORKING_HOURS}
                    maxAppointmentsPerSlot={systemConfig?.maxAppointmentsPerSlot || DEFAULT_MAX_APPOINTMENTS_PER_SLOT}
                    blockedDates={blockedDates || []}
                    bookingWindowDays={systemConfig?.bookingWindowDays || 60}
                    onConfirmAppointment={(appointmentId) => handleStatusChange(appointmentId, 'confirmed')}
                    onPriorityChange={handlePriorityChange}
                    onCompleteAppointment={(appointmentId) => handleStatusChange(appointmentId, 'completed')}
                    onCancelAppointment={(appointmentId, reason, metadata) => handleStatusChange(appointmentId, 'cancelled', reason, { metadata })}
                    onRollbackStatus={(appointmentId, status, reason) => handleStatusChange(appointmentId, status, reason)}
                    onReschedule={handleReschedule}
                    onDeleteAppointment={handleDeleteAppointment}
                    onUpdateAppointmentDetails={handleUpdateAppointmentDetails}
                    onAddNote={handleAddNote}
                    onDeleteNote={handleDeleteNote}
                  />
                </div>
              </FadeIn>
            ) : currentView === 'secretary' && currentUser ? (
              <FadeIn direction="up" delay={0.1}>
                <SecretaryPanel 
                  appointments={visibleAppointments || []}
                  locations={visibleLocations || []}
                  customFields={systemConfig?.customFields || []}
                  workingHours={systemConfig?.workingHours || DEFAULT_WORKING_HOURS}
                  maxAppointmentsPerSlot={systemConfig?.maxAppointmentsPerSlot || DEFAULT_MAX_APPOINTMENTS_PER_SLOT}
                  blockedDates={blockedDates || []}
                  bookingWindowDays={systemConfig?.bookingWindowDays || 60}
                  onStatusChange={handleStatusChange}
                  onAddNote={handleAddNote}
                  onDeleteNote={handleDeleteNote}
                  onReschedule={handleReschedule}
                  onBulkDelete={handleBulkDelete}
                  onPriorityChange={handlePriorityChange}
                  onUpdateAppointmentDetails={handleUpdateAppointmentDetails}
                  currentUser={currentUser}
                />
              </FadeIn>
            ) : (
              <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="rounded-3xl bg-card p-6 shadow-xl shadow-black/5">
                  <NovoAgendamento
                    appointments={appointments}
                    setAppointments={setAppointments}
                    locations={locations || []}
                    blockedDates={blockedDates || []}
                    systemConfig={systemConfig}
                    requiresLgpdConsent={systemConfig?.lgpdSettings?.enabled !== false}
                    defaultWorkingHours={systemConfig?.workingHours || DEFAULT_WORKING_HOURS}
                    defaultMaxAppointmentsPerSlot={systemConfig?.maxAppointmentsPerSlot || DEFAULT_MAX_APPOINTMENTS_PER_SLOT}
                    onUserCancelAppointment={handleUserCancelAppointment}
                  />
                </div>
              </div>
            )}
            </div>
          </div>

          <DataImportDialog
            open={showImportDialog}
            onOpenChange={setShowImportDialog}
            onImport={handleImportData}
          />
        </div>

        {activeTemplate && (
          <ReportTemplateViewer
            template={activeTemplate}
            appointments={visibleAppointments || []}
            locations={visibleLocations || []}
            onClose={() => setActiveTemplate(null)}
          />
        )}
      </SmoothScrollWrapper>
    </SmoothScrollContainer>
  )
}

export default App