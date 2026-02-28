import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../config/db'
import tenantMiddleware, { type TenantRequest } from '../middleware/tenantMiddleware'
import { createAuditLog as createServerAuditLog } from '../services/audit.service'

const router = Router()
// TEMPORARIAMENTE DESABILITADO PARA TESTE
// router.use(tenantMiddleware)

const requiredString = (message: string) => z.string().trim().min(1, message)

const locationBaseSchema = z.object({
  nome: requiredString('Informe o nome do local'),
  endereco: requiredString('Informe o endereço completo'),
  linkMapa: z
    .string()
    .trim()
    .max(4000, 'Link muito longo')
    .nullable()
    .optional()
})

const createLocationSchema = locationBaseSchema
const updateLocationSchema = locationBaseSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  'Nenhum dado para atualizar'
)

const localityBaseSchema = z.object({
  nome: requiredString('Informe o nome da localidade')
})

const createLocalitySchema = localityBaseSchema
const updateLocalitySchema = localityBaseSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  'Nenhum dado para atualizar'
)

const createNeighborhoodSchema = z.object({
  localidadeId: z.number().int().positive('Localidade inválida'),
  nome: requiredString('Informe o nome do bairro')
})

const updateNeighborhoodSchema = z
  .object({
    nome: requiredString('Informe o nome do bairro')
  })
  .refine((data) => Object.keys(data).length > 0, 'Nenhum dado para atualizar')

interface ServiceLocationRow {
  id: number
  prefeitura_id: number
  nome?: string
  nome_local?: string
  endereco: string | null
  link_mapa?: string | null
  ativo?: boolean
  google_maps_url?: string | null
  is_active?: boolean
  criado_em?: string
}

interface LocalityRow {
  id: number
  prefeitura_id: number
  nome: string
  criado_em: string
}

interface NeighborhoodRow {
  id: number
  prefeitura_id: number
  localidade_id: number
  nome: string
  criado_em: string
}

const mapServiceLocation = (row: ServiceLocationRow) => ({
  id: row.id,
  name: row.nome || row.nome_local || '',
  address: row.endereco || '',
  googleMapsUrl: row.link_mapa || row.google_maps_url || undefined,
  isActive: row.ativo ?? row.is_active ?? true,
  createdAt: row.criado_em || new Date().toISOString()
})

const mapLocality = (row: LocalityRow) => ({
  id: row.id,
  name: row.nome,
  createdAt: row.criado_em
})

const mapNeighborhood = (row: NeighborhoodRow) => ({
  id: row.id,
  localityId: row.localidade_id,
  name: row.nome,
  createdAt: row.criado_em
})

const isUndefinedTableError = (error: unknown, table: string) => {
  const pgError = error as { code?: string }
  return pgError?.code === '42P01'
}

