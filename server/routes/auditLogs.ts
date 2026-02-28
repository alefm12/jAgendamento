import { Router } from 'express'
import { z } from 'zod'
import os from 'os'
import { pool } from '../config/db'

const router = Router()
const LOG_RETENTION_DAYS = 10
let lastRetentionCleanupAt = 0

const auditPayloadSchema = z.object({
  action: z.string().min(1, 'Ação é obrigatória'),
  actionLabel: z.string().optional(),
  description: z.string().optional(),
  performedBy: z.string().optional(),
  performedByRole: z.enum(['user', 'secretary', 'admin', 'system']).optional(),
  performedAt: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  targetName: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  changes: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  isReversible: z.boolean().optional(),
  reversedAt: z.string().optional(),
  reversedBy: z.string().optional(),
  status: z.enum(['success', 'failed', 'error']).optional(),
  errorMessage: z.string().optional(),
}).passthrough()

let schemaEnsured = false
const ensureAuditLogsSchema = async () => {
  if (schemaEnsured) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action VARCHAR(120) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_label VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_by VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_by_role VARCHAR(50)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_at TIMESTAMPTZ DEFAULT NOW()`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(80)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_name VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM'`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tags TEXT[]`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success'`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS error_message TEXT`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_category VARCHAR(80)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(80)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role VARCHAR(80)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(255)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS country VARCHAR(120)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS region VARCHAR(120)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS city VARCHAR(120)`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`)
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`)

  schemaEnsured = true
}

const cleanupOldAuditLogsIfNeeded = async () => {
  const now = Date.now()
  // Evita executar limpeza a cada request (janela de 1 hora)
  if (now - lastRetentionCleanupAt < 60 * 60 * 1000) return
  lastRetentionCleanupAt = now

  try {
    await pool.query(
      `DELETE FROM audit_logs
        WHERE COALESCE(performed_at, created_at) < (NOW() - ($1::text || ' days')::interval)`,
      [String(LOG_RETENTION_DAYS)]
    )
  } catch (error) {
    console.error('[audit-logs] Erro na retenção automática:', error)
  }
}

const toIsoOrNow = (value?: string) => {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

const normalizeIp = (raw?: string) => {
  if (!raw) return ''
  let ip = raw.trim()
  if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '')

  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    const interfaces = os.networkInterfaces()
    for (const entries of Object.values(interfaces)) {
      if (!entries) continue
      for (const entry of entries) {
        if (entry.family === 'IPv4' && !entry.internal && entry.address) {
          if (
            entry.address.startsWith('192.168.') ||
            entry.address.startsWith('10.') ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(entry.address)
          ) {
            return entry.address
          }
        }
      }
    }
  }

  return ip
}

const isPrivateOrLoopbackIp = (ip?: string) => {
  if (!ip) return true
  const value = ip.trim()
  return (
    value === '::1' ||
    value === '127.0.0.1' ||
    value === 'localhost' ||
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value) ||
    value.startsWith('169.254.')
  )
}

let cachedPublicIp: { value: string; fetchedAt: number } | null = null
const PUBLIC_IP_CACHE_TTL_MS = 5 * 60 * 1000
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const geolocationCache = new Map<string, { fetchedAt: number; data: {
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
} }>()

const getPublicIpCached = async () => {
  const now = Date.now()
  if (cachedPublicIp && now - cachedPublicIp.fetchedAt < PUBLIC_IP_CACHE_TTL_MS) {
    return cachedPublicIp.value
  }

  const providers = [
    'https://api.ipify.org?format=json',
    'https://ifconfig.me/all.json'
  ]

  for (const provider of providers) {
    try {
      const response = await fetch(provider)
      if (!response.ok) continue
      const data: any = await response.json()
      const ip = normalizeIp(String(data.ip_addr || data.ip || ''))
      if (ip && !isPrivateOrLoopbackIp(ip)) {
        cachedPublicIp = { value: ip, fetchedAt: now }
        return ip
      }
    } catch {
      // tenta próximo provider
    }
  }

  return undefined
}

