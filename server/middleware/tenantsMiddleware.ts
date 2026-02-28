import { NextFunction, Request, Response } from 'express';
import { pool } from '../config/db';

export interface TenantRequest extends Request {
  tenantId?: number;
  tenantSlug?: string;
}

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantIdHeader = (req.headers['x-tenant-id'] as string | undefined)?.trim();
    const tenantSlugHeader = (req.headers['x-prefeitura-slug'] as string | undefined)?.trim();

    if (!tenantIdHeader && !tenantSlugHeader) {
      res.status(400).json({ message: 'Prefeitura não identificada' });
      return;
    }

    const queryConfig = tenantIdHeader
      ? {
          text: 'SELECT id, slug, ativo FROM prefeituras WHERE id = $1 LIMIT 1',
          values: [Number(tenantIdHeader)]
        }
      : {
          text: 'SELECT id, slug, ativo FROM prefeituras WHERE slug = $1 LIMIT 1',
          values: [tenantSlugHeader]
        };

    const result = await pool.query<{ id: number; slug: string; ativo: boolean }>(queryConfig);

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Prefeitura não encontrada' });
      return;
    }

    const prefeitura = result.rows[0];

    if (!prefeitura.ativo) {
      res.status(403).json({ message: 'Prefeitura inativa' });
      return;
    }

    (req as TenantRequest).tenantId = prefeitura.id;
    (req as TenantRequest).tenantSlug = prefeitura.slug;

    next();
  } catch (error) {
    next(error);
  }
};

export default tenantMiddleware;
