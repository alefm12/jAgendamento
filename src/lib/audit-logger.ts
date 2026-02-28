import type { AuditLog, AuditActionType, AuditSeverity } from './types'
import { api } from './api'
let auditNormalizationAttempted = false

const ACTION_LABELS: Record<AuditActionType, string> = {
  appointment_created: 'Agendamento Criado',
  appointment_updated: 'Agendamento Atualizado',
  appointment_deleted: 'Agendamento Excluído',
  appointment_status_changed: 'Status do Agendamento Alterado',
  appointment_rescheduled: 'Agendamento Reagendado',
  appointment_cancelled: 'Agendamento Cancelado',
  appointment_note_added: 'Nota Adicionada ao Agendamento',
  appointment_note_deleted: 'Nota Removida do Agendamento',
  appointment_priority_changed: 'Prioridade do Agendamento Alterada',
  appointment_bulk_deleted: 'Exclusão em Massa de Agendamentos',
  location_created: 'Localidade Criada',
  location_updated: 'Localidade Atualizada',
  location_deleted: 'Localidade Excluída',
  user_created: 'Usuário Criado',
  user_updated: 'Usuário Atualizado',
  user_deleted: 'Usuário Excluído',
  user_login: 'Login Realizado',
  user_logout: 'Logout Realizado',
  blocked_date_created: 'Data Bloqueada',
  blocked_date_deleted: 'Bloqueio de Data Removido',
  config_updated: 'Configuração Atualizada',
  data_exported: 'Dados Exportados',
  data_imported: 'Dados Importados',
  report_generated: 'Relatório Gerado',
  report_template_created: 'Template de Relatório Criado',
  report_template_updated: 'Template de Relatório Atualizado',
  report_template_deleted: 'Template de Relatório Excluído',
  scheduled_report_created: 'Relatório Agendado Criado',
  scheduled_report_updated: 'Relatório Agendado Atualizado',
  scheduled_report_deleted: 'Relatório Agendado Excluído',
  rg_marked_as_delivered: 'CIN Marcado como Entregue',
  rg_notification_sent: 'Notificação de CIN Enviada',
  reminder_sent: 'Lembrete Enviado',
  system_settings_changed: 'Configurações do Sistema Alteradas',
}

const ACTION_SEVERITIES: Record<AuditActionType, AuditSeverity> = {
  appointment_created: 'low',
  appointment_updated: 'low',
  appointment_deleted: 'high',
  appointment_status_changed: 'medium',
  appointment_rescheduled: 'medium',
  appointment_cancelled: 'medium',
  appointment_note_added: 'low',
  appointment_note_deleted: 'medium',
  appointment_priority_changed: 'low',
  appointment_bulk_deleted: 'critical',
  location_created: 'medium',
  location_updated: 'medium',
  location_deleted: 'high',
  user_created: 'medium',
  user_updated: 'medium',
  user_deleted: 'high',
  user_login: 'low',
  user_logout: 'low',
  blocked_date_created: 'medium',
  blocked_date_deleted: 'medium',
  config_updated: 'high',
  data_exported: 'medium',
  data_imported: 'high',
  report_generated: 'low',
  report_template_created: 'low',
  report_template_updated: 'low',
  report_template_deleted: 'medium',
  scheduled_report_created: 'low',
  scheduled_report_updated: 'low',
  scheduled_report_deleted: 'medium',
  rg_marked_as_delivered: 'medium',
  rg_notification_sent: 'low',
  reminder_sent: 'medium',
  system_settings_changed: 'critical',
}

export interface CreateAuditLogParams {
  action: AuditActionType
  description: string
  performedBy: string
  performedByRole?: 'user' | 'secretary' | 'admin' | 'system'
  targetType: 'appointment' | 'location' | 'user' | 'blocked_date' | 'config' | 'report' | 'system' | 'data'
  targetId?: string
  targetName?: string
  oldValue?: any
  newValue?: any
  changes?: Record<string, { from: any; to: any }>
  metadata?: Record<string, any>
  tags?: string[]
  isReversible?: boolean
  status?: 'success' | 'failed' | 'error'
  errorMessage?: string
}

const inferModuleLabel = (targetType: CreateAuditLogParams['targetType']) => {
  const map: Record<CreateAuditLogParams['targetType'], string> = {
    appointment: 'Agendamentos',
    location: 'Localidades',
    user: 'Usuários',
    blocked_date: 'Bloqueio de Datas',
    config: 'Configurações',
    report: 'Relatórios',
    system: 'Sistema',
    data: 'Importação/Exportação'
  }
  return map[targetType] || 'Sistema'
}

