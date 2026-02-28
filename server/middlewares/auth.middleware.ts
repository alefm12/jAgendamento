import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthRequest extends Request {
  user?: {
    id: number
    email: string
    name?: string
    role: string
    tenantId?: number
    tenantName?: string
    adminType?: 'system' | 'local' | 'none'
    permissions?: Record<string, any>
    isAdmin?: boolean
  }
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.substring(7)

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        tenantId: decoded.tenantId,
        tenantName: decoded.tenantName,
        adminType: decoded.adminType,
        permissions: decoded.permissions && typeof decoded.permissions === 'object' ? decoded.permissions : {},
        isAdmin: decoded.isAdmin === true
      }
    } catch {
      console.log('[AUTH] Token inválido ou expirado')
    }

    next()
  } catch (error) {
    console.error('[AUTH] Erro no middleware de autenticação:', error)
    next()
  }
}