let legacyColumnsEnsured = false
const ensureLegacyColumns = async () => {
  if (legacyColumnsEnsured) {
    return
  }
  let success = true
  try {
    await pool.query('ALTER TABLE localidades_origem ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await pool.query('ALTER TABLE bairros ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await pool.query('ALTER TABLE bairros ADD COLUMN IF NOT EXISTS prefeitura_id INT REFERENCES prefeituras(id) ON DELETE CASCADE')
    await pool.query('ALTER TABLE bairros ADD COLUMN IF NOT EXISTS localidade_id INT REFERENCES localidades_origem(id) ON DELETE CASCADE')
    await pool.query(`
      UPDATE bairros b
         SET prefeitura_id = l.prefeitura_id
        FROM localidades_origem l
       WHERE b.localidade_id = l.id
         AND (b.prefeitura_id IS NULL OR b.prefeitura_id = 0)
    `)
  } catch (error) {
    success = false
    console.warn('[locations] Falha ao garantir colunas legadas', error)
  } finally {
    legacyColumnsEnsured = success
  }
}

class TenantMissingError extends Error {
  constructor() {
    super('TenantId ausente na requisição')
    this.name = 'TenantMissingError'
  }
}

const ensureTenantId = (req: TenantRequest): number => {
  // HARDCODED PARA TESTE
  return 1
  
  /* ORIGINAL:
  const rawTenantId = (req as TenantRequest).tenantId
  const tenantId = typeof rawTenantId === 'string' ? Number(rawTenantId) : rawTenantId

  if (!tenantId || Number.isNaN(tenantId)) {
    throw new TenantMissingError()
  }

  return tenantId
  */
}

const normalizeOptionalLink = (link?: string | null) => {
  if (!link) {
    return null
  }
  const trimmed = link.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parseIdParam = (value: string) => {
  const id = Number.parseInt(value, 10)
  if (Number.isNaN(id)) {
    throw new Error('ID inválido')
  }
  return id
}

const getActor = (req: TenantRequest) => {
  const anyReq = req as any
  const user = anyReq.user || {}
  return {
    userId: user.id || null,
    userEmail: user.email || null,
    userName: user.name || user.email || 'Administrador',
    userRole: user.role || 'SECRETARY'
  }
}

const buildAuditDescription = (
  actorName: string,
  detailedAction: string,
  targetWithIdentifier: string,
  frontendTab: string
) => `O usuário ${actorName} ${detailedAction} do cidadão/item ${targetWithIdentifier}, pela aba ${frontendTab}.`

const handleUniqueViolation = (error: unknown) => {
  const pgError = error as { code?: string; constraint?: string }
  if (pgError?.code === '23505') {
    if (pgError.constraint?.includes('localidades_origem_unique')) {
      const err = new Error('Já existe uma localidade com esse nome')
      err.name = 'UniqueViolation'
      throw err
    }
    if (pgError.constraint?.includes('bairros_unique')) {
      const err = new Error('Já existe um bairro com esse nome para esta localidade')
      err.name = 'UniqueViolation'
      throw err
    }
  }
}

router.get('/locais-atendimento', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const result = await pool.query<ServiceLocationRow>(
      `SELECT id, prefeitura_id, nome_local as nome, endereco, link_mapa, ativo, criado_em
         FROM locais_atendimento
        WHERE prefeitura_id = $1
        ORDER BY nome_local ASC`,
      [tenantId]
    )
    res.json(result.rows.map(mapServiceLocation))
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

router.post('/locais-atendimento', async (req, res, next) => {
  console.log('[locais-atendimento] POST recebido', {
    body: req.body,
    tenantId: (req as TenantRequest).tenantId
  })

  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const payload = createLocationSchema.parse(req.body)
    const linkValue = normalizeOptionalLink(payload.linkMapa ?? null)
    const isActive = typeof req.body?.ativo === 'boolean' ? req.body.ativo : true

    const insertQuery =
      'INSERT INTO locais_atendimento (prefeitura_id, nome_local, endereco, link_mapa, ativo) VALUES ($1, $2, $3, $4, $5) RETURNING *, nome_local as nome'

    const result = await pool.query<ServiceLocationRow>(insertQuery, [
      tenantId,
      payload.nome.trim(),
      payload.endereco.trim(),
      linkValue,
      isActive
    ])

    const created = mapServiceLocation(result.rows[0])
    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'CREATE_LOCATION',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'criou o local de atendimento',
        `${created.name} (ID: ${created.id})`,
        'Localidades'
      ),
      severity: 'MEDIUM',
      entityType: 'location',
      entityId: String(created.id),
      newValues: created,
      status: 'success'
    }, req)

    res.status(201).json(created)
  } catch (error) {
    console.error('ERRO SQL GRAVE:', error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    next(error)
  }
})