const getGeolocationByIp = async (ip?: string) => {
  const normalizedIp = normalizeIp(ip || '')
  if (!normalizedIp || isPrivateOrLoopbackIp(normalizedIp)) {
    return {} as {
      country?: string
      region?: string
      city?: string
      latitude?: number
      longitude?: number
    }
  }

  const now = Date.now()
  const cached = geolocationCache.get(normalizedIp)
  if (cached && now - cached.fetchedAt < GEO_CACHE_TTL_MS) {
    return cached.data
  }

  const providers = [
    `https://ipwho.is/${normalizedIp}`,
    `https://ipapi.co/${normalizedIp}/json/`
  ]

  for (const provider of providers) {
    try {
      const response = await fetch(provider)
      if (!response.ok) continue
      const data: any = await response.json()

      const normalized = {
        country: data.country || data.country_name || undefined,
        region: data.region || data.regionName || data.region_name || undefined,
        city: data.city || undefined,
        latitude: typeof data.latitude === 'number' ? data.latitude : (typeof data.lat === 'number' ? data.lat : undefined),
        longitude: typeof data.longitude === 'number' ? data.longitude : (typeof data.lon === 'number' ? data.lon : undefined)
      }

      if (normalized.city || normalized.region || normalized.country) {
        geolocationCache.set(normalizedIp, { fetchedAt: now, data: normalized })
        return normalized
      }
    } catch {
      // tenta próximo provider
    }
  }

  return {} as {
    country?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
  }
}

const extractClientIp = (req: any) => {
  const candidates = [
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.headers['cf-connecting-ip'],
    req.headers['x-client-ip'],
    req.headers['x-forwarded'],
    req.ip,
    req.socket?.remoteAddress
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeIp(candidate.split(',')[0].trim())
    }
  }
  return ''
}

const getClientLocationFromHeaders = (req: any) => {
  const parseHeaderNumber = (value: unknown) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const readHeaderString = (value: unknown) => {
    const str = Array.isArray(value) ? value[0] : value
    return typeof str === 'string' && str.trim() ? str.trim() : undefined
  }

  return {
    latitude: parseHeaderNumber(req.headers['x-client-latitude']),
    longitude: parseHeaderNumber(req.headers['x-client-longitude']),
    city: readHeaderString(req.headers['x-client-city']),
    region: readHeaderString(req.headers['x-client-region']),
    country: readHeaderString(req.headers['x-client-country'])
  }
}

const normalizeSeverity = (severity?: string) => {
  const value = (severity || '').toLowerCase()
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') return value
  if (value === 'baixa' || value === 'baixo') return 'low'
  if (value === 'media' || value === 'média' || value === 'medio' || value === 'médio') return 'medium'
  if (value === 'alta' || value === 'high') return 'high'
  return 'medium'
}

const normalizeRole = (role?: string) => {
  const value = (role || '').toLowerCase()
  if (value === 'admin' || value === 'secretary' || value === 'user' || value === 'system') return value
  if (value.includes('admin')) return 'admin'
  if (value.includes('secret')) return 'secretary'
  if (value.includes('user')) return 'user'
  return 'system'
}

