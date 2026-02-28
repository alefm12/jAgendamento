import { Router } from 'express'
import path from 'path'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { pool } from '../config/db'
import { z } from 'zod'
import tenantMiddleware, { type TenantRequest } from '../middleware/tenantMiddleware'
import { type AuthRequest } from '../middlewares/auth.middleware'
import { createAuditLog as createServerAuditLog } from '../services/audit.service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })
let customFieldColumnEnsured = false

const ensureCustomFieldColumn = async () => {
  if (customFieldColumnEnsured) return
  await pool.query(`ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}'::jsonb`)
  customFieldColumnEnsured = true
}

// TEMPORARIAMENTE REMOVIDO - TESTE
// router.use(tenantMiddleware)

const getActorFromRequest = (req: AuthRequest) => ({
  userId: req.user?.id ?? undefined,
  userEmail: req.user?.email ?? undefined,
  userName: req.user?.name || req.user?.email || 'Sistema',
  userRole: req.user?.role || 'SECRETARY'
})

const buildAuditDescription = (
  actorName: string,
  detailedAction: string,
  targetWithIdentifier: string,
  frontendTab: string
) => `O usuário ${actorName} ${detailedAction} do cidadão/item ${targetWithIdentifier}, pela aba ${frontendTab}.`

const normalizeStatus = (value?: string) => String(value || '').trim().toLowerCase()

const isRoutineAttendanceStatus = (status?: string) => {
  const normalized = normalizeStatus(status)
  return ['confirmado', 'em atendimento', 'concluido', 'concluído', 'cin pronta', 'pendente'].includes(normalized)
}

const createAgendamentoSchema = z.object({
  name: z.string(),
  cpf: z.string(),
  phone: z.string(),
  email: z.string(),
  gender: z.string().optional(),
  cinType: z.string().optional(),
  cinNumber: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  regionType: z.string().optional(),
  region: z.string().optional(),
  neighborhood: z.string().optional(),
  date: z.string(),
  time: z.string(),
  termsAccepted: z.boolean().optional(),
  notificationsAccepted: z.boolean().optional(),
  tenantId: z.any().optional(),
  prefeituraId: z.any().optional(),
  locationId: z.any().optional(),
  customFieldValues: z.record(z.any()).optional()
})

const mapAppointmentRow = (row: any) => {
  const dateValue = row.data_agendamento instanceof Date
    ? row.data_agendamento.toISOString().split('T')[0]
    : row.data_agendamento

  const timeValue = row.hora_agendamento
    ? String(row.hora_agendamento).substring(0, 5)
    : '00:00'

  const createdAtValue = row.criado_em instanceof Date
    ? row.criado_em.toISOString()
    : new Date().toISOString()

  return {
    id: row.id,
    protocol: row.protocolo, // Retornar protocolo exatamente como está no banco
    fullName: row.cidadao_nome,
    name: row.cidadao_nome,
    cpf: row.cidadao_cpf,
    phone: row.telefone,
    email: row.email,
    gender: row.genero,
    date: dateValue,
    time: timeValue,
    status: row.status,
    locationId: row.local_id != null ? String(row.local_id) : null,
    locationName: row.local_nome || null,
    cinType: row.tipo_cin,
    rgType: row.tipo_cin,
    address: `${row.endereco_rua || ''}, ${row.endereco_numero || ''} - ${row.bairro_nome || ''}`,
    street: row.endereco_rua,
    number: row.endereco_numero,
    neighborhood: row.bairro_nome,
    regionType: row.regiao_tipo,
    regionName: row.regiao_nome,
    createdAt: createdAtValue,
    completedAt: row.concluido_em instanceof Date
      ? row.concluido_em.toISOString()
      : (row.concluido_em || null),
    completedBy: row.concluido_por || null,
    lastModified: row.ultima_modificacao instanceof Date
      ? row.ultima_modificacao.toISOString()
      : (row.ultima_modificacao || null),
    notes: row.notas || [],
    priority: row.prioridade || 'normal',
    statusHistory: row.historico_status || [],
    customFieldValues: row.custom_field_values || row.customFieldValues || {}
  }
}

