import type {
  ReportExecutionLog,
  ReportFilter,
  ReportExecutionSource,
  ScheduledReportRecipient,
  ScheduledReportFormat
} from './types'
import { api } from './api'

interface LogReportExecutionParams {
  reportName: string
  reportType: 'scheduled' | 'template' | 'custom' | 'export'
  source?: ReportExecutionSource
  executedBy: string
  status: 'success' | 'failed' | 'partial' | 'cancelled'
  trigger: 'manual' | 'scheduled' | 'api' | 'template'
  filters?: ReportFilter[]
  totalRecords: number
  recordsProcessed: number
  format: ScheduledReportFormat
  executionDuration: number
  fileSize?: number
  filePath?: string
  deliveryMethod?: 'email' | 'download' | 'both'
  recipients?: ScheduledReportRecipient[]
  emailsSent?: number
  emailsFailed?: number
  error?: string
  errorDetails?: string
  warnings?: string[]
  parameters?: Record<string, any>
  metadata?: Record<string, any>
  reportId?: string
}

const getSourceFromReportType = (reportType: LogReportExecutionParams['reportType']): ReportExecutionSource => {
  switch (reportType) {
    case 'scheduled':
      return 'agendamento'
    case 'template':
      return 'template'
    case 'export':
      return 'importacao_exportacao'
    case 'custom':
    default:
      return 'analytics'
  }
}

export async function logReportExecution(params: LogReportExecutionParams): Promise<ReportExecutionLog> {
  const log: ReportExecutionLog = {
    id: crypto.randomUUID(),
    reportId: params.reportId,
    reportName: params.reportName,
    reportType: params.reportType,
    source: params.source || getSourceFromReportType(params.reportType),
    executedBy: params.executedBy,
    executedAt: new Date().toISOString(),
    executionDuration: params.executionDuration,
    status: params.status,
    trigger: params.trigger,
    filters: params.filters,
    totalRecords: params.totalRecords,
    recordsProcessed: params.recordsProcessed,
    format: params.format,
    fileSize: params.fileSize,
    filePath: params.filePath,
    deliveryMethod: params.deliveryMethod,
    recipients: params.recipients,
    emailsSent: params.emailsSent,
    emailsFailed: params.emailsFailed,
    error: params.error,
    errorDetails: params.errorDetails,
    warnings: params.warnings,
    parameters: params.parameters,
    metadata: params.metadata
  }

  const savedLog = await api.post<ReportExecutionLog>('/report-execution-logs', log)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('report-execution-logged', { detail: savedLog }))
  }

  return savedLog
}

export async function getReportExecutionLogs(): Promise<ReportExecutionLog[]> {
  return await api.get<ReportExecutionLog[]>('/report-execution-logs')
}

export async function clearOldLogs(daysToKeep: number = 90): Promise<void> {
  const logs = await getReportExecutionLogs()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.executedAt)
    return logDate >= cutoffDate
  })

  // Mantemos comportamento seguro sem deleção em lote no backend.
  // A limpeza definitiva pode ser adicionada com endpoint dedicado.
  void filteredLogs
}

export async function logReportExecutionSafe(params: LogReportExecutionParams): Promise<void> {
  try {
    await logReportExecution(params)
  } catch (error) {
    console.error('[report-logger] Falha ao registrar histórico:', error)
  }
}

export function calculateExecutionStats(logs: ReportExecutionLog[]) {
  const total = logs.length
  if (total === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      partial: 0,
      cancelled: 0,
      successRate: 0,
      avgDuration: 0,
      totalRecords: 0,
      totalFileSize: 0
    }
  }

  const success = logs.filter(l => l.status === 'success').length
  const failed = logs.filter(l => l.status === 'failed').length
  const partial = logs.filter(l => l.status === 'partial').length
  const cancelled = logs.filter(l => l.status === 'cancelled').length
  
  const avgDuration = logs.reduce((sum, log) => sum + log.executionDuration, 0) / total
  const totalRecords = logs.reduce((sum, log) => sum + log.totalRecords, 0)
  const totalFileSize = logs.reduce((sum, log) => sum + (log.fileSize || 0), 0)

  return {
    total,
    success,
    failed,
    partial,
    cancelled,
    successRate: (success / total) * 100,
    avgDuration,
    totalRecords,
    totalFileSize
  }
}