const getActionLabel = (action?: string, fallback?: string) => {
  if (fallback) return fallback
  const raw = action || ''
  const key = raw.toUpperCase()
  const map: Record<string, string> = {
    LOGIN: 'Login realizado',
    LOGOUT: 'Logout realizado',
    LOGIN_FAILED: 'Tentativa de acesso inválida',
    CREATE_APPOINTMENT: 'Agendamento criado',
    UPDATE_APPOINTMENT: 'Agendamento atualizado',
    UPDATE_APPOINTMENT_STATUS: 'Status de agendamento alterado',
    DELETE_APPOINTMENT: 'Agendamento excluído',
    CREATE_USER: 'Usuário criado',
    UPDATE_USER: 'Usuário atualizado',
    DELETE_USER: 'Usuário excluído',
    CREATE_LOCATION: 'Local de atendimento criado',
    UPDATE_LOCATION: 'Local de atendimento alterado',
    DELETE_LOCATION: 'Local de atendimento excluído',
    CREATE_LOCALITY: 'Localidade criada',
    UPDATE_LOCALITY: 'Localidade alterada',
    DELETE_LOCALITY: 'Localidade excluída',
    CREATE_NEIGHBORHOOD: 'Bairro criado',
    UPDATE_NEIGHBORHOOD: 'Bairro alterado',
    DELETE_NEIGHBORHOOD: 'Bairro excluído',
    CANCEL_APPOINTMENT: 'Agendamento cancelado',
    UPDATE_SYSTEM_CONFIG: 'Configuração do sistema alterada',
    appointment_created: 'Agendamento criado',
    appointment_updated: 'Agendamento atualizado',
    appointment_deleted: 'Agendamento excluído',
    appointment_status_changed: 'Status do agendamento alterado',
    appointment_rescheduled: 'Agendamento reagendado',
    appointment_cancelled: 'Agendamento cancelado',
    appointment_note_added: 'Nota adicionada',
    appointment_note_deleted: 'Nota removida',
    appointment_priority_changed: 'Prioridade alterada',
    appointment_bulk_deleted: 'Exclusão em massa de agendamentos',
    location_created: 'Localidade criada',
    location_updated: 'Localidade atualizada',
    location_deleted: 'Localidade excluída',
    user_created: 'Usuário criado',
    user_updated: 'Usuário atualizado',
    user_deleted: 'Usuário excluído',
    user_login: 'Login realizado',
    user_logout: 'Logout realizado',
    blocked_date_created: 'Data bloqueada',
    blocked_date_deleted: 'Bloqueio removido',
    config_updated: 'Configuração atualizada',
    data_exported: 'Dados exportados',
    data_imported: 'Dados importados',
    report_generated: 'Relatório gerado',
    report_template_created: 'Template criado',
    report_template_updated: 'Template atualizado',
    report_template_deleted: 'Template excluído',
    scheduled_report_created: 'Agendamento de relatório criado',
    scheduled_report_updated: 'Agendamento de relatório atualizado',
    scheduled_report_deleted: 'Agendamento de relatório excluído',
    rg_marked_as_delivered: 'CIN marcada como entregue',
    rg_notification_sent: 'Notificação de CIN enviada',
    reminder_sent: 'Lembrete enviado',
    system_settings_changed: 'Configurações do sistema alteradas'
  }
  return map[key] || map[raw] || map[raw.toLowerCase()] || action || 'Ação registrada'
}

const getActionSeverity = (action?: string, currentSeverity?: string) => {
  const key = (action || '').toUpperCase()
  if (key.includes('LOGIN_FAILED') || key.includes('INVALID_ACCESS') || key.includes('ACCESS_DENIED')) {
    return 'critical'
  }
  return normalizeSeverity(currentSeverity || 'medium')
}

const mapAuditLog = (row: any) => {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const payloadGeo = payload.geolocation && typeof payload.geolocation === 'object' ? payload.geolocation : {}
  const action = payload.action || row.action || 'unknown_action'
  const severity = getActionSeverity(action, payload.severity || row.severity)
  const normalizedIp = normalizeIp(payload.ipAddress || row.ip_address || '')

  return {
    id: String(row.id),
    action,
    actionLabel: getActionLabel(action, payload.actionLabel || row.action_label),
    description: payload.description || row.description || '',
    performedBy: payload.performedBy || row.performed_by || row.user_name || row.user_email || 'Sistema',
    performedByRole: normalizeRole(payload.performedByRole || row.performed_by_role || row.user_role),
    performedAt: payload.performedAt || (row.performed_at ? new Date(row.performed_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString())),
    targetType: payload.targetType || row.target_type || row.entity_type || 'system',
    targetId: payload.targetId || row.target_id || row.entity_id || undefined,
    targetName: payload.targetName || row.target_name || undefined,
    severity,
    oldValue: payload.oldValue ?? row.old_value ?? row.old_values ?? undefined,
    newValue: payload.newValue ?? row.new_value ?? row.new_values ?? undefined,
    changes: payload.changes ?? row.changes ?? undefined,
    ipAddress: normalizedIp || undefined,
    country: payload.country || row.country || payloadGeo.country || undefined,
    region: payload.region || row.region || payloadGeo.region || undefined,
    city: payload.city || row.city || payloadGeo.city || undefined,
    latitude: payload.latitude ?? row.latitude ?? payloadGeo.latitude ?? undefined,
    longitude: payload.longitude ?? row.longitude ?? payloadGeo.longitude ?? undefined,
    userAgent: payload.userAgent || row.user_agent || undefined,
    sessionId: payload.sessionId || row.session_id || undefined,
    requestId: payload.requestId || row.request_id || undefined,
    status: payload.status || row.status || 'success',
    errorMessage: payload.errorMessage || row.error_message || undefined,
    metadata: payload.metadata || row.metadata || undefined,
    tags: Array.isArray(payload.tags) ? payload.tags : (row.tags || []),
    isReversible: payload.isReversible ?? false,
    reversedAt: payload.reversedAt || undefined,
    reversedBy: payload.reversedBy || undefined,
  }
}