const normalizeText = (value: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const onlyDigits = (value?: string) => String(value || '').replace(/\D/g, '')

const extractTokensFromLine = (line: string): string[] => {
  const protocolTokens = line.match(/[A-Z0-9-]{6,}/gi) || []
  const digitTokens = (line.match(/\d[\d.\- ]{7,}\d/g) || []).map((token) => onlyDigits(token)).filter(Boolean)
  const nameLike = line
    .split(/[;,|]/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8)
  return [...protocolTokens, ...digitTokens, ...nameLike]
}

const tryDecodeUtf8 = (buffer: Buffer) => {
  try {
    return buffer.toString('utf8')
  } catch {
    return ''
  }
}

const extractTextFromXlsxBuffer = (buffer: Buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const chunks: string[] = []
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) return
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false })
      rows.forEach((row) => {
        const line = (row || []).map((cell) => String(cell || '').trim()).filter(Boolean).join(' ')
        if (line) chunks.push(line)
      })
    })
    return chunks.join('\n')
  } catch {
    return ''
  }
}

const extractTextFromPdfBuffer = (buffer: Buffer) => {
  // Fallback simples: extrai blocos textuais visíveis no PDF quando disponíveis.
  const raw = buffer.toString('latin1')
  const fragments = raw.match(/\(([^()]{3,})\)/g) || []
  return fragments
    .map((fragment) => fragment.slice(1, -1))
    .join('\n')
}

router.post('/cin-ready/detect-batch', upload.single('file'), async (req, res) => {
  const tenantId = 1
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ message: 'Arquivo não enviado' })
    }

    const ext = path.extname(file.originalname || '').toLowerCase()
    let extractedText = ''

    if (['.txt', '.csv', '.json'].includes(ext)) {
      extractedText = tryDecodeUtf8(file.buffer)
    } else if (['.xls', '.xlsx'].includes(ext)) {
      extractedText = extractTextFromXlsxBuffer(file.buffer)
    } else if (ext === '.pdf') {
      extractedText = extractTextFromPdfBuffer(file.buffer)
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'].includes(ext)) {
      // Sem OCR nativo no servidor, usa nome do arquivo + conteúdo textual residual quando houver.
      extractedText = `${file.originalname}\n${tryDecodeUtf8(file.buffer)}`
    } else {
      extractedText = `${file.originalname}\n${tryDecodeUtf8(file.buffer)}`
    }

    const lines = extractedText
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)

    const candidates = new Set<string>()
    lines.forEach((line) => {
      extractTokensFromLine(line).forEach((token) => candidates.add(token))
      if (line.length >= 8) candidates.add(line)
    })
    if (file.originalname) {
      candidates.add(file.originalname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    }

    const db = await pool.query(
      `SELECT id, cidadao_nome, cidadao_cpf, protocolo, status
         FROM agendamentos
        WHERE prefeitura_id = $1
          AND status = 'awaiting-issuance'`,
      [tenantId]
    )

    const rows = db.rows || []
    const matched = new Map<string, any>()
    const unmatched: string[] = []

    const appointmentByProtocol = new Map<string, any>()
    const appointmentByCpf = new Map<string, any>()
    rows.forEach((row: any) => {
      appointmentByProtocol.set(String(row.protocolo || '').toUpperCase(), row)
      appointmentByCpf.set(onlyDigits(row.cidadao_cpf), row)
    })

    candidates.forEach((candidateRaw) => {
      const candidate = String(candidateRaw || '').trim()
      if (!candidate) return
      const candidateUpper = candidate.toUpperCase()
      const candidateDigits = onlyDigits(candidate)
      const normalizedCandidate = normalizeText(candidate)

      let found = appointmentByProtocol.get(candidateUpper)
      if (!found && candidateDigits.length >= 11) {
        found = appointmentByCpf.get(candidateDigits.slice(0, 11))
      }
      if (!found) {
        found = rows.find((row: any) => {
          const name = normalizeText(row.cidadao_nome || '')
          if (!name) return false
          const parts = name.split(/\s+/).filter((part: string) => part.length >= 4).slice(0, 3)
          return parts.length > 0 && parts.every((part: string) => normalizedCandidate.includes(part))
        })
      }

      if (found) {
        matched.set(String(found.id), {
          id: String(found.id),
          fullName: found.cidadao_nome,
          cpf: found.cidadao_cpf,
          protocol: found.protocolo
        })
      } else if (candidate.length >= 6) {
        unmatched.push(candidate)
      }
    })

    return res.json({
      fileName: file.originalname,
      extractedLineCount: lines.length,
      matched: Array.from(matched.values()),
      unmatched: Array.from(new Set(unmatched)).slice(0, 50),
      note:
        ['.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'].includes(ext)
          ? 'Detecção assistida sem OCR nativo neste servidor. Verifique a prévia antes de confirmar.'
          : undefined
    })
  } catch (error) {
    console.error('[DETECT BATCH CIN READY] Erro:', error)
    return res.status(500).json({ message: 'Erro ao processar arquivo', detail: (error as Error).message })
  }
})

