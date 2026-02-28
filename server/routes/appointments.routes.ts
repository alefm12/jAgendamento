import { Router } from 'express'
import { query } from '../config/db'
import { type AuthRequest } from '../middlewares/auth.middleware'

const router = Router()

const resolveTenantSlug = async (req: AuthRequest): Promise<string | null> => {
  const fromQuery = String(req.query?.tenantSlug || '').trim()
  if (fromQuery) return fromQuery

  const fromHeader = String(req.headers['x-prefeitura-slug'] || '').trim()
  if (fromHeader) return fromHeader

  const tenantId = Number(req.user?.tenantId)
  if (Number.isFinite(tenantId) && tenantId > 0) {
    const result = await query('SELECT slug FROM prefeituras WHERE id = $1 LIMIT 1', [tenantId])
    const slug = String(result.rows?.[0]?.slug || '').trim()
    if (slug) return slug
  }

  return null
}

router.get('/api/appointments', async (req: AuthRequest, res) => {
  try {
    const tenantSlug = await resolveTenantSlug(req)
    const status = String(req.query.status || '').trim()
    const locationId = String(req.query.locationId || req.query.localId || '').trim()
    const date = String(req.query.date || '').trim()
    const dateFrom = String(req.query.dateFrom || req.query.startDate || '').trim()
    const dateTo = String(req.query.dateTo || req.query.endDate || '').trim()

    const where: string[] = []
    const values: any[] = []
    let param = 1

    if (tenantSlug) {
      where.push(`tenant_slug = $${param++}`)
      values.push(tenantSlug)
    }

    if (status) {
      where.push(`UPPER(status) = UPPER($${param++})`)
      values.push(status)
    }

    if (locationId) {
      where.push(`location_id = $${param++}`)
      values.push(Number(locationId))
    }

    if (date) {
      where.push(`date = $${param++}`)
      values.push(date)
    } else {
      if (dateFrom) {
        where.push(`date >= $${param++}`)
        values.push(dateFrom)
      }
      if (dateTo) {
        where.push(`date <= $${param++}`)
        values.push(dateTo)
      }
    }

    const sql = `
      SELECT
        id,
        protocol,
        tenant_slug,
        service_id,
        location_id,
        date,
        time,
        status,
        citizen_name,
        citizen_cpf,
        citizen_birth,
        citizen_phone,
        citizen_mother,
        address_region,
        address_district_id,
        address_neighborhood_id,
        address_street,
        address_number,
        created_at,
        updated_at
      FROM appointments
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY date DESC, time DESC, id DESC
    `

    const result = await query(sql, values)

    const rows = result.rows.map((row: any) => ({
      id: String(row.id),
      protocol: row.protocol,
      tenantSlug: row.tenant_slug,
      serviceId: row.service_id != null ? String(row.service_id) : null,
      locationId: row.location_id != null ? String(row.location_id) : null,
      date: row.date,
      time: row.time,
      status: String(row.status || '').toLowerCase(),
      fullName: row.citizen_name,
      cpf: row.citizen_cpf,
      phone: row.citizen_phone,
      birthDate: row.citizen_birth,
      motherName: row.citizen_mother,
      regionName: row.address_region,
      districtId: row.address_district_id != null ? String(row.address_district_id) : null,
      neighborhoodId: row.address_neighborhood_id != null ? String(row.address_neighborhood_id) : null,
      street: row.address_street,
      number: row.address_number,
      createdAt: row.created_at,
      lastModified: row.updated_at,
      citizen_name: row.citizen_name,
      citizen_cpf: row.citizen_cpf,
      citizen_phone: row.citizen_phone,
      location_id: row.location_id,
      tenant_slug: row.tenant_slug
    }))

    return res.json(rows)
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error)
    return res.status(500).json({ error: 'Erro ao listar agendamentos.' })
  }
})

router.post('/api/appointments', async (req, res) => {
  try {
    const data = req.body

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const protocol = `RG-${dateStr}-${randomSuffix}`

    const sql = `
      INSERT INTO appointments (
        protocol, tenant_slug, service_id, location_id, date, time, status,
        citizen_name, citizen_cpf, citizen_birth, citizen_phone, citizen_mother,
        address_region, address_district_id, address_neighborhood_id, address_street, address_number
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'PENDENTE',
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16
      ) RETURNING *;
    `

    const values = [
      protocol,
      data.tenantSlug,
      data.serviceId,
      data.localId ? parseInt(data.localId, 10) : null,
      data.date,
      data.time,
      data.person?.nome,
      data.person?.cpf,
      data.person?.nascimento,
      data.person?.telefone,
      data.person?.mae,
      data.person?.regiao,
      data.person?.distritoId ? parseInt(data.person.distritoId, 10) : null,
      data.person?.bairroId ? parseInt(data.person.bairroId, 10) : null,
      data.person?.logradouro,
      data.person?.numero
    ]

    const result = await query(sql, values)
    return res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao salvar agendamento:', error)
    return res.status(500).json({ error: 'Erro ao processar agendamento.' })
  }
})

export default router
