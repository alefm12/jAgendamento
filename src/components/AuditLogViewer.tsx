import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as DateRangeCalendar } from '@/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  MagnifyingGlass, 
  FunnelSimple, 
  ClipboardText, 
  Warning, 
  Info, 
  ShieldWarning,
  Fire,
  Download,
  Trash,
  Eye,
  Calendar,
  User,
  Target,
  CaretDown,
  CaretUp,
  ChartBar
} from '@phosphor-icons/react'
import { addDays, differenceInCalendarDays, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import type { AuditLog, AuditActionType, AuditSeverity } from '@/lib/types'
import { getAuditLogSummary, getAuditLogs } from '@/lib/audit-logger'
import { api } from '@/lib/api'
import { toFirstAndSecondName } from '@/lib/name-utils'
import { AuditMetricsDashboard } from './AuditMetricsDashboard'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface AuditLogViewerProps {
  onRefresh?: () => void
}

const SEVERITY_COLORS: Record<AuditSeverity, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const SEVERITY_ICONS: Record<AuditSeverity, React.ReactNode> = {
  low: <Info size={18} weight="duotone" />,
  medium: <Warning size={18} weight="duotone" />,
  high: <ShieldWarning size={18} weight="duotone" />,
  critical: <Fire size={18} weight="duotone" />,
}

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alta',
  critical: 'Crítica',
}

const OPERATION_STATUS_LABELS: Record<string, string> = {
  success: 'Sucesso',
  failed: 'Falha',
  error: 'Erro',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  partial: 'Parcial'
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  secretary: 'Secretaria',
  user: 'Usuário',
  system: 'Sistema'
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  appointment: 'Agendamento',
  blocked_date: 'Data Bloqueada',
  config: 'Configuração',
  data: 'Dados',
  user: 'Usuário',
  location: 'Localidade',
  report: 'Relatório',
  rg: 'CIN',
  system: 'Sistema'
}

const getTargetTypeLabel = (targetType?: string) => {
  if (!targetType) return 'Não informado'
  return TARGET_TYPE_LABELS[targetType] || targetType.replace(/_/g, ' ')
}

const normalizeModuleKey = (moduleName?: string, targetType?: string, action?: string) => {
  const value = String(moduleName || targetType || 'system').trim().toLowerCase().replace(/\s+/g, '_')
  const actionKey = String(action || '').trim().toLowerCase()
  if (['public', 'public_page', 'pagina_publica', 'página_pública'].includes(value)) return 'pagina_publica'
  if (['secretary', 'secretaria'].includes(value)) return 'secretaria'
  if (['config', 'system_config', 'settings', 'system_settings_changed'].includes(value)) return 'configuracoes'
  if (['system', 'sistema'].includes(value)) return 'configuracoes'
  if (['data', 'import', 'export', 'importacao_exportacao', 'import-export'].includes(value)) return 'importar_exportar'
  if (['appointment', 'appointments', 'agendamentos', 'atendimento'].includes(value)) return 'atendimento'
  if (['rg', 'rg_delivery', 'delivery', 'entrega_cin', 'cin', 'rg-report'].includes(value)) return 'entrega_cin'
  if (['analytics', 'relatorio', 'relatorios'].includes(value)) return 'analytics'
  if (['report', 'reports', 'report_template', 'template', 'templates', 'report_templates'].includes(value)) return 'templates'
  if (['scheduled_report', 'scheduled-reports', 'agendamento', 'agendado'].includes(value)) return 'agendamentos'
  if (['execution-history', 'history', 'historico'].includes(value)) return 'historico'
  if (['audit', 'audit_log', 'audit-logs'].includes(value)) return 'logs_auditoria'
  if (['location', 'locations', 'localidades', 'bairro', 'district'].includes(value)) return 'localidades'
  if (['blocked_date', 'blocked-dates', 'blocked_date_created', 'blocked_date_deleted'].includes(value)) return 'bloqueio_datas'
  if (['user', 'users', 'user_management'].includes(value)) return 'administracao'
  if (['notification-test', 'notification', 'notifications'].includes(value)) return 'testar_notificacoes'
  if (['reminder', 'reminder-history'].includes(value)) return 'historico_lembretes'
  if (actionKey.includes('template')) return 'templates'
  if (actionKey.includes('report') && actionKey.includes('scheduled')) return 'agendamentos'
  if (actionKey.includes('audit')) return 'logs_auditoria'
  if (actionKey.includes('appointment')) return 'atendimento'
  if (actionKey.includes('location') || actionKey.includes('bairro') || actionKey.includes('localidade')) return 'localidades'
  if (actionKey.includes('blocked_date')) return 'bloqueio_datas'
  if (actionKey.includes('user') || actionKey.includes('login') || actionKey.includes('logout')) return 'administracao'
  if (targetType === 'appointment') return 'atendimento'
  if (targetType === 'location') return 'localidades'
  if (targetType === 'blocked_date') return 'bloqueio_datas'
  if (targetType === 'user') return 'administracao'
  if (targetType === 'config' || targetType === 'system') return 'configuracoes'
  if (targetType === 'data') return 'importar_exportar'
  return value || 'sistema'
}

