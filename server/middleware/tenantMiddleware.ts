import { type NextFunction, type Request, type Response } from 'express'
import { pool } from '../config/db'

export interface TenantRequest extends Request {
  tenantId?: number
  tenantSlug?: string
}

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantIdHeader = (req.headers['x-tenant-id'] as string | undefined)?.trim()
    const tenantSlugHeader = (req.headers['x-prefeitura-slug'] as string | undefined)?.trim()

    if (!tenantIdHeader && !tenantSlugHeader) {
      res.status(400).json({ message: 'Prefeitura não identificada' })
      return
    }

    // --- CORREÇÃO FINAL: Usando tabela 'prefeituras' e coluna 'ativo' ---
    const query = tenantIdHeader
      ? { text: 'SELECT id, slug, ativo FROM prefeituras WHERE id = $1', values: [Number(tenantIdHeader)] }
      : { text: 'SELECT id, slug, ativo FROM prefeituras WHERE slug = $1', values: [tenantSlugHeader] }

    const result = await pool.query<{ id: number; slug: string; ativo: boolean }>(query)

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Prefeitura não encontrada' })
      return
    }

    const tenant = result.rows[0]

    // Verifica se está ativo (booleano)
    if (!tenant.ativo) {
      res.status(403).json({ message: 'Prefeitura está inativa' })
      return
    }

    ;(req as TenantRequest).tenantId = tenant.id
    ;(req as TenantRequest).tenantSlug = tenant.slug

    next()
  } catch (error) {
    next(error)
  }
}

export default tenantMiddleware