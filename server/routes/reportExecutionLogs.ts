import { randomUUID } from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../config/db'

const router = Router()
const LOG_RETENTION_DAYS = 7
let lastRetentionCleanupAt = 0

const executionLogSchema = z.object({
  id: z.string().uuid().optional(),
  reportId: z.string().optional(),
  reportName: z.string().trim().min(1, 'Nome do relatório é obrigatório'),
  reportType: z.enum(['scheduled', 'template', 'custom', 'export']).default('custom'),
  source: z.enum(['agendamento', 'template', 'analytics', 'importacao_exportacao', 'sistema']).optional(),
  executedBy: z.string().trim().min(1).default('Sistema'),
  executedAt: z.string().optional(),
  executionDuration: z.number().int().nonnegative().default(0),
  status: z.enum(['success', 'failed', 'partial', 'cancelled']).default('success'),
  trigger: z.enum(['manual', 'scheduled', 'api', 'template']).default('manual'),
  filters: z.array(z.any()).optional(),
  totalRecords: z.number().int().nonnegative().default(0),
  recordsProcessed: z.number().int().nonnegative().default(0),
  format: z.string().default('pdf'),
  fileSize: z.number().int().nonnegative().optional(),
  filePath: z.string().optional(),
  deliveryMethod: z.string().optional(),
  recipients: z.array(z.any()).optional(),
  emailsSent: z.number().int().nonnegative().optional(),
  emailsFailed: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  errorDetails: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  parameters: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
}).passthrough()

let schemaEnsured = false
const ensureExecutionLogsSchema = async () => {
  if (schemaEnsured) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_execution_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
      template_name VARCHAR(255),
      status VARCHAR(50),
      records_count INT,
      error_message TEXT,
      file_path TEXT,
      executed_at TIMESTAMPTZ DEFAULT NOW(),
      executed_by VARCHAR(255)
    )
  `)

  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS report_id VARCHAR(255)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS report_name VARCHAR(255)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS report_type VARCHAR(50)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS source_system VARCHAR(50)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS execution_duration INT DEFAULT 0`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '[]'::jsonb`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS total_records INT DEFAULT 0`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS records_processed INT DEFAULT 0`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS output_format VARCHAR(20)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS file_size BIGINT`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT '[]'::jsonb`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS emails_sent INT`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS emails_failed INT`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS error_details TEXT`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]'::jsonb`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}'::jsonb`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb`)
  await pool.query(`ALTER TABLE report_execution_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`)

  schemaEnsured = true
}

const cleanupOldExecutionLogsIfNeeded = async () => {
  const now = Date.now()
  // Evita limpeza a cada request (janela de 1 hora)
  if (now - lastRetentionCleanupAt < 60 * 60 * 1000) return
  lastRetentionCleanupAt = now

  try {
    await pool.query(
      `DELETE FROM report_execution_logs
        WHERE COALESCE(executed_at, created_at) < (NOW() - ($1::text || ' days')::interval)`,
      [String(LOG_RETENTION_DAYS)]
    )
  } catch (error) {
    console.error('[report-execution-logs] Erro na retenção automática:', error)
  }
}