const MODULE_LABELS: Record<string, string> = {
  pagina_publica: 'Página Pública',
  secretaria: 'Secretaria',
  configuracoes: 'Configurações',
  importar_exportar: 'Importar/Exportar',
  atendimento: 'Atendimento',
  entrega_cin: 'Entrega CIN',
  analytics: 'Analytics',
  templates: 'Templates',
  agendamentos: 'Agendamentos',
  historico: 'Histórico',
  logs_auditoria: 'Logs de Auditoria',
  localidades: 'Localidades',
  bloqueio_datas: 'Bloqueio de Datas',
  administracao: 'Administração',
  testar_notificacoes: 'Testar Notificações',
  historico_lembretes: 'Histórico de Lembretes',
  sistema: 'Configurações'
}

const MODULE_FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'pagina_publica', label: 'Página Pública' },
  { key: 'secretaria', label: 'Secretaria' },
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'entrega_cin', label: 'Entrega CIN' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'importar_exportar', label: 'Importar/Exportar' },
  { key: 'templates', label: 'Templates' },
  { key: 'agendamentos', label: 'Agendamentos' },
  { key: 'historico', label: 'Histórico' },
  { key: 'logs_auditoria', label: 'Logs de Auditoria' },
  { key: 'historico_lembretes', label: 'Histórico de Lembretes' },
  { key: 'testar_notificacoes', label: 'Testar Notificações' },
  { key: 'localidades', label: 'Localidades' },
  { key: 'bloqueio_datas', label: 'Bloqueio de Datas' },
  { key: 'administracao', label: 'Administração' }
]

const getModuleLabel = (moduleName?: string, targetType?: string, action?: string) => {
  const key = normalizeModuleKey(moduleName, targetType, action)
  return MODULE_LABELS[key] || key.replace(/_/g, ' ')
}

const translateToPtBr = (input?: string) => {
  if (!input) return ''
  const replacements: Array<[RegExp, string]> = [
    [/\bwaiting-issuance\b/gi, 'aguardando confecção'],
    [/\bawaiting-issuance\b/gi, 'aguardando confecção'],
    [/\bcin-ready\b/gi, 'cin pronta'],
    [/\bcin-delivered\b/gi, 'cin entregue'],
    [/\bin-progress\b/gi, 'em atendimento'],
    [/\bcompleted\b/gi, 'concluído'],
    [/\bconfirmed\b/gi, 'confirmado'],
    [/\bcancelled\b/gi, 'cancelado'],
    [/\bcanceled\b/gi, 'cancelado'],
    [/\bno-show\b/gi, 'faltou'],
    [/\bpending\b/gi, 'pendente'],
    [/\bfields changed\b/gi, 'campos alterados'],
    [/\bstatus changed\b/gi, 'status alterado'],
    [/\bat tab\b/gi, 'na aba'],
    [/\bby\b/gi, 'por'],
    [/\buser\b/gi, 'usuário'],
    [/\bsuccess\b/gi, 'sucesso'],
    [/\bfailed\b/gi, 'falha'],
    [/\berror\b/gi, 'erro']
  ]

  return replacements.reduce((acc, [pattern, value]) => acc.replace(pattern, value), input)
}