router.post('/audit-logs/normalize', async (_req, res) => {
  try {
    await ensureAuditLogsSchema()
    await cleanupOldAuditLogsIfNeeded()
    const publicIp = await getPublicIpCached()

    await pool.query(`
      UPDATE audit_logs
         SET severity = CASE
           WHEN LOWER(COALESCE(severity, '')) IN ('baixo', 'baixa', 'low') THEN 'LOW'
           WHEN LOWER(COALESCE(severity, '')) IN ('medio', 'médio', 'media', 'média', 'medium') THEN 'MEDIUM'
           WHEN LOWER(COALESCE(severity, '')) IN ('alta', 'high') THEN 'HIGH'
           WHEN LOWER(COALESCE(severity, '')) IN ('critica', 'crítica', 'critical') THEN 'CRITICAL'
           ELSE 'MEDIUM'
         END
       WHERE severity IS NOT NULL
    `)

    await pool.query(`
      UPDATE audit_logs
         SET ip_address = REGEXP_REPLACE(ip_address, '^::ffff:', '')
       WHERE ip_address LIKE '::ffff:%'
    `)

    if (publicIp) {
      await pool.query(
        `UPDATE audit_logs
            SET ip_address = $1
          WHERE ip_address IN ('::1', '127.0.0.1', '1', '::ffff:127.0.0.1')
             OR ip_address LIKE '10.%'
             OR ip_address LIKE '192.168.%'
             OR ip_address LIKE '172.16.%'
             OR ip_address LIKE '172.17.%'
             OR ip_address LIKE '172.18.%'
             OR ip_address LIKE '172.19.%'
             OR ip_address LIKE '172.2%.%'
             OR ip_address LIKE '172.30.%'
             OR ip_address LIKE '172.31.%'`,
        [publicIp]
      )

      const geo = await getGeolocationByIp(publicIp)
      if (geo.city || geo.region || geo.country) {
        await pool.query(
          `UPDATE audit_logs
              SET country = COALESCE(country, $1),
                  region = COALESCE(region, $2),
                  city = COALESCE(city, $3),
                  latitude = COALESCE(latitude, $4),
                  longitude = COALESCE(longitude, $5)
            WHERE ip_address = $6`,
          [
            geo.country || null,
            geo.region || null,
            geo.city || null,
            geo.latitude ?? null,
            geo.longitude ?? null,
            publicIp
          ]
        )
      }
    }

    await pool.query(`
      UPDATE audit_logs
         SET action_label = COALESCE(action_label, action)
       WHERE action_label IS NULL OR action_label = ''
    `)

    return res.json({ success: true, message: 'Logs normalizados com sucesso' })
  } catch (error) {
    console.error('[audit-logs] Erro ao normalizar:', error)
    return res.status(500).json({ message: 'Erro ao normalizar logs de auditoria' })
  }
})

router.get('/audit-logs', async (_req, res) => {
  try {
    await ensureAuditLogsSchema()
    await cleanupOldAuditLogsIfNeeded()
    const result = await pool.query(`
      SELECT *
      FROM audit_logs
      ORDER BY COALESCE(performed_at, created_at) DESC, created_at DESC
      LIMIT 5000
    `)
    return res.json(result.rows.map(mapAuditLog))
  } catch (error) {
    console.error('[audit-logs] Erro ao listar:', error)
    return res.status(500).json({ message: 'Erro ao carregar logs de auditoria' })
  }
})