router.put('/locais-atendimento/:id', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const locationId = parseIdParam(req.params.id)
    const payload = updateLocationSchema.parse(req.body)
    const isActive = typeof req.body?.ativo === 'boolean' ? req.body.ativo : undefined

    const fields: string[] = []
    const values: unknown[] = []
    let index = 1

    if (payload.nome !== undefined) {
      fields.push(`nome_local = $${index++}`)
      values.push(payload.nome.trim())
    }
    if (payload.endereco !== undefined) {
      fields.push(`endereco = $${index++}`)
      values.push(payload.endereco.trim())
    }
    if (payload.linkMapa !== undefined) {
      fields.push(`link_mapa = $${index++}`)
      values.push(normalizeOptionalLink(payload.linkMapa))
    }
    if (isActive !== undefined) {
      fields.push(`ativo = $${index++}`)
      values.push(isActive)
    }

    if (fields.length === 0) {
      res.status(400).json({ message: 'Nenhum dado para atualizar' })
      return
    }

    values.push(tenantId)
    values.push(locationId)

    const beforeResult = await pool.query<ServiceLocationRow>(
      'SELECT id, prefeitura_id, nome_local as nome, endereco, link_mapa, ativo, criado_em FROM locais_atendimento WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, locationId]
    )
    const beforeLocation = beforeResult.rows[0] ? mapServiceLocation(beforeResult.rows[0]) : null

    const result = await pool.query<ServiceLocationRow>(
      `UPDATE locais_atendimento
          SET ${fields.join(', ')}
        WHERE prefeitura_id = $${index++} AND id = $${index}
        RETURNING *, nome_local as nome`,
      values
    )

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Local não encontrado' })
      return
    }

    const updated = mapServiceLocation(result.rows[0])
    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'UPDATE_LOCATION',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'alterou o local de atendimento',
        `${updated.name} (ID: ${updated.id})`,
        'Localidades'
      ),
      severity: updated.isActive === false ? 'HIGH' : 'MEDIUM',
      entityType: 'location',
      entityId: String(updated.id),
      oldValues: beforeLocation,
      newValues: updated,
      status: 'success'
    }, req)

    res.json(updated)
  } catch (error) {
    console.error(
      '[locais-atendimento] Erro no PUT:',
      error instanceof Error ? error.message : String(error)
    )
    if (error instanceof TenantMissingError || error instanceof Error) {
      if (error.message === 'ID inválido' || error instanceof TenantMissingError) {
        res.status(400).json({ message: error.message })
        return
      }
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    next(error)
  }
})

router.delete('/locais-atendimento/:id', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const locationId = parseIdParam(req.params.id)

    // Verificar se existem agendamentos vinculados a este local
    const checkAgendamentos = await pool.query(
      'SELECT COUNT(*) as total FROM agendamentos WHERE prefeitura_id = $1 AND local_id = $2',
      [tenantId, locationId]
    )
    
    const totalAgendamentos = parseInt(checkAgendamentos.rows[0]?.total || '0')
    
    if (totalAgendamentos > 0) {
      res.status(400).json({ 
        message: `Não é possível excluir este local pois existem ${totalAgendamentos} agendamento(s) vinculado(s) a ele. Cancele ou conclua os agendamentos primeiro.`
      })
      return
    }

    const beforeResult = await pool.query<ServiceLocationRow>(
      'SELECT id, prefeitura_id, nome_local as nome, endereco, link_mapa, ativo, criado_em FROM locais_atendimento WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, locationId]
    )
    const beforeLocation = beforeResult.rows[0] ? mapServiceLocation(beforeResult.rows[0]) : null

    const result = await pool.query('DELETE FROM locais_atendimento WHERE prefeitura_id = $1 AND id = $2', [
      tenantId,
      locationId
    ])

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Local não encontrado' })
      return
    }

    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'DELETE_LOCATION',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'excluiu o local de atendimento',
        `${beforeLocation?.name || 'Não identificado'} (ID: ${locationId})`,
        'Localidades'
      ),
      severity: 'CRITICAL',
      entityType: 'location',
      entityId: String(locationId),
      oldValues: beforeLocation,
      status: 'success'
    }, req)

    res.status(204).send()
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof Error && error.message === 'ID inválido') {
      res.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

router.get('/localidades-origem', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    await ensureLegacyColumns()
    const result = await pool.query<LocalityRow>(
      `SELECT id, prefeitura_id, nome, criado_em
         FROM localidades_origem
        WHERE prefeitura_id = $1
        ORDER BY nome ASC`,
      [tenantId]
    )

    res.json(result.rows.map(mapLocality))
  } catch (error) {
    console.error(error)
    if (isUndefinedTableError(error, 'localidades_origem')) {
      console.warn('[localidades-origem] Tabela não encontrada. Execute a migration 003_enderecos_e_locais.sql para habilitar sedes/distritos.')
      res.json([])
      return
    }
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

router.post('/localidades-origem', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    await ensureLegacyColumns()
    const payload = createLocalitySchema.parse(req.body)

    const result = await pool.query<LocalityRow>(
      `INSERT INTO localidades_origem (prefeitura_id, nome)
       VALUES ($1, $2)
       RETURNING id, prefeitura_id, nome, criado_em`,
      [tenantId, payload.nome]
    )

    const created = mapLocality(result.rows[0])
    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'CREATE_LOCALITY',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'criou a localidade',
        `${created.name} (ID: ${created.id})`,
        'Localidades'
      ),
      severity: 'MEDIUM',
      entityType: 'locality',
      entityId: String(created.id),
      newValues: created,
      status: 'success'
    }, req)
    res.status(201).json(created)
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    try {
      handleUniqueViolation(error)
    } catch (uniqueError) {
      res.status(409).json({ message: (uniqueError as Error).message })
      return
    }
    next(error)
  }
})

