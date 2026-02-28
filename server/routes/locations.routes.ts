import { Router } from 'express'
import { pool } from '../config/db'
import tenantMiddleware, { type TenantRequest } from '../middleware/tenantMiddleware'

const router = Router()

interface LocationRow {
  id: number
  name: string
  type: string
  parent_id: number | null
  active?: boolean | null
}

interface ServicePointRow {
  id: number
  name: string
  address: string
  active: boolean
}

interface LocalityDbRow {
  id: number
  nome: string
}

interface NeighborhoodDbRow {
  id: number
  localidade_id: number
  nome: string
}

const isSedeName = (value: string) => {
  if (!value) {
    return false
  }
  const normalized = value.toLowerCase()
  return normalized.includes('sede') || normalized.includes('matriz')
}

router.get('/api/admin/locations', async (_req, res) => {
  try {
    const locResult = await pool.query<LocationRow>(
      'SELECT id, name, type, parent_id FROM locations ORDER BY name ASC'
    )

    const nameById = new Map<number, string>(locResult.rows.map((row) => [row.id, row.name]))

    const addresses = locResult.rows.map((row) => ({
      id: row.id,
      nome: row.name,
      tipo: row.type,
      vinculo: row.parent_id ? nameById.get(row.parent_id) ?? null : null
    }))

    const serviceResult = await pool.query<ServicePointRow>(
      'SELECT id, name, address, active FROM service_points ORDER BY name ASC'
    )

    const servicePoints = serviceResult.rows.map((row) => ({
      id: row.id,
      nome: row.name,
      endereco: row.address,
      ativo: row.active
    }))

    res.json({ addresses, servicePoints })
  } catch (error) {
    console.error('Erro de SQL (Admin):', error)
    res.status(500).json({ error: 'Erro ao buscar dados do banco.' })
  }
})

router.get('/api/public/address-options', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = (req as TenantRequest).tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'Prefeitura não identificada' })
      return
    }

    const [localitiesResult, neighborhoodsResult] = await Promise.all([
      pool.query<LocalityDbRow>(
        `SELECT id, nome
           FROM localidades_origem
          WHERE prefeitura_id = $1
          ORDER BY nome ASC`,
        [tenantId]
      ),
      pool.query<NeighborhoodDbRow>(
        `SELECT id, localidade_id, nome
           FROM bairros
          WHERE prefeitura_id = $1
          ORDER BY nome ASC`,
        [tenantId]
      )
    ])

    const localities = localitiesResult.rows
    const sedeIds = new Set(localities.filter((item) => isSedeName(item.nome)).map((item) => item.id))

    const sedes = localities
      .filter((item) => sedeIds.has(item.id))
      .map((item) => ({ id: item.id, nome: item.nome }))

    const distritos = localities
      .filter((item) => !sedeIds.has(item.id))
      .map((item) => ({ id: item.id, nome: item.nome }))

    const bairros = neighborhoodsResult.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      localidadeId: row.localidade_id,
      isSede: sedeIds.has(row.localidade_id)
    }))

    res.json({ sedes, distritos, districts: distritos, bairros, neighborhoods: bairros })
  } catch (error) {
    console.error('Erro de SQL (Public):', error)
    res.status(500).json({ error: 'Erro ao carregar opções.' })
  }
})

export default router