const toIsoOrNow = (value?: string) => {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

const mapExecutionLog = (row: any) => {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const reportType = payload.reportType || row.report_type || 'custom'
  const source =
    payload.source ||
    row.source_system ||
    (reportType === 'scheduled'
      ? 'agendamento'
      : reportType === 'template'
        ? 'template'
        : reportType === 'export'
          ? 'importacao_exportacao'
          : 'analytics')

  return {
    ...payload,
    id: row.id,
    reportId: payload.reportId || row.report_id || undefined,
    reportName: payload.reportName || row.report_name || row.template_name || 'Relatório',
    reportType,
    source,
    executedBy: payload.executedBy || row.executed_by || 'Sistema',
    executedAt: payload.executedAt || (row.executed_at ? new Date(row.executed_at).toISOString() : new Date().toISOString()),
    executionDuration: payload.executionDuration ?? row.execution_duration ?? 0,
    status: payload.status || row.status || 'success',
    trigger: payload.trigger || row.trigger_type || 'manual',
    filters: Array.isArray(payload.filters) ? payload.filters : (row.filters || []),
    totalRecords: payload.totalRecords ?? row.total_records ?? row.records_count ?? 0,
    recordsProcessed: payload.recordsProcessed ?? row.records_processed ?? row.records_count ?? 0,
    format: payload.format || row.output_format || 'pdf',
    fileSize: payload.fileSize ?? row.file_size ?? undefined,
    filePath: payload.filePath || row.file_path || undefined,
    deliveryMethod: payload.deliveryMethod || row.delivery_method || undefined,
    recipients: Array.isArray(payload.recipients) ? payload.recipients : (row.recipients || []),
    emailsSent: payload.emailsSent ?? row.emails_sent ?? undefined,
    emailsFailed: payload.emailsFailed ?? row.emails_failed ?? undefined,
    error: payload.error || row.error_message || undefined,
    errorDetails: payload.errorDetails || row.error_details || undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : (row.warnings || []),
    parameters: payload.parameters || row.parameters || undefined,
    metadata: payload.metadata || row.metadata || undefined,
    userAgent: payload.userAgent || row.user_agent || undefined,
    ipAddress: payload.ipAddress || row.ip_address || undefined
  }
}

router.get('/report-execution-logs', async (_req, res) => {
  try {
    await ensureExecutionLogsSchema()
    await cleanupOldExecutionLogsIfNeeded()
    const result = await pool.query(`
      SELECT *
      FROM report_execution_logs
      ORDER BY executed_at DESC, created_at DESC
      LIMIT 1000
    `)
    return res.json(result.rows.map(mapExecutionLog))
  } catch (error) {
    console.error('[report-execution-logs] Erro ao listar:', error)
    return res.status(500).json({ message: 'Erro ao carregar histórico de execuções' })
  }
})

router.delete('/report-execution-logs', async (_req, res) => {
  try {
    await ensureExecutionLogsSchema()
    await cleanupOldExecutionLogsIfNeeded()
    const result = await pool.query('DELETE FROM report_execution_logs')
    return res.json({
      success: true,
      deletedCount: result.rowCount || 0,
      message: 'Todos os logs de execução de relatórios foram removidos'
    })
  } catch (error) {
    console.error('[report-execution-logs] Erro ao limpar:', error)
    return res.status(500).json({ message: 'Erro ao limpar histórico de execuções' })
  }
})

router.post('/report-execution-logs', async (req, res) => {
  try {
    await ensureExecutionLogsSchema()
    await cleanupOldExecutionLogsIfNeeded()
    const payload = executionLogSchema.parse(req.body || {})
    const id = payload.id || randomUUID()

    const result = await pool.query(
      `INSERT INTO report_execution_logs (
        id, scheduled_report_id, template_name, status, records_count, error_message, file_path, executed_at, executed_by,
        report_id, report_name, report_type, source_system, execution_duration, trigger_type, filters,
        total_records, records_processed, output_format, file_size, delivery_method, recipients,
        emails_sent, emails_failed, error_details, warnings, parameters, metadata, user_agent, ip_address, payload, created_at
      ) VALUES (
        $1, NULL, $2, $3, $4, $5, $6, $7::timestamptz, $8,
        $9, $10, $11, $12, $13, $14, $15::jsonb,
        $16, $17, $18, $19, $20, $21::jsonb,
        $22, $23, $24, $25::jsonb, $26::jsonb, $27::jsonb, $28, $29, $30::jsonb, NOW()
      )
      RETURNING *`,
      [
        id,
        payload.reportName,
        payload.status,
        payload.totalRecords,
        payload.error || null,
        payload.filePath || null,
        toIsoOrNow(payload.executedAt),
        payload.executedBy,
        payload.reportId || null,
        payload.reportName,
        payload.reportType,
        payload.source || null,
        payload.executionDuration,
        payload.trigger,
        JSON.stringify(payload.filters || []),
        payload.totalRecords,
        payload.recordsProcessed,
        payload.format,
        payload.fileSize ?? null,
        payload.deliveryMethod || null,
        JSON.stringify(payload.recipients || []),
        payload.emailsSent ?? null,
        payload.emailsFailed ?? null,
        payload.errorDetails || null,
        JSON.stringify(payload.warnings || []),
        JSON.stringify(payload.parameters || {}),
        JSON.stringify(payload.metadata || {}),
        payload.userAgent || null,
        payload.ipAddress || null,
        JSON.stringify(payload)
      ]
    )

    return res.status(201).json(mapExecutionLog(result.rows[0]))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Dados inválidos' })
    }
    console.error('[report-execution-logs] Erro ao registrar:', error)
    return res.status(500).json({ message: 'Erro ao registrar execução de relatório' })
  }
})

export default router