router.patch('/localidades-origem/:id', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const localityId = parseIdParam(req.params.id)
    await ensureLegacyColumns()
    const payload = updateLocalitySchema.parse(req.body)

    const beforeResult = await pool.query<LocalityRow>(
      'SELECT id, prefeitura_id, nome, criado_em FROM localidades_origem WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, localityId]
    )
    const beforeLocality = beforeResult.rows[0] ? mapLocality(beforeResult.rows[0]) : null

    const result = await pool.query<LocalityRow>(
      `UPDATE localidades_origem
          SET nome = $1
        WHERE prefeitura_id = $2 AND id = $3
        RETURNING id, prefeitura_id, nome, criado_em`,
      [payload.nome?.trim(), tenantId, localityId]
    )

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Localidade não encontrada' })
      return
    }

    const updated = mapLocality(result.rows[0])
    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'UPDATE_LOCALITY',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'alterou a localidade',
        `${updated.name} (ID: ${updated.id})`,
        'Localidades'
      ),
      severity: 'MEDIUM',
      entityType: 'locality',
      entityId: String(updated.id),
      oldValues: beforeLocality,
      newValues: updated,
      status: 'success'
    }, req)
    res.json(updated)
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    if (error instanceof Error && error.message === 'ID inválido') {
      res.status(400).json({ message: error.message })
      return
    }
    try {
      handleUniqueViolation(error)
    } catch (uniqueError) {
      res.status(409).json({ message: (uniqueError as Error).message })
      return
    }
    next(error)
  }
})

router.delete('/localidades-origem/:id', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const localityId = parseIdParam(req.params.id)
    await ensureLegacyColumns()

    const beforeResult = await pool.query<LocalityRow>(
      'SELECT id, prefeitura_id, nome, criado_em FROM localidades_origem WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, localityId]
    )
    const beforeLocality = beforeResult.rows[0] ? mapLocality(beforeResult.rows[0]) : null

    const result = await pool.query('DELETE FROM localidades_origem WHERE prefeitura_id = $1 AND id = $2', [
      tenantId,
      localityId
    ])

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Localidade não encontrada' })
      return
    }

    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'DELETE_LOCALITY',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'excluiu a localidade',
        `${beforeLocality?.name || 'Não identificado'} (ID: ${localityId})`,
        'Localidades'
      ),
      severity: 'HIGH',
      entityType: 'locality',
      entityId: String(localityId),
      oldValues: beforeLocality,
      status: 'success'
    }, req)
    res.status(204).send()
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof Error && error.message === 'ID inválido') {
      res.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

router.get('/localidades-origem/:id/bairros', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const localityId = parseIdParam(req.params.id)
    await ensureLegacyColumns()

    const result = await pool.query<NeighborhoodRow>(
      `SELECT id, prefeitura_id, localidade_id, nome, criado_em
         FROM bairros
        WHERE prefeitura_id = $1 AND localidade_id = $2
        ORDER BY nome ASC`,
      [tenantId, localityId]
    )

    res.json(result.rows.map(mapNeighborhood))
  } catch (error) {
    console.error(error)
    if (isUndefinedTableError(error, 'bairros')) {
      console.warn('[bairros] Tabela não encontrada. Execute a migration 003_enderecos_e_locais.sql para habilitar bairros.')
      res.json([])
      return
    }
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof Error && error.message === 'ID inválido') {
      res.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

router.post('/bairros', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    await ensureLegacyColumns()
    const payload = createNeighborhoodSchema.parse(req.body)

    const localityResult = await pool.query(
      'SELECT id FROM localidades_origem WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, payload.localidadeId]
    )

    if (localityResult.rowCount === 0) {
      res.status(404).json({ message: 'Localidade não encontrada' })
      return
    }

    const result = await pool.query<NeighborhoodRow>(
      `INSERT INTO bairros (prefeitura_id, localidade_id, nome)
       VALUES ($1, $2, $3)
       RETURNING id, prefeitura_id, localidade_id, nome, criado_em`,
      [tenantId, payload.localidadeId, payload.nome]
    )

    const created = mapNeighborhood(result.rows[0])
    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'CREATE_NEIGHBORHOOD',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'criou o bairro',
        `${created.name} (ID: ${created.id})`,
        'Localidades'
      ),
      severity: 'MEDIUM',
      entityType: 'neighborhood',
      entityId: String(created.id),
      newValues: created,
      status: 'success'
    }, req)
    res.status(201).json(created)
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    try {
      handleUniqueViolation(error)
    } catch (uniqueError) {
      res.status(409).json({ message: (uniqueError as Error).message })
      return
    }
    next(error)
  }
})