router.get('/', async (req, res) => {
  await ensureCustomFieldColumn()
  // TESTE SIMPLES SEM TENANT
  const tenantId = 1 // Hardcoded para teste
  
  const query = `
    SELECT a.id, a.cidadao_nome, a.cidadao_cpf, a.data_agendamento, a.hora_agendamento, a.status, a.telefone,
           a.email, a.genero, a.local_id, a.tipo_cin, a.endereco_rua, a.endereco_numero, a.bairro_nome,
           a.regiao_tipo, a.regiao_nome, a.protocolo, a.criado_em, a.notas, a.prioridade, a.historico_status,
           a.custom_field_values,
           a.concluido_em, a.concluido_por, a.ultima_modificacao,
           l.nome_local AS local_nome
      FROM agendamentos a
      LEFT JOIN locais_atendimento l ON l.id = a.local_id
     WHERE a.prefeitura_id = $1
     ORDER BY a.data_agendamento ASC
  `

  try {
    console.log('[AGENDAMENTOS] Buscando agendamentos para prefeitura', tenantId)
    const result = await pool.query(query, [tenantId])
    console.log('[AGENDAMENTOS] Encontrados:', result.rows.length, 'agendamentos')
    res.json(result.rows.map(mapAppointmentRow))
  } catch (error) {
    console.error('[AGENDAMENTOS] Erro ao consultar:', error)
    res.status(500).json({ message: 'Erro interno ao consultar agendamentos', error: (error as Error).message })
  }
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    await ensureCustomFieldColumn()
    console.log('[AGENDAMENTOS POST] Dados recebidos:', JSON.stringify(req.body, null, 2))
    
    // VALIDAÇÃO SIMPLIFICADA PARA DEBUG
    const data = {
      protocol: req.body.protocol,
      name: req.body.name,
      cpf: req.body.cpf,
      phone: req.body.phone,
      email: req.body.email,
      gender: req.body.gender,
      cinType: req.body.cinType,
      cinNumber: req.body.cinNumber,
      street: req.body.street,
      number: req.body.number,
      regionType: req.body.regionType,
      region: req.body.region,
      neighborhood: req.body.neighborhood,
      date: req.body.date,
      time: req.body.time,
      termsAccepted: req.body.termsAccepted,
      notificationsAccepted: req.body.notificationsAccepted,
      locationId: req.body.locationId,
      prefeituraId: req.body.prefeituraId,
      tenantId: req.body.tenantId,
      notes: req.body.notes,
      priority: req.body.priority,
      statusHistory: req.body.statusHistory,
      customFieldValues: req.body.customFieldValues
    }

    const prefeitura_id = data.prefeituraId || data.tenantId || 1
    let local_id = data.locationId

    if (!local_id) {
      const check = await pool.query('SELECT id FROM locais_atendimento WHERE prefeitura_id = $1 LIMIT 1', [prefeitura_id])
      local_id = check.rows[0]?.id || 1
    }

    let timeValue = data.time || '08:00'
    if (timeValue.length === 5) timeValue += ':00'

    // Criar histórico inicial
    const initialHistory = [{
      status: 'pendente',
      timestamp: new Date().toISOString(),
      user: 'sistema',
      note: 'Agendamento criado'
    }]

    const insertQuery = `
      INSERT INTO agendamentos (
        prefeitura_id, local_id, protocolo,
        cidadao_nome, cidadao_cpf, telefone, email, genero,
        tipo_cin, numero_cin,
        endereco_rua, endereco_numero,
        regiao_tipo, regiao_nome, bairro_nome,
        data_agendamento, hora_agendamento, status,
        aceite_termos, aceite_notificacoes,
        notas, prioridade, historico_status, custom_field_values
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10,
        $11, $12,
        $13, $14, $15,
        $16, $17, 'pendente',
        $18, $19,
        $20, $21, $22, $23
      )
      RETURNING *
    `

    const values = [
      prefeitura_id,
      local_id,
      data.protocol || null,
      data.name,
      data.cpf,
      data.phone,
      data.email,
      data.gender || null,
      data.cinType || null,
      data.cinNumber || null,
      data.street || null,
      data.number || null,
      data.regionType || null,
      data.region || null,
      data.neighborhood || null,
      data.date,
      timeValue,
      data.termsAccepted || false,
      data.notificationsAccepted || false,
      JSON.stringify(data.notes || []),
      data.priority || 'normal',
      JSON.stringify(data.statusHistory || initialHistory),
      JSON.stringify(data.customFieldValues || {})
    ]

    console.log('[AGENDAMENTOS POST] Inserindo com valores:', values)
    const result = await pool.query(insertQuery, values)
    console.log('[AGENDAMENTOS POST] ✅ Sucesso! ID:', result.rows[0].id)
    
    const createdAppointment = result.rows[0]
    const protocol = createdAppointment?.protocolo || createdAppointment?.numero_cin || createdAppointment?.id
    const citizenName = createdAppointment?.cidadao_nome || data.name || 'Não identificado'
    const actor = getActorFromRequest(req)
    await createServerAuditLog({
      ...actor,
      action: 'CREATE_APPOINTMENT',
      actionCategory: 'APPOINTMENT',
      description: buildAuditDescription(
        actor.userName,
        'criou o agendamento',
        `${citizenName} (Protocolo: ${protocol})`,
        'Agendamentos'
      ),
      severity: 'LOW',
      entityType: 'appointment',
      entityId: String(createdAppointment?.id || ''),
      newValues: createdAppointment,
      status: 'success'
    }, req)
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[AGENDAMENTOS POST] ❌ Erro de validação Zod:', error.errors)
      res.status(400).json({ message: 'Dados inválidos', errors: error.errors })
      return
    }

    console.error('[AGENDAMENTOS POST] ❌ Erro ao salvar:', error)
    res.status(500).json({ message: 'Erro ao salvar', detail: (error as Error).message })
  }
})

