import { randomUUID } from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../config/db'
import { buildTemplateExportFromPayload } from '../services/templateExportService'
import { runScheduledReportsNow } from '../services/scheduledReportRunner'

const router = Router()

const createScheduledReportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Nome do agendamento é obrigatório'),
  frequency: z.string().optional(),
  recipients: z.array(z.any()).optional(),
  format: z.string().optional(),
  isActive: z.boolean().optional(),
  lastExecuted: z.string().optional(),
  nextExecution: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional()
}).passthrough()

const updateScheduledReportSchema = z.object({
  name: z.string().trim().min(1).optional(),
  frequency: z.string().optional(),
  recipients: z.array(z.any()).optional(),
  format: z.string().optional(),
  isActive: z.boolean().optional(),
  lastExecuted: z.string().optional(),
  nextExecution: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional()
}).passthrough()

let schemaEnsured = false
const ensureScheduledReportsSchema = async () => {
  if (schemaEnsured) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID,
      name VARCHAR(255) NOT NULL,
      frequency VARCHAR(50),
      recipients JSONB,
      format VARCHAR(20) DEFAULT 'pdf',
      is_active BOOLEAN DEFAULT TRUE,
      last_execution TIMESTAMPTZ,
      next_execution TIMESTAMPTZ,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb`)
  await pool.query(`ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)
  await pool.query(`ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`)

  schemaEnsured = true
}

const toNullableTimestamp = (value?: string) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const mapScheduledReport = (row: any) => {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  return {
    ...payload,
    id: row.id,
    name: payload.name || row.name || 'Relatório agendado',
    frequency: payload.frequency || row.frequency || 'weekly',
    recipients: Array.isArray(payload.recipients) ? payload.recipients : (row.recipients || []),
    format: payload.format || row.format || 'pdf',
    isActive: payload.isActive ?? row.is_active ?? true,
    lastExecuted: payload.lastExecuted || (row.last_execution ? new Date(row.last_execution).toISOString() : undefined),
    nextExecution: payload.nextExecution || (row.next_execution ? new Date(row.next_execution).toISOString() : undefined),
    createdBy: payload.createdBy || row.created_by || 'Sistema',
    createdAt: payload.createdAt || (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString())
  }
}

router.get('/scheduled-reports', async (_req, res) => {
  try {
    await ensureScheduledReportsSchema()
    const result = await pool.query('SELECT * FROM scheduled_reports ORDER BY created_at DESC')
    return res.json(result.rows.map(mapScheduledReport))
  } catch (error) {
    console.error('[scheduled-reports] Erro ao listar:', error)
    return res.status(500).json({ message: 'Erro ao listar agendamentos de relatórios' })
  }
})