router.patch('/bairros/:id', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const neighborhoodId = parseIdParam(req.params.id)
    await ensureLegacyColumns()
    const payload = updateNeighborhoodSchema.parse(req.body)

    const beforeResult = await pool.query<NeighborhoodRow>(
      'SELECT id, prefeitura_id, localidade_id, nome, criado_em FROM bairros WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, neighborhoodId]
    )
    const beforeNeighborhood = beforeResult.rows[0] ? mapNeighborhood(beforeResult.rows[0]) : null

    const result = await pool.query<NeighborhoodRow>(
      `UPDATE bairros
          SET nome = $1
        WHERE prefeitura_id = $2 AND id = $3
        RETURNING id, prefeitura_id, localidade_id, nome, criado_em`,
      [payload.nome.trim(), tenantId, neighborhoodId]
    )

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Bairro não encontrado' })
      return
    }

    const updated = mapNeighborhood(result.rows[0])
    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'UPDATE_NEIGHBORHOOD',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'alterou o bairro',
        `${updated.name} (ID: ${updated.id})`,
        'Localidades'
      ),
      severity: 'MEDIUM',
      entityType: 'neighborhood',
      entityId: String(updated.id),
      oldValues: beforeNeighborhood,
      newValues: updated,
      status: 'success'
    }, req)
    res.json(updated)
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') })
      return
    }
    if (error instanceof Error && error.message === 'ID inválido') {
      res.status(400).json({ message: error.message })
      return
    }
    try {
      handleUniqueViolation(error)
    } catch (uniqueError) {
      res.status(409).json({ message: (uniqueError as Error).message })
      return
    }
    next(error)
  }
})

router.delete('/bairros/:id', async (req, res, next) => {
  try {
    const tenantId = ensureTenantId(req as TenantRequest)
    const neighborhoodId = parseIdParam(req.params.id)
    await ensureLegacyColumns()

    const beforeResult = await pool.query<NeighborhoodRow>(
      'SELECT id, prefeitura_id, localidade_id, nome, criado_em FROM bairros WHERE prefeitura_id = $1 AND id = $2',
      [tenantId, neighborhoodId]
    )
    const beforeNeighborhood = beforeResult.rows[0] ? mapNeighborhood(beforeResult.rows[0]) : null

    const result = await pool.query('DELETE FROM bairros WHERE prefeitura_id = $1 AND id = $2', [
      tenantId,
      neighborhoodId
    ])

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Bairro não encontrado' })
      return
    }

    const actor = getActor(req as TenantRequest)
    await createServerAuditLog({
      ...actor,
      action: 'DELETE_NEIGHBORHOOD',
      actionCategory: 'LOCATION',
      description: buildAuditDescription(
        actor.userName,
        'excluiu o bairro',
        `${beforeNeighborhood?.name || 'Não identificado'} (ID: ${neighborhoodId})`,
        'Localidades'
      ),
      severity: 'HIGH',
      entityType: 'neighborhood',
      entityId: String(neighborhoodId),
      oldValues: beforeNeighborhood,
      status: 'success'
    }, req)
    res.status(204).send()
  } catch (error) {
    console.error(error)
    if (error instanceof TenantMissingError) {
      res.status(400).json({ message: error.message })
      return
    }
    if (error instanceof Error && error.message === 'ID inválido') {
      res.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
})

export default router