const buildProfessionalDescription = (params: CreateAuditLogParams) => {
  const base = params.description?.trim() || ACTION_LABELS[params.action]
  const protocol = params.metadata?.protocol
  const citizenName = params.metadata?.citizenName || params.metadata?.name
  const locationName = params.metadata?.locationName || params.targetName
  const deletedCount = params.metadata?.deletedCount
  const exportedCount = params.metadata?.exportCount
  const importCount = params.metadata?.importCount
  const sampleProtocols = Array.isArray(params.metadata?.appointments)
    ? params.metadata.appointments.map((apt: any) => apt.protocol).filter(Boolean).slice(0, 3)
    : []
  const changedFields = params.changes ? Object.keys(params.changes) : []
  const moduleLabel = params.metadata?.module || inferModuleLabel(params.targetType)
  const details: string[] = []

  if (protocol) details.push(`protocolo "${protocol}"`)
  if (citizenName) details.push(`cidadão "${citizenName}"`)
  if (locationName && params.targetType === 'location') details.push(`local "${locationName}"`)
  if (deletedCount) details.push(`${deletedCount} registro(s) excluído(s)`)
  if (exportedCount) details.push(`${exportedCount} registro(s) exportado(s)`)
  if (importCount) details.push(`${importCount} registro(s) importado(s)`)
  if (sampleProtocols.length > 0) details.push(`protocolos: ${sampleProtocols.join(', ')}`)
  if (changedFields.length > 0) details.push(`campos alterados: ${changedFields.join(', ')}`)

  const detailSuffix = details.length > 0 ? ` (${details.join(' | ')})` : ''
  return `${base}${detailSuffix} na aba ${moduleLabel}`
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<AuditLog> {
  const log: AuditLog = {
    id: crypto.randomUUID(),
    action: params.action,
    actionLabel: ACTION_LABELS[params.action],
    description: buildProfessionalDescription(params),
    performedBy: params.performedBy,
    performedByRole: params.performedByRole || 'secretary',
    performedAt: new Date().toISOString(),
    targetType: params.targetType,
    targetId: params.targetId,
    targetName: params.targetName,
    severity: ACTION_SEVERITIES[params.action],
    oldValue: params.oldValue,
    newValue: params.newValue,
    changes: params.changes,
    metadata: params.metadata,
    tags: params.tags,
    isReversible: params.isReversible || false,
    status: params.status || 'success',
    errorMessage: params.errorMessage,
  }

  let savedLog = log
  try {
    savedLog = await api.post<AuditLog>('/audit-logs', log)
  } catch (error) {
    console.error('[audit-logger] Falha ao salvar na API, usando fallback local:', error)
    if (typeof window !== 'undefined' && (window as any).spark?.kv?.get && (window as any).spark?.kv?.set) {
      const existingLogs = await (window as any).spark.kv.get<AuditLog[]>('audit-logs') || []
      await (window as any).spark.kv.set('audit-logs', [...existingLogs, log])
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audit-log-created', { detail: savedLog }))
  }

  return savedLog
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    if (!auditNormalizationAttempted) {
      auditNormalizationAttempted = true
      try {
        await api.post('/audit-logs/normalize')
      } catch {
        // Não bloqueia carregamento caso normalização falhe
      }
    }

    const apiLogs = await api.get<AuditLog[]>('/audit-logs')
    // Limpa cache legado local para evitar reaparecimento de logs antigos.
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('audit-logs')
      } catch {}
      if ((window as any).spark?.kv?.set) {
        await (window as any).spark.kv.set('audit-logs', [])
      }
    }
    return apiLogs
  } catch (error) {
    console.error('[audit-logger] Falha ao carregar da API, usando fallback local:', error)
    if (typeof window !== 'undefined' && (window as any).spark?.kv?.get) {
      return await (window as any).spark.kv.get<AuditLog[]>('audit-logs') || []
    }
    return []
  }
}

export async function filterAuditLogs(filters: {
  action?: AuditActionType[]
  performedBy?: string
  targetType?: string
  severity?: AuditSeverity[]
  dateFrom?: string
  dateTo?: string
  searchTerm?: string
}): Promise<AuditLog[]> {
  const logs = await getAuditLogs()
  const normalizeSeverity = (value?: string) => {
    const normalized = String(value || '').toLowerCase()
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') return normalized
    if (normalized === 'baixo' || normalized === 'baixa') return 'low'
    if (normalized === 'medio' || normalized === 'médio' || normalized === 'média') return 'medium'
    if (normalized === 'alta') return 'high'
    if (normalized === 'critica' || normalized === 'crítica') return 'critical'
    return 'medium'
  }
  
  return logs.filter(log => {
    if (filters.action && !filters.action.includes(log.action)) return false
    if (filters.performedBy && log.performedBy !== filters.performedBy) return false
    if (filters.targetType && log.targetType !== filters.targetType) return false
    if (filters.severity && !filters.severity.includes(normalizeSeverity(log.severity) as AuditSeverity)) return false
    if (filters.dateFrom && log.performedAt < filters.dateFrom) return false
    if (filters.dateTo && log.performedAt > filters.dateTo) return false
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      return (
        log.description.toLowerCase().includes(term) ||
        log.performedBy.toLowerCase().includes(term) ||
        log.targetName?.toLowerCase().includes(term)
      )
    }
    return true
  })
}

export async function clearOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  const logs = await getAuditLogs()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  const filteredLogs = logs.filter(log => new Date(log.performedAt) >= cutoffDate)
  const deletedCount = logs.length - filteredLogs.length

  // Limpeza definitiva no backend pode ser adicionada com endpoint dedicado.
  void filteredLogs

  return deletedCount
}

export function getAuditLogSummary(logs: AuditLog[]) {
  const summary = {
    total: logs.length,
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    byAction: {} as Record<string, number>,
    byUser: {} as Record<string, number>,
    byTargetType: {} as Record<string, number>,
  }

  logs.forEach(log => {
    const normalizedSeverity = (String(log.severity || '')).toLowerCase() as AuditSeverity
    if (normalizedSeverity in summary.bySeverity) {
      summary.bySeverity[normalizedSeverity]++
    } else {
      summary.bySeverity.medium++
    }
    summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1
    summary.byUser[log.performedBy] = (summary.byUser[log.performedBy] || 0) + 1
    summary.byTargetType[log.targetType] = (summary.byTargetType[log.targetType] || 0) + 1
  })

  return summary
}