// PATCH /:id - Atualizar status e histórico do agendamento
router.patch('/:id', async (req: AuthRequest, res) => {
  await ensureCustomFieldColumn()
  const tenantId = 1 // Hardcoded para teste
  const appointmentId = req.params.id
  
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM agendamentos WHERE id = $1 AND prefeitura_id = $2',
      [appointmentId, tenantId]
    )
    if (beforeResult.rowCount === 0) {
      return res.status(404).json({ message: 'Agendamento não encontrado' })
    }
    const beforeAppointment = beforeResult.rows[0]

    console.log('[AGENDAMENTOS PATCH] Atualizando agendamento ID:', appointmentId)
    console.log('[AGENDAMENTOS PATCH] Dados recebidos:', req.body)
    
    const {
      status,
      statusHistory,
      notes,
      priority,
      date,
      time,
      cancelledBy,
      cancellationReason,
      completedAt,
      completedBy,
      lastModified,
      // Campos de dados pessoais do cidadão
      fullName,
      email,
      phone,
      cpf,
      street,
      number,
      neighborhood,
      regionType
    } = req.body
    
    // Construir query dinamicamente apenas com campos fornecidos
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1
    
    if (status) {
      updates.push(`status = $${paramCount++}`)
      values.push(status)
    }
    
    if (statusHistory) {
      updates.push(`historico_status = $${paramCount++}`)
      values.push(JSON.stringify(statusHistory))
    }

    if (notes !== undefined) {
      updates.push(`notas = $${paramCount++}`)
      values.push(JSON.stringify(notes))
    }

    if (priority !== undefined) {
      updates.push(`prioridade = $${paramCount++}`)
      values.push(priority)
    }

    if (date) {
      updates.push(`data_agendamento = $${paramCount++}`)
      values.push(date)
    }

    if (time) {
      updates.push(`hora_agendamento = $${paramCount++}`)
      values.push(time)
    }
    
    if (cancelledBy !== undefined) {
      updates.push(`cancelado_por = $${paramCount++}`)
      values.push(cancelledBy)
    }
    
    if (cancellationReason !== undefined) {
      updates.push(`motivo_cancelamento = $${paramCount++}`)
      values.push(cancellationReason)
    }
    
    if (completedAt) {
      updates.push(`concluido_em = $${paramCount++}`)
      values.push(completedAt)
    }
    
    if (completedBy) {
      updates.push(`concluido_por = $${paramCount++}`)
      values.push(completedBy)
    }
    
    if (lastModified) {
      updates.push(`atualizado_em = $${paramCount++}`)
      values.push(lastModified)
    }

    // Dados pessoais do cidadão
    if (fullName !== undefined) {
      updates.push(`cidadao_nome = $${paramCount++}`)
      values.push(fullName)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`)
      values.push(email)
    }
    if (phone !== undefined) {
      // Normaliza para armazenar apenas dígitos, garantindo consistência
      const rawPhone = String(phone).replace(/\D/g, '')
      updates.push(`telefone = $${paramCount++}`)
      values.push(rawPhone)
    }
    if (cpf !== undefined) {
      updates.push(`cidadao_cpf = $${paramCount++}`)
      values.push(cpf)
    }
    if (street !== undefined) {
      updates.push(`endereco_rua = $${paramCount++}`)
      values.push(street)
    }
    if (number !== undefined) {
      updates.push(`endereco_numero = $${paramCount++}`)
      values.push(number)
    }
    if (neighborhood !== undefined) {
      updates.push(`bairro_nome = $${paramCount++}`)
      values.push(neighborhood)
    }
    if (regionType !== undefined) {
      updates.push(`regiao_tipo = $${paramCount++}`)
      values.push(regionType)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar' })
    }
    
    values.push(appointmentId, tenantId)
    
    const updateQuery = `
      UPDATE agendamentos
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND prefeitura_id = $${paramCount++}
      RETURNING *
    `
    
    console.log('[AGENDAMENTOS PATCH] Query:', updateQuery)
    console.log('[AGENDAMENTOS PATCH] Values:', values)
    
    const result = await pool.query(updateQuery, values)
    
    if (result.rowCount === 0) return res.status(404).json({ message: 'Agendamento não encontrado' })

    // Re-buscar com JOIN para incluir local_nome
    const joinResult = await pool.query(
      `SELECT a.*, l.nome_local AS local_nome
         FROM agendamentos a
         LEFT JOIN locais_atendimento l ON l.id = a.local_id
        WHERE a.id = $1`,
      [appointmentId]
    )
    const updatedAppointment = joinResult.rows[0] || result.rows[0]
    const protocol = updatedAppointment?.protocolo || updatedAppointment?.numero_cin || appointmentId
    const citizenName = updatedAppointment?.cidadao_nome || beforeAppointment?.cidadao_nome || 'Não identificado'
    const actor = getActorFromRequest(req)
    const detailedAction = status
      ? `alterou o status do agendamento para "${status}"`
      : 'alterou o agendamento'
    const newStatusNormalized = normalizeStatus(status)
    const severity =
      !status
        ? 'HIGH'
        : newStatusNormalized === 'faltou' || newStatusNormalized === 'cancelado'
          ? 'HIGH'
          : isRoutineAttendanceStatus(status)
            ? 'LOW'
            : 'MEDIUM'

    await createServerAuditLog({
      ...actor,
      action: status ? 'UPDATE_APPOINTMENT_STATUS' : 'UPDATE_APPOINTMENT',
      actionCategory: 'APPOINTMENT',
      description: buildAuditDescription(
        actor.userName,
        detailedAction,
        `${citizenName} (Protocolo: ${protocol})`,
        'Secretaria'
      ),
      severity,
      entityType: 'appointment',
      entityId: String(appointmentId),
      oldValues: beforeAppointment,
      newValues: updatedAppointment,
      status: 'success'
    }, req)

    console.log('[AGENDAMENTOS PATCH] ✅ Agendamento atualizado com sucesso')
    
    res.json(mapAppointmentRow(updatedAppointment))
  } catch (error) {
    console.error('[AGENDAMENTOS PATCH] ❌ Erro:', error)
    res.status(500).json({ 
      message: 'Erro ao atualizar agendamento', 
      detail: (error as Error).message 
    })
  }
})

// DELETE /:id - Excluir agendamento
router.delete('/:id', async (req: AuthRequest, res) => {
  const tenantId = 1 // Hardcoded para teste
  const appointmentId = req.params.id
  
  try {
    console.log('[AGENDAMENTOS DELETE] Excluindo agendamento ID:', appointmentId)
    
    // Buscar dados do agendamento antes de excluir (para log de auditoria)
    const appointmentData = await pool.query(
      'SELECT * FROM agendamentos WHERE id = $1 AND prefeitura_id = $2',
      [appointmentId, tenantId]
    )
    
    if (appointmentData.rowCount === 0) {
      console.log('[AGENDAMENTOS DELETE] ⚠️ Agendamento não encontrado')
      return res.status(404).json({ message: 'Agendamento não encontrado' })
    }
    
    // Excluir o agendamento
    const result = await pool.query(
      'DELETE FROM agendamentos WHERE id = $1 AND prefeitura_id = $2 RETURNING id',
      [appointmentId, tenantId]
    )
    
    const deletedAppointment = appointmentData.rows[0]
    const protocol = deletedAppointment?.protocolo || deletedAppointment?.numero_cin || appointmentId
    const citizenName = deletedAppointment?.cidadao_nome || 'Não identificado'
    const actor = getActorFromRequest(req)

    await createServerAuditLog({
      ...actor,
      action: 'DELETE_APPOINTMENT',
      actionCategory: 'APPOINTMENT',
      description: buildAuditDescription(
        actor.userName,
        'excluiu o agendamento',
        `${citizenName} (Protocolo: ${protocol})`,
        'Agendamentos'
      ),
      severity: 'HIGH',
      entityType: 'appointment',
      entityId: String(appointmentId),
      oldValues: deletedAppointment,
      status: 'success'
    }, req)
    
    console.log('[AGENDAMENTOS DELETE] ✅ Agendamento excluído com sucesso')
    res.status(204).send()
  } catch (error) {
    console.error('[AGENDAMENTOS DELETE] ❌ Erro ao excluir:', error)
    res.status(500).json({ message: 'Erro ao excluir agendamento', detail: (error as Error).message })
  }
})

// GET /datas-bloqueadas - Listar datas bloqueadas
router.get('/datas-bloqueadas', async (req, res) => {
  const tenantId = 1 // Hardcoded para teste
  
  const query = `
    SELECT id, data, motivo, tipo_bloqueio, horarios_bloqueados, criado_por, criado_em
      FROM datas_bloqueadas
     WHERE prefeitura_id = $1
     ORDER BY data ASC
  `

  try {
    const result = await pool.query(query, [tenantId])
    console.log('[DATAS BLOQUEADAS] Encontradas:', result.rows.length)
    res.json(result.rows.map(row => ({
      id: row.id,
      date: row.data instanceof Date ? row.data.toISOString().split('T')[0] : row.data,
      reason: row.motivo,
      blockType: row.tipo_bloqueio,
      blockedSlots: row.horarios_bloqueados,
      createdBy: row.criado_por,
      createdAt: row.criado_em
    })))
  } catch (error) {
    console.error('Erro ao consultar datas bloqueadas:', error)
    res.status(500).json({ message: 'Erro interno ao consultar datas bloqueadas' })
  }
})

// POST /datas-bloqueadas - Criar data bloqueada
router.post('/datas-bloqueadas', async (req: AuthRequest, res) => {
  const tenantId = 1 // Hardcoded para teste
  const { date, reason, blockType, blockedTimes, createdBy } = req.body
  
  try {
    console.log('[DATAS BLOQUEADAS] Criando bloqueio:', { tenantId, date, reason, blockType, blockedTimes, createdBy })
    const result = await pool.query(
      `INSERT INTO datas_bloqueadas 
        (prefeitura_id, data, motivo, tipo_bloqueio, horarios_bloqueados, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, data, motivo, tipo_bloqueio, horarios_bloqueados, criado_por, criado_em`,
      [tenantId, date, reason, blockType || 'full-day', blockedTimes ? JSON.stringify(blockedTimes) : null, createdBy || 'sistema']
    )
    
    console.log('[DATAS BLOQUEADAS] ✅ Bloqueio criado com sucesso, ID:', result.rows[0].id)
    const row = result.rows[0]
    const response = {
      id: String(row.id),
      date: row.data instanceof Date ? row.data.toISOString().split('T')[0] : row.data,
      reason: row.motivo,
      blockType: row.tipo_bloqueio,
      blockedSlots: row.horarios_bloqueados,
      createdBy: row.criado_por,
      createdAt: row.criado_em
    }
    console.log('[DATAS BLOQUEADAS] ✅ Bloqueio criado:', response)

    const actor = getActorFromRequest(req)
    await createServerAuditLog({
      ...actor,
      action: 'blocked_date_created',
      actionCategory: 'SYSTEM',
      description: buildAuditDescription(
        actor.userName,
        'criou o bloqueio de data',
        `${response.date}${response.reason ? ` (Motivo: ${response.reason})` : ''}`,
        'Bloqueio de Datas'
      ),
      severity: 'HIGH',
      entityType: 'blocked_date',
      entityId: String(response.id),
      newValues: response,
      status: 'success'
    }, req)

    res.status(201).json(response)
  } catch (error) {
    console.error('[DATAS BLOQUEADAS] ❌ Erro ao criar bloqueio:', error)
    res.status(500).json({ message: 'Erro ao criar data bloqueada', detail: (error as Error).message })
  }
})

// DELETE /datas-bloqueadas/:id - Remover data bloqueada
router.delete('/datas-bloqueadas/:id', async (req: AuthRequest, res) => {
  const tenantId = 1 // Hardcoded para teste
  const dateId = req.params.id
  
  try {
    console.log('[DATAS BLOQUEADAS] Removendo bloqueio ID:', dateId)
    const beforeResult = await pool.query(
      'SELECT id, data, motivo, tipo_bloqueio, horarios_bloqueados, criado_por, criado_em FROM datas_bloqueadas WHERE id = $1 AND prefeitura_id = $2',
      [dateId, tenantId]
    )
    const beforeBlock = beforeResult.rows[0]

    const result = await pool.query(
      'DELETE FROM datas_bloqueadas WHERE id = $1 AND prefeitura_id = $2',
      [dateId, tenantId]
    )
    
    if (result.rowCount === 0) {
      console.log('[DATAS BLOQUEADAS] ⚠️ Bloqueio não encontrado')
      return res.status(404).json({ message: 'Data bloqueada não encontrada' })
    }
    
    const actor = getActorFromRequest(req)
    const blockedDate = beforeBlock?.data instanceof Date
      ? beforeBlock.data.toISOString().split('T')[0]
      : beforeBlock?.data || dateId
    await createServerAuditLog({
      ...actor,
      action: 'blocked_date_deleted',
      actionCategory: 'SYSTEM',
      description: buildAuditDescription(
        actor.userName,
        'removeu o bloqueio de data',
        `${blockedDate}${beforeBlock?.motivo ? ` (Motivo: ${beforeBlock.motivo})` : ''}`,
        'Bloqueio de Datas'
      ),
      severity: 'HIGH',
      entityType: 'blocked_date',
      entityId: String(dateId),
      oldValues: beforeBlock || null,
      status: 'success'
    }, req)

    console.log('[DATAS BLOQUEADAS] ✅ Bloqueio removido')
    res.status(204).send()
  } catch (error) {
    console.error('[DATAS BLOQUEADAS] Erro ao deletar:', error)
    res.status(500).json({ message: 'Erro ao deletar data bloqueada' })
  }
})

// ROTA TEMPORÁRIA: Remover constraint de unicidade
router.get('/fix-constraint', async (req, res) => {
  try {
    console.log('[FIX] Removendo constraint unique_agendamento...')
    
    // Remover a constraint
    await pool.query('ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS unique_agendamento')
    
    console.log('[FIX] ✅ Constraint removida com sucesso')
    
    // Criar índice para melhorar performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agendamentos_slot ON agendamentos(local_id, data_agendamento, hora_agendamento)')
    
    console.log('[FIX] ✅ Índice criado com sucesso')
    
    res.json({ 
      success: true, 
      message: 'Constraint removida e índice criado com sucesso. Agora você pode fazer múltiplos agendamentos no mesmo horário!' 
    })
  } catch (error) {
    console.error('[FIX] ❌ Erro:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao remover constraint', 
      detail: (error as Error).message 
    })
  }
})

// ROTA TEMPORÁRIA: Criar tabela de cancelamentos
router.get('/create-cancelamentos-table', async (req, res) => {
  try {
    console.log('[MIGRATION] Criando tabela de cancelamentos...')
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS cancelamentos (
        id SERIAL PRIMARY KEY,
        agendamento_id INTEGER NOT NULL,
        prefeitura_id INTEGER NOT NULL,
        
        -- Tipo de cancelamento
        cancelado_por VARCHAR(20) NOT NULL CHECK (cancelado_por IN ('cidadao', 'secretaria', 'sistema')),
        
        -- Informações do cidadão (se cancelado pelo cidadão)
        cidadao_ip VARCHAR(50),
        cidadao_user_agent TEXT,
        
        -- Informações do usuário da secretaria (se cancelado pela secretaria)
        usuario_id INTEGER,
        usuario_nome VARCHAR(255),
        usuario_email VARCHAR(255),
        
        -- Motivo e observações
        motivo TEXT,
        observacoes TEXT,
        
        -- Timestamps
        cancelado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `
    
    await pool.query(createTableQuery)
    console.log('[MIGRATION] ✅ Tabela cancelamentos criada')
    
    // Criar índices
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cancelamentos_agendamento ON cancelamentos(agendamento_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cancelamentos_prefeitura ON cancelamentos(prefeitura_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cancelamentos_usuario ON cancelamentos(usuario_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cancelamentos_data ON cancelamentos(cancelado_em)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cancelamentos_tipo ON cancelamentos(cancelado_por)')
    
    console.log('[MIGRATION] ✅ Índices criados')
    
    res.json({ 
      success: true, 
      message: 'Tabela de cancelamentos criada com sucesso!' 
    })
  } catch (error) {
    console.error('[MIGRATION] ❌ Erro:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar tabela', 
      detail: (error as Error).message 
    })
  }
})

// POST /cancelamentos - Registrar cancelamento
router.post('/cancelamentos', async (req: AuthRequest, res) => {
  const tenantId = 1 // Hardcoded para teste
  
  try {
    const {
      agendamentoId,
      canceladoPor,
      cidadaoIp,
      cidadaoUserAgent,
      usuarioId,
      usuarioNome,
      usuarioEmail,
      motivo,
      observacoes
    } = req.body
    
    console.log('[CANCELAMENTOS POST] Registrando cancelamento:', {
      agendamentoId,
      canceladoPor,
      usuarioNome
    })
    
    const insertQuery = `
      INSERT INTO cancelamentos (
        agendamento_id, prefeitura_id, cancelado_por,
        cidadao_ip, cidadao_user_agent,
        usuario_id, usuario_nome, usuario_email,
        motivo, observacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `
    
    const values = [
      agendamentoId,
      tenantId,
      canceladoPor,
      cidadaoIp || null,
      cidadaoUserAgent || null,
      usuarioId || null,
      usuarioNome || null,
      usuarioEmail || null,
      motivo || null,
      observacoes || null
    ]
    
    const result = await pool.query(insertQuery, values)
    console.log('[CANCELAMENTOS POST] ✅ Cancelamento registrado, ID:', result.rows[0].id)

    const appointmentLookup = await pool.query(
      'SELECT id, protocolo, numero_cin, cidadao_nome FROM agendamentos WHERE id = $1 AND prefeitura_id = $2 LIMIT 1',
      [agendamentoId, tenantId]
    )
    const appointment = appointmentLookup.rows[0]
    const protocol = appointment?.protocolo || appointment?.numero_cin || agendamentoId
    const citizenName = appointment?.cidadao_nome || 'Não identificado'
    const actorName = usuarioNome || req.user?.name || req.user?.email || 'Sistema'

    await createServerAuditLog({
      userId: usuarioId || null,
      userEmail: usuarioEmail || null,
      userName: actorName,
      userRole: canceladoPor === 'cidadao' ? 'USER' : 'SECRETARY',
      action: 'CANCEL_APPOINTMENT',
      actionCategory: 'APPOINTMENT',
      description: buildAuditDescription(
        actorName,
        `cancelou o agendamento${canceladoPor ? ` (${canceladoPor})` : ''}`,
        `${citizenName} (Protocolo: ${protocol})`,
        'Agendamentos'
      ),
      severity: 'HIGH',
      entityType: 'appointment',
      entityId: String(agendamentoId),
      oldValues: appointment || null,
      newValues: { status: 'cancelado', motivo, observacoes, canceladoPor },
      status: 'success'
    }, req)
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('[CANCELAMENTOS POST] ❌ Erro:', error)
    res.status(500).json({ 
      message: 'Erro ao registrar cancelamento', 
      detail: (error as Error).message 
    })
  }
})

// GET /cancelamentos/:agendamentoId - Buscar cancelamento de um agendamento
router.get('/cancelamentos/:agendamentoId', async (req, res) => {
  const tenantId = 1 // Hardcoded para teste
  const { agendamentoId } = req.params
  
  try {
    const query = `
      SELECT * FROM cancelamentos
      WHERE agendamento_id = $1 AND prefeitura_id = $2
      ORDER BY cancelado_em DESC
      LIMIT 1
    `
    
    const result = await pool.query(query, [agendamentoId, tenantId])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cancelamento não encontrado' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('[CANCELAMENTOS GET] ❌ Erro:', error)
    res.status(500).json({ 
      message: 'Erro ao buscar cancelamento', 
      detail: (error as Error).message 
    })
  }
})

export default router