const getOperationStatusLabel = (status?: string) => {
  const key = String(status || 'success').toLowerCase()
  return OPERATION_STATUS_LABELS[key] || translateToPtBr(status) || 'Sucesso'
}

const getRoleLabel = (role?: string) => {
  const key = String(role || 'system').toLowerCase()
  return ROLE_LABELS[key] || translateToPtBr(role) || 'Sistema'
}

const getDetailedNarrative = (log: AuditLog) => {
  const actionLabel = log.actionLabel || 'Ação registrada'
  const actor = toFirstAndSecondName(log.performedBy || 'Sistema')
  const when = formatDateTime(log.performedAt, "dd/MM/yyyy 'às' HH:mm:ss")
  const targetName = log.targetName || log.metadata?.protocol || log.targetId || 'item não identificado'
  const targetType = getTargetTypeLabel(log.targetType)
  const moduleName = getModuleLabel(log.metadata?.module, log.targetType, log.action)
  const ip = log.ipAddress || log.metadata?.ipAddress
  const location = formatLocation(log)

  const narrative = `${actionLabel}: ${targetType} "${targetName}" na aba ${moduleName}, por ${actor}, ${when}${ip ? ` (IP ${ip})` : ''}${location ? ` (${location})` : ''}.`
  if (log.description && log.description.trim().length > 0) {
    return `${narrative} ${translateToPtBr(log.description)}`
  }
  return narrative
}

const formatLocation = (log: AuditLog) => {
  const geo = (log.metadata?.geolocation && typeof log.metadata.geolocation === 'object')
    ? log.metadata.geolocation
    : {}
  const city = log.city || geo.city
  const region = log.region || geo.region
  const country = log.country || geo.country
  return [city, region, country].filter(Boolean).join(', ')
}

const formatChangeValue = (value: unknown) => {
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (error) {
      console.error('Erro ao formatar valor do log de auditoria:', error)
      return '[valor não serializável]'
    }
  }
  return String(value)
}

const normalizeChangeEntry = (change: unknown): { from?: unknown; to?: unknown } => {
  if (change && typeof change === 'object') {
    const hasFrom = 'from' in (change as Record<string, unknown>)
    const hasTo = 'to' in (change as Record<string, unknown>)
    if (hasFrom || hasTo) {
      const entry = change as { from?: unknown; to?: unknown }
      return { from: entry.from, to: entry.to }
    }
  }
  return { from: change, to: undefined }
}

const DEFAULT_SEVERITY: AuditSeverity = 'medium'

const isValidSeverity = (value: unknown): value is AuditSeverity =>
  value === 'low' || value === 'medium' || value === 'high' || value === 'critical'

const resolveSeverity = (value?: AuditSeverity | string | null): AuditSeverity => {
  const normalized = String(value || '').toLowerCase()
  if (isValidSeverity(normalized)) return normalized
  if (normalized === 'baixo' || normalized === 'baixa') return 'low'
  if (normalized === 'medio' || normalized === 'médio' || normalized === 'média') return 'medium'
  if (normalized === 'alta') return 'high'
  if (normalized === 'critica' || normalized === 'crítica') return 'critical'
  return DEFAULT_SEVERITY
}

const formatDateTime = (
  value?: string,
  pattern: string = "dd/MM/yyyy 'às' HH:mm:ss",
  fallback: string = 'Data não informada'
) => {
  if (!value) return fallback
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return format(date, pattern, { locale: ptBR })
  } catch (error) {
    console.error('Erro ao formatar data de log:', error)
    return value || fallback
  }
}