router.post('/scheduled-reports', async (req, res) => {
  try {
    await ensureScheduledReportsSchema()
    const payload = createScheduledReportSchema.parse(req.body || {})
    const id = payload.id || randomUUID()

    const result = await pool.query(
      `INSERT INTO scheduled_reports (
        id, name, frequency, recipients, format, is_active,
        last_execution, next_execution, created_by, created_at, updated_at, payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, COALESCE($10::timestamptz, NOW()), NOW(), $11
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        frequency = EXCLUDED.frequency,
        recipients = EXCLUDED.recipients,
        format = EXCLUDED.format,
        is_active = EXCLUDED.is_active,
        last_execution = EXCLUDED.last_execution,
        next_execution = EXCLUDED.next_execution,
        created_by = EXCLUDED.created_by,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        payload.name,
        payload.frequency || null,
        JSON.stringify(payload.recipients || []),
        payload.format || 'pdf',
        payload.isActive ?? true,
        toNullableTimestamp(payload.lastExecuted),
        toNullableTimestamp(payload.nextExecution),
        payload.createdBy || null,
        toNullableTimestamp(payload.createdAt),
        JSON.stringify(payload)
      ]
    )

    return res.status(201).json(mapScheduledReport(result.rows[0]))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Dados inválidos' })
    }
    console.error('[scheduled-reports] Erro ao criar:', error)
    return res.status(500).json({ message: 'Erro ao salvar agendamento de relatório' })
  }
})

router.put('/scheduled-reports/:id', async (req, res) => {
  try {
    await ensureScheduledReportsSchema()
    const { id } = req.params
    const partialPayload = updateScheduledReportSchema.parse(req.body || {})

    const current = await pool.query('SELECT * FROM scheduled_reports WHERE id = $1', [id])
    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Agendamento não encontrado' })
    }

    const currentRow = current.rows[0]
    const currentPayload = currentRow.payload && typeof currentRow.payload === 'object' ? currentRow.payload : {}
    const mergedPayload = { ...currentPayload, ...partialPayload, id }

    const result = await pool.query(
      `UPDATE scheduled_reports
          SET name = $2,
              frequency = $3,
              recipients = $4,
              format = $5,
              is_active = $6,
              last_execution = $7,
              next_execution = $8,
              created_by = $9,
              payload = $10,
              updated_at = NOW()
        WHERE id = $1
      RETURNING *`,
      [
        id,
        mergedPayload.name || currentRow.name,
        mergedPayload.frequency || currentRow.frequency,
        JSON.stringify(mergedPayload.recipients || []),
        mergedPayload.format || currentRow.format || 'pdf',
        mergedPayload.isActive ?? currentRow.is_active ?? true,
        toNullableTimestamp(mergedPayload.lastExecuted),
        toNullableTimestamp(mergedPayload.nextExecution),
        mergedPayload.createdBy || currentRow.created_by || null,
        JSON.stringify(mergedPayload)
      ]
    )

    return res.json(mapScheduledReport(result.rows[0]))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Dados inválidos' })
    }
    console.error('[scheduled-reports] Erro ao atualizar:', error)
    return res.status(500).json({ message: 'Erro ao atualizar agendamento de relatório' })
  }
})

// Exporta template com a MESMA lógica usada no CRON (mesmo formato e conteúdo)
router.post('/scheduled-reports/export-template', async (req, res) => {
  try {
    const payload = req.body || {}
    const reportName = payload?.name || 'Relatório'

    const result = await buildTemplateExportFromPayload(payload, reportName)

    return res.json({
      data: result.buffer.toString('base64'),
      filename: result.filename,
      mimeType: result.mimeType,
      reportName: result.reportName,
      format: result.reportFormat,
    })
  } catch (error) {
    console.error('[scheduled-reports] Erro ao exportar template:', error)
    return res.status(500).json({ message: 'Erro ao exportar template' })
  }
})

router.post('/scheduled-reports/:id/run-now', async (req, res) => {
  try {
    await ensureScheduledReportsSchema()
    const { id } = req.params

    const current = await pool.query('SELECT * FROM scheduled_reports WHERE id = $1', [id])
    if ((current.rowCount || 0) === 0) {
      return res.status(404).json({ message: 'Agendamento não encontrado' })
    }

    await pool.query(
      `UPDATE scheduled_reports
          SET is_active = TRUE,
              next_execution = NOW() - INTERVAL '1 second',
              updated_at = NOW()
        WHERE id = $1`,
      [id],
    )

    await runScheduledReportsNow()

    const updated = await pool.query('SELECT * FROM scheduled_reports WHERE id = $1', [id])
    return res.json(mapScheduledReport(updated.rows[0]))
  } catch (error) {
    console.error('[scheduled-reports] Erro ao executar agora:', error)
    return res.status(500).json({ message: 'Erro ao executar agendamento agora' })
  }
})

// Endpoint consultado pelo frontend para detectar relatórios prontos para download
router.get('/scheduled-reports/:id/download', async (req, res) => {
  try {
    await ensureScheduledReportsSchema()
    const { id } = req.params
    const result = await pool.query('SELECT * FROM scheduled_reports WHERE id = $1', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Relatório não encontrado' })
    }
    const row = result.rows[0]
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
    if (!payload.lastReportData && !payload.lastReportHtml) {
      return res.status(404).json({ message: 'Relatório ainda não gerado' })
    }
    return res.json({
      // Novo formato (base64 do arquivo real)
      data:     payload.lastReportData     || null,
      filename: payload.lastReportFilename || null,
      mimeType: payload.lastReportMime     || null,
      // Compat. legada (html)
      html:     payload.lastReportHtml     || null,
      readyAt:  payload.lastReportReadyAt,
      name:     payload.name || row.name,
    })
  } catch (error) {
    console.error('[scheduled-reports] Erro ao buscar download:', error)
    return res.status(500).json({ message: 'Erro ao buscar relatório para download' })
  }
})

router.delete('/scheduled-reports/:id', async (req, res) => {
  try {
    await ensureScheduledReportsSchema()
    const { id } = req.params
    await pool.query('DELETE FROM scheduled_reports WHERE id = $1', [id])
    return res.status(204).send()
  } catch (error) {
    console.error('[scheduled-reports] Erro ao excluir:', error)
    return res.status(500).json({ message: 'Erro ao excluir agendamento de relatório' })
  }
})

// ─── Endpoint para a página de impressão (exclusivo do Puppeteer / CRON) ─────
// GET /api/scheduled-reports/:id/print-data?cron_token=TOKEN
// Retorna payload + agendamentos + locais para a PrintReportPage renderizar.
router.get('/scheduled-reports/:id/print-data', async (req, res) => {
  const token     = String(req.query.cron_token || '')
  const cronToken = process.env.CRON_PRINT_TOKEN || ''

  if (!cronToken || token !== cronToken) {
    return res.status(401).json({ message: 'Token inválido ou ausente' })
  }

  try {
    await ensureScheduledReportsSchema()
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM scheduled_reports WHERE id = $1', [Number(id)])
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Relatório agendado não encontrado' })
    }

    const row     = rows[0]
    const payload = (row.payload && typeof row.payload === 'object') ? row.payload : {}

    // Buscar agendamentos (mesma query do templateExportService)
    const { rows: raw } = await pool.query<any>(`
      SELECT
        a.id, a.cidadao_nome, a.cidadao_cpf, a.data_agendamento, a.hora_agendamento,
        a.status, a.telefone, a.email, a.genero, a.local_id, a.tipo_cin,
        a.endereco_rua, a.endereco_numero, a.bairro_nome, a.regiao_tipo, a.regiao_nome,
        a.protocolo, a.criado_em, a.prioridade,
        l.nome_local AS local_nome
      FROM agendamentos a
      LEFT JOIN locais_atendimento l ON l.id = a.local_id
      WHERE a.prefeitura_id = 1
      ORDER BY a.data_agendamento ASC
    `)

    // Buscar locais ativos
    const { rows: locRows } = await pool.query<any>(
      `SELECT id, nome_local AS name FROM locais_atendimento WHERE ativo = true ORDER BY nome_local`,
    )

    const appointments = raw.map((r: any) => ({
      id:          String(r.id),
      protocol:    r.protocolo    || '',
      fullName:    r.cidadao_nome || '',
      cpf:         r.cidadao_cpf  || '',
      rg:          '',
      rgType:      r.tipo_cin     || '',
      phone:       r.telefone     || '',
      email:       r.email        || '',
      gender:      r.genero       || '',
      date:        r.data_agendamento instanceof Date
                     ? r.data_agendamento.toISOString().split('T')[0]
                     : String(r.data_agendamento || '').split('T')[0],
      time:        r.hora_agendamento ? String(r.hora_agendamento).substring(0, 5) : '',
      status:      r.status        || '',
      locationId:  r.local_id != null ? String(r.local_id) : '',
      locationName: r.local_nome   || '',
      street:      r.endereco_rua     || '',
      number:      r.endereco_numero  || '',
      neighborhood: r.bairro_nome     || '',
      regionType:  r.regiao_tipo      || '',
      regionName:  r.regiao_nome      || '',
      createdAt:   r.criado_em instanceof Date ? r.criado_em.toISOString() : new Date().toISOString(),
      priority:    r.prioridade       || 'normal',
    }))

    const locations = locRows.map((l: any) => ({ id: String(l.id), name: l.name }))

    return res.json({ payload, appointments, locations })
  } catch (error) {
    console.error('[scheduled-reports] Erro ao buscar print-data:', error)
    return res.status(500).json({ message: 'Erro interno ao preparar dados de impressão' })
  }
})

export default router