router.delete('/audit-logs', async (_req, res) => {
  try {
    await ensureAuditLogsSchema()
    await cleanupOldAuditLogsIfNeeded()
    const result = await pool.query('DELETE FROM audit_logs')
    return res.json({
      success: true,
      deletedCount: result.rowCount || 0,
      message: 'Todos os logs de auditoria foram removidos'
    })
  } catch (error) {
    console.error('[audit-logs] Erro ao limpar:', error)
    return res.status(500).json({ message: 'Erro ao limpar logs de auditoria' })
  }
})

router.post('/audit-logs', async (req, res) => {
  try {
    await ensureAuditLogsSchema()
    await cleanupOldAuditLogsIfNeeded()
    const payload = auditPayloadSchema.parse(req.body || {})

    let ipAddress = normalizeIp(payload.ipAddress || extractClientIp(req) || '')
    if (isPrivateOrLoopbackIp(ipAddress)) {
      const publicIp = await getPublicIpCached()
      if (publicIp) {
        ipAddress = publicIp
      }
    }
    const geolocationByIp = await getGeolocationByIp(ipAddress)
    const geolocationFromHeaders = getClientLocationFromHeaders(req)
    const geolocation = {
      country: geolocationFromHeaders.country || geolocationByIp.country,
      region: geolocationFromHeaders.region || geolocationByIp.region,
      city: geolocationFromHeaders.city || geolocationByIp.city,
      latitude: geolocationFromHeaders.latitude ?? geolocationByIp.latitude,
      longitude: geolocationFromHeaders.longitude ?? geolocationByIp.longitude
    }
    const userAgent = payload.userAgent || req.headers['user-agent'] || ''
    const action = payload.action
    const severity = getActionSeverity(action, payload.severity)

    const metadata = {
      ...(payload.metadata || {}),
      module: payload.metadata?.module || payload.targetType || 'system',
      requestPath: req.originalUrl,
      geolocation
    }

    const result = await pool.query(
      `INSERT INTO audit_logs (
        action, action_label, description, performed_by, performed_by_role, performed_at,
        target_type, target_id, target_name, severity, old_value, new_value, changes,
        metadata, tags, ip_address, user_agent, session_id, payload, status, error_message,
        action_category, entity_type, entity_id, old_values, new_values, user_name, user_email, user_role, request_id,
        country, region, city, latitude, longitude
      ) VALUES (
        $1, $2, $3, $4, $5, $6::timestamptz,
        $7, $8, $9, UPPER($10), $11::jsonb, $12::jsonb, $13::jsonb,
        $14::jsonb, $15::text[], $16, $17, $18, $19::jsonb, $20, $21,
        $22, $23, $24, $25::jsonb, $26::jsonb, $27, $28, $29, $30,
        $31, $32, $33, $34, $35
      )
      RETURNING *`,
      [
        action,
        getActionLabel(action, payload.actionLabel),
        payload.description || '',
        payload.performedBy || 'Sistema',
        normalizeRole(payload.performedByRole),
        toIsoOrNow(payload.performedAt),
        payload.targetType || 'system',
        payload.targetId || null,
        payload.targetName || null,
        severity,
        JSON.stringify(payload.oldValue ?? null),
        JSON.stringify(payload.newValue ?? null),
        JSON.stringify(payload.changes || null),
        JSON.stringify(metadata),
        payload.tags || [],
        ipAddress || null,
        userAgent || null,
        payload.sessionId || null,
        JSON.stringify({
          ...payload,
          severity,
          ipAddress,
          userAgent,
          metadata
        }),
        payload.status || 'success',
        payload.errorMessage || null,
        payload.targetType || 'SYSTEM',
        payload.targetType || 'system',
        payload.targetId || null,
        JSON.stringify(payload.oldValue ?? null),
        JSON.stringify(payload.newValue ?? null),
        payload.performedBy || 'Sistema',
        null,
        normalizeRole(payload.performedByRole),
        req.headers['x-request-id'] || null,
        geolocation.country || null,
        geolocation.region || null,
        geolocation.city || null,
        geolocation.latitude ?? null,
        geolocation.longitude ?? null
      ]
    )

    return res.status(201).json(mapAuditLog(result.rows[0]))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Dados inválidos' })
    }
    console.error('[audit-logs] Erro ao registrar:', error)
    return res.status(500).json({ message: 'Erro ao registrar log de auditoria' })
  }
})

export default router