export function AuditLogViewer({ onRefresh }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState<AuditSeverity | 'all'>('all')
  const [selectedTargetType, setSelectedTargetType] = useState<string>('all')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'success' | 'failed' | 'error'>('all')
  const [ipFilter, setIpFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [quickRange, setQuickRange] = useState<'all' | 'today' | '7d' | 'custom'>('all')
  const [isClearingLogs, setIsClearingLogs] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const normalizedSelectedSeverity = resolveSeverity(selectedLog?.severity || null)
  const selectedSeverityColors = SEVERITY_COLORS[normalizedSelectedSeverity]
  const selectedSeverityIcon = SEVERITY_ICONS[normalizedSelectedSeverity]
  const selectedSeverityLabel = SEVERITY_LABELS[normalizedSelectedSeverity]

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    const handleAuditLogCreated = (event: Event) => {
      const customEvent = event as CustomEvent<AuditLog>
      const newLog = customEvent.detail
      if (!newLog?.id) return

      setLogs((current) => {
        if (current.some(log => log.id === newLog.id)) return current
        return [newLog, ...current]
      })

      const severity = resolveSeverity(newLog.severity)
      if (severity === 'critical') {
        toast.error(`Ação crítica: ${newLog.actionLabel || 'Registro crítico'}`, {
          description: `${toFirstAndSecondName(newLog.performedBy)} • ${formatDateTime(newLog.performedAt)}`
        })
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('audit-log-created', handleAuditLogCreated as EventListener)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('audit-log-created', handleAuditLogCreated as EventListener)
      }
    }
  }, [])

  const applyQuickRange = (range: 'all' | 'today' | '7d') => {
    setQuickRange(range)
    if (range === 'all') {
      setSelectedDateRange(undefined)
      setDateFrom('')
      setDateTo('')
      return
    }

    const end = format(new Date(), 'yyyy-MM-dd')
    if (range === 'today') {
      const todayDate = new Date()
      setSelectedDateRange({ from: todayDate, to: todayDate })
      setDateFrom(end)
      setDateTo(end)
      return
    }

    const startDate = subDays(new Date(), 6)
    const start = format(startDate, 'yyyy-MM-dd')
    setSelectedDateRange({ from: startDate, to: new Date() })
    setDateFrom(start)
    setDateTo(end)
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setSelectedDateRange(undefined)
      setDateFrom('')
      setDateTo('')
      setQuickRange('all')
      return
    }

    let nextRange: DateRange = range
    if (range.to) {
      const diffDays = differenceInCalendarDays(range.to, range.from)
      if (diffDays > 9) {
        const limitedTo = addDays(range.from, 9)
        nextRange = { from: range.from, to: limitedTo }
        toast.warning('O intervalo máximo permitido é de 10 dias.')
      }
    }

    setSelectedDateRange(nextRange)
    setQuickRange('custom')
    setDateFrom(format(nextRange.from, 'yyyy-MM-dd'))
    setDateTo(nextRange.to ? format(nextRange.to, 'yyyy-MM-dd') : '')
  }

  const handleClearAllLogs = async () => {
    try {
      setIsClearingLogs(true)
      await Promise.all([
        api.delete('/audit-logs'),
        api.delete('/report-execution-logs')
      ])
      try {
        localStorage.removeItem('audit-logs')
      } catch {}
      if (typeof window !== 'undefined' && (window as any).spark?.kv?.set) {
        await (window as any).spark.kv.set('audit-logs', [])
      }
      await loadLogs()
      onRefresh?.()
      setClearDialogOpen(false)
      toast.success('Todos os logs foram removidos com sucesso.')
    } catch (error) {
      console.error('Erro ao limpar logs:', error)
      toast.error('Não foi possível limpar os logs.')
    } finally {
      setIsClearingLogs(false)
    }
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      const auditLogs = await getAuditLogs()
      setLogs(auditLogs)
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    let filtered = [...logs]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(log =>
        log.description.toLowerCase().includes(term) ||
        toFirstAndSecondName(log.performedBy).toLowerCase().includes(term) ||
        log.performedBy.toLowerCase().includes(term) ||
        log.targetName?.toLowerCase().includes(term) ||
        log.actionLabel.toLowerCase().includes(term)
      )
    }

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(log => resolveSeverity(log.severity) === selectedSeverity)
    }

    if (selectedTargetType !== 'all') {
      filtered = filtered.filter(log => log.targetType === selectedTargetType)
    }

    if (selectedAction !== 'all') {
      filtered = filtered.filter(log => log.action === selectedAction)
    }

    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => toFirstAndSecondName(log.performedBy) === selectedUser)
    }

    if (selectedModule !== 'all') {
      filtered = filtered.filter(log => normalizeModuleKey(String(log.metadata?.module || ''), log.targetType, log.action) === selectedModule)
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(log => (log.status || 'success') === selectedStatus)
    }

    if (ipFilter !== 'all') {
      filtered = filtered.filter(log => String(log.ipAddress || '').trim() === ipFilter)
    }

    if (cityFilter !== 'all') {
      filtered = filtered.filter((log) => {
        const geo = (log.metadata?.geolocation && typeof log.metadata.geolocation === 'object')
          ? log.metadata.geolocation
          : {}
        const location = [log.city, geo.city, log.region, geo.region, log.country, geo.country].filter(Boolean).join(', ')
        return location === cityFilter
      })
    }

    if (dateFrom) {
      filtered = filtered.filter(log => log.performedAt >= dateFrom)
    }

    if (dateTo) {
      filtered = filtered.filter(log => log.performedAt <= dateTo + 'T23:59:59')
    }

    filtered.sort((a, b) => {
      const comparison = new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [logs, searchTerm, selectedSeverity, selectedTargetType, selectedAction, selectedUser, selectedModule, selectedStatus, ipFilter, cityFilter, dateFrom, dateTo, sortOrder])

  const summary = useMemo(() => getAuditLogSummary(filteredLogs), [filteredLogs])

  const uniqueUsers = useMemo(() => 
    Array.from(new Set(logs.map(log => toFirstAndSecondName(log.performedBy)))).sort(),
    [logs]
  )

  const uniqueActions = useMemo(() => 
    Array.from(new Set(logs.map(log => log.action))).sort(),
    [logs]
  )

  const actionLabelsByCode = useMemo(() => {
    const map: Record<string, string> = {}
    logs.forEach((log) => {
      if (!map[log.action]) {
        map[log.action] = log.actionLabel || log.action
      }
    })
    return map
  }, [logs])

  const uniqueTargetTypes = useMemo(() => 
    Array.from(new Set(logs.map(log => log.targetType))).sort(),
    [logs]
  )

  const uniqueIps = useMemo(() =>
    Array.from(new Set(logs.map(log => String(log.ipAddress || '').trim()).filter(Boolean))).sort(),
    [logs]
  )

  const uniqueCities = useMemo(() => {
    const items = logs.map((log) => {
      const geo = (log.metadata?.geolocation && typeof log.metadata.geolocation === 'object')
        ? log.metadata.geolocation
        : {}
      return [log.city, geo.city, log.region, geo.region, log.country, geo.country].filter(Boolean).join(', ')
    }).filter(Boolean)
    return Array.from(new Set(items)).sort()
  }, [logs])

  const availableLogDateKeys = useMemo(() => {
    const keys = new Set<string>()
    logs.forEach((log) => {
      if (!log.performedAt) return
      try {
        const parsed = new Date(log.performedAt)
        if (!Number.isNaN(parsed.getTime())) {
          keys.add(format(parsed, 'yyyy-MM-dd'))
        }
      } catch {
        // ignora datas inválidas
      }
    })
    return keys
  }, [logs])

  const handleClearFilters = () => {
    setQuickRange('all')
    setSearchTerm('')
    setSelectedSeverity('all')
    setSelectedTargetType('all')
    setSelectedAction('all')
    setSelectedUser('all')
    setSelectedModule('all')
    setSelectedStatus('all')
    setIpFilter('all')
    setCityFilter('all')
    setSelectedDateRange(undefined)
    setDateFrom('')
    setDateTo('')
  }

  const handleExportCSV = () => {
    const data = filteredLogs.map(log => ({
      'Data/Hora': formatDateTime(log.performedAt, 'dd/MM/yyyy HH:mm:ss'),
      'Ação': log.actionLabel,
      'Descrição': translateToPtBr(log.description),
      'Usuário': toFirstAndSecondName(log.performedBy),
      'Papel': log.performedByRole,
      'Tipo de Alvo': getTargetTypeLabel(log.targetType),
      'Alvo': log.targetName || log.targetId || '-',
      'Severidade': SEVERITY_LABELS[resolveSeverity(log.severity)],
      'Status': getOperationStatusLabel(log.status),
      'IP': log.ipAddress || '-',
      'Módulo': getModuleLabel(log.metadata?.module, log.targetType, log.action),
      'Localização': formatLocation(log) || '-',
      'Erro': log.errorMessage || '-',
    }))

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`
    link.click()
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(filteredLogs, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
    link.click()
  }

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4')
    const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")
    const criticalLogs = filteredLogs.filter(log => resolveSeverity(log.severity) === 'critical')

    doc.setFontSize(16)
    doc.text('Relatorio de Auditoria do Sistema', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em: ${generatedAt}`, 14, 20)
    doc.text(`Total: ${filteredLogs.length} | Criticos: ${criticalLogs.length}`, 14, 25)

    if (criticalLogs.length > 0) {
      doc.setFontSize(11)
      doc.text('Incidentes Criticos (ultimos 10)', 14, 32)
      criticalLogs.slice(0, 10).forEach((log, index) => {
        const line = `${index + 1}. ${log.actionLabel} | ${toFirstAndSecondName(log.performedBy)} | ${formatDateTime(log.performedAt, 'dd/MM HH:mm:ss')} | ${log.ipAddress || 'IP N/I'}`
        doc.setFontSize(9)
        doc.text(line, 14, 37 + (index * 4))
      })
    }

    autoTable(doc, {
      startY: criticalLogs.length > 0 ? Math.min(80, 40 + (criticalLogs.length * 4)) : 32,
      head: [[
        'Data/Hora',
        'Severidade',
        'Acao',
        'Usuario',
        'Tipo Alvo',
        'Alvo',
        'Modulo',
        'Status',
        'IP'
      ]],
      body: filteredLogs.map(log => ([
        formatDateTime(log.performedAt, 'dd/MM/yyyy HH:mm:ss'),
        SEVERITY_LABELS[resolveSeverity(log.severity)],
        log.actionLabel || log.action,
        toFirstAndSecondName(log.performedBy),
        getTargetTypeLabel(log.targetType),
        log.targetName || log.targetId || '-',
        getModuleLabel(log.metadata?.module, log.targetType, log.action),
        getOperationStatusLabel(log.status),
        log.ipAddress || '-'
      ])),
      styles: { fontSize: 8, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 15 },
        2: { cellWidth: 34 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18 },
        5: { cellWidth: 30 },
        6: { cellWidth: 22 },
        7: { cellWidth: 15 },
        8: { cellWidth: 20 }
      }
    })

    doc.save(`audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`)
  }

  const activeFiltersCount = [
    searchTerm,
    selectedSeverity !== 'all',
    selectedTargetType !== 'all',
    selectedAction !== 'all',
    selectedUser !== 'all',
    selectedModule !== 'all',
    selectedStatus !== 'all',
    ipFilter !== 'all',
    cityFilter !== 'all',
    quickRange !== 'all' && quickRange !== 'custom',
    dateFrom,
    dateTo
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs" className="gap-2">
            <ClipboardText size={18} weight="duotone" />
            Lista de Logs
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <ChartBar size={18} weight="duotone" />
            Dashboard de Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <ClipboardText size={28} weight="duotone" className="text-primary" />
                    Logs de Auditoria
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Histórico completo de todas as ações realizadas no sistema
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { loadLogs(); onRefresh?.() }}>
                    Atualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download size={16} />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportJSON}>
                    <Download size={16} />
                    JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download size={16} />
                    PDF
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setClearDialogOpen(true)} className="gap-2">
                    <Trash size={16} />
                    Limpar Logs
                  </Button>
                </div>
              </div>
            </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Logs</p>
                    <p className="text-3xl font-bold text-blue-700">{summary.total}</p>
                  </div>
                  <ClipboardText size={32} weight="duotone" className="text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Severidade Média</p>
                    <p className="text-3xl font-bold text-yellow-700">{summary.bySeverity.medium}</p>
                  </div>
                  <Warning size={32} weight="duotone" className="text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Severidade Alta</p>
                    <p className="text-3xl font-bold text-orange-700">{summary.bySeverity.high}</p>
                  </div>
                  <ShieldWarning size={32} weight="duotone" className="text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Críticos</p>
                    <p className="text-3xl font-bold text-red-700">{summary.bySeverity.critical}</p>
                  </div>
                  <Fire size={32} weight="duotone" className="text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, usuário, alvo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <FunnelSimple size={18} />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="gap-2"
              >
                {sortOrder === 'asc' ? <CaretUp size={18} /> : <CaretDown size={18} />}
                {sortOrder === 'asc' ? 'Mais Antigos' : 'Mais Recentes'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={quickRange === 'today' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickRange('today')}>Hoje</Button>
              <Button variant={quickRange === '7d' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickRange('7d')}>7 dias</Button>
              <Button variant={quickRange === 'all' ? 'default' : 'outline'} size="sm" onClick={() => applyQuickRange('all')}>Todos</Button>
            </div>

            {showFilters && (
              <Card className="border-2 border-dashed">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Severidade</label>
                      <Select value={selectedSeverity} onValueChange={(v) => setSelectedSeverity(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="low">Baixo</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Tipo de Alvo</label>
                      <Select value={selectedTargetType} onValueChange={setSelectedTargetType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueTargetTypes.map(type => (
                            <SelectItem key={type} value={type}>{getTargetTypeLabel(type)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Usuário</label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueUsers.map(user => (
                            <SelectItem key={user} value={user}>{user}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Ação</label>
                      <Select value={selectedAction} onValueChange={setSelectedAction}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {uniqueActions.map(action => (
                            <SelectItem key={action} value={action}>
                              {actionLabelsByCode[action] || action}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Módulo/Aba</label>
                      <Select value={selectedModule} onValueChange={setSelectedModule}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {MODULE_FILTER_OPTIONS.map((moduleOption) => (
                            <SelectItem key={moduleOption.key} value={moduleOption.key}>{moduleOption.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Status da Operação</label>
                      <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="success">Sucesso</SelectItem>
                          <SelectItem value="failed">Falhou</SelectItem>
                          <SelectItem value="error">Erro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">IP</label>
                      <Select value={ipFilter} onValueChange={setIpFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueIps.map(ip => (
                            <SelectItem key={ip} value={ip}>{ip}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Cidade/Região</label>
                      <Select value={cityFilter} onValueChange={setCityFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueCities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-sm font-medium mb-2 block">Intervalo de Datas (máx. 10 dias)</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <Calendar size={16} className="mr-2" />
                            {selectedDateRange?.from
                              ? selectedDateRange.to
                                ? `${format(selectedDateRange.from, 'dd/MM/yyyy')} até ${format(selectedDateRange.to, 'dd/MM/yyyy')}`
                                : format(selectedDateRange.from, 'dd/MM/yyyy')
                              : 'Selecione o intervalo'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <DateRangeCalendar
                            mode="range"
                            selected={selectedDateRange}
                            onSelect={handleDateRangeSelect}
                            numberOfMonths={1}
                            locale={ptBR}
                            defaultMonth={selectedDateRange?.from || new Date()}
                            disabled={(date) => !availableLogDateKeys.has(format(date, 'yyyy-MM-dd'))}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={handleClearFilters}>
                      Limpar Filtros
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="border rounded-lg">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-muted-foreground">Carregando logs...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <ClipboardText size={48} className="text-muted-foreground" weight="duotone" />
                  <p className="text-muted-foreground">Nenhum log encontrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredLogs.map((log) => {
                    const severity = resolveSeverity(log.severity)
                    const colors = SEVERITY_COLORS[severity]
                    const severityIcon = SEVERITY_ICONS[severity]
                    const severityLabel = SEVERITY_LABELS[severity]
                    return (
                      <div
                        key={log.id}
                        className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors border-l-4 ${colors.border}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${colors.bg}`}>
                              {severityIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-sm">{log.actionLabel}</h4>
                                <Badge variant="outline" className={`${colors.bg} ${colors.text} border-0`}>
                                  {severityLabel}
                                </Badge>
                                {(log.status === 'failed' || log.status === 'error') && (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    {log.status === 'failed' ? 'Falhou' : 'Erro'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{getDetailedNarrative(log)}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User size={14} />
                                  {toFirstAndSecondName(log.performedBy)}
                                </span>
                                {log.targetName && (
                                  <span className="flex items-center gap-1">
                                    <Target size={14} />
                                    {log.targetName}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  {formatDateTime(log.performedAt)}
                                </span>
                                {log.metadata?.module && (
                                  <span className="flex items-center gap-1">
                                    <ChartBar size={14} />
                                    {getModuleLabel(String(log.metadata.module), log.targetType, log.action)}
                                  </span>
                                )}
                                {log.ipAddress && (
                                  <span className="flex items-center gap-1">
                                    IP {log.ipAddress}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye size={18} />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            Mostrando {filteredLogs.length} de {logs.length} log(s)
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedSeverityIcon}
                  Detalhes do Log
                </DialogTitle>
                <DialogDescription>
                  Informações completas sobre a ação registrada
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Ação</label>
                    <p className="text-sm font-semibold mt-1">{selectedLog.actionLabel}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Severidade</label>
                    <Badge className={`mt-1 ${selectedSeverityColors.bg} ${selectedSeverityColors.text} border-0`}>
                      {selectedSeverityLabel}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Realizado por</label>
                    <p className="text-sm mt-1">{toFirstAndSecondName(selectedLog.performedBy)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Papel</label>
                    <p className="text-sm mt-1">{getRoleLabel(selectedLog.performedByRole)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                    <p className="text-sm mt-1">{formatDateTime(selectedLog.performedAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo de Alvo</label>
                    <p className="text-sm mt-1">{getTargetTypeLabel(selectedLog.targetType)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Módulo/Aba</label>
                    <p className="text-sm mt-1">{getModuleLabel(String(selectedLog.metadata?.module || ''), selectedLog.targetType, selectedLog.action)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status da Operação</label>
                    <p className="text-sm mt-1">{getOperationStatusLabel(selectedLog.status)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">IP</label>
                    <p className="text-sm mt-1">{selectedLog.ipAddress || selectedLog.metadata?.ipAddress || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Localização</label>
                    <p className="text-sm mt-1">{formatLocation(selectedLog) || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Navegador/Dispositivo</label>
                    <p className="text-sm mt-1 break-all">{selectedLog.userAgent || selectedLog.metadata?.userAgent || 'Não informado'}</p>
                  </div>
                </div>

                {selectedLog.errorMessage && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Erro</label>
                    <p className="text-sm mt-1 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg">
                      {selectedLog.errorMessage}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{getDetailedNarrative(selectedLog)}</p>
                </div>

                {selectedLog.targetName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nome do Alvo</label>
                    <p className="text-sm mt-1">{selectedLog.targetName}</p>
                  </div>
                )}

                {selectedLog.targetId && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ID do Alvo</label>
                    <p className="text-sm mt-1 font-mono text-xs">{selectedLog.targetId}</p>
                  </div>
                )}

                {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Alterações</label>
                    <div className="space-y-2">
                      {Object.entries(selectedLog.changes).map(([field, change]) => {
                        const normalized = normalizeChangeEntry(change)
                        return (
                          <div key={field} className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1 capitalize">{field}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-red-600">De: {formatChangeValue(normalized.from)}</span>
                              <span>→</span>
                              <span className="text-green-600">Para: {formatChangeValue(normalized.to)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Metadados</label>
                    <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.tags && selectedLog.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Tags</label>
                    <div className="flex gap-2 flex-wrap">
                      {selectedLog.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os logs?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente todos os logs de auditoria e histórico de execução de relatórios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingLogs}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllLogs} disabled={isClearingLogs}>
              {isClearingLogs ? 'Limpando...' : 'Confirmar limpeza'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <AuditMetricsDashboard logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
