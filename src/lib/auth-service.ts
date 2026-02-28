import { api } from './api'
import type { SecretaryUser, SuperAdmin } from './types'
import { usersService, type TenantRequestContext, type UserApiResponse } from './users-service'

const buildTenantOptions = (context?: TenantRequestContext) => {
  if (!context) {
    return undefined
  }

  const headers: Record<string, string> = {}
  if (context.tenantId) {
    headers['x-tenant-id'] = context.tenantId
  }
  if (context.tenantSlug) {
    headers['x-prefeitura-slug'] = context.tenantSlug
  }

  return {
    headers
  }
}

interface SuperAdminLoginResponse {
  success: boolean
  token: string
  tenantId: number
  user?: {
    id?: number
    name?: string
    nome?: string
    email?: string
    role?: string
    tenantId?: number
    permissions?: string[]
    createdAt?: string
  }
}

interface SecretaryLoginResponse {
  success?: boolean
  token?: string
  user?: SecretaryUser
}

export const authService = {
  loginSuperAdmin: async (email: string, password: string): Promise<SuperAdmin> => {
    const payload = {
      email: email.trim().toLowerCase(),
      password: password.trim()
    }

    const response = await api.post<SuperAdminLoginResponse>('/super-admin/login', payload, {
      skipAuthHeaders: true
    })

    if (!response.success || !response.user) {
      throw new Error('Resposta inválida do servidor de autenticação.')
    }

    const { id, name, nome, email: userEmail, role, tenantId: userTenantId, permissions, createdAt } = response.user

    if (typeof id !== 'number') {
      throw new Error('Resposta inválida: ID do administrador não encontrado.')
    }

    const resolvedEmail = userEmail || payload.email
    const resolvedName = name || nome || resolvedEmail || 'Administrador Geral'

    return {
      id: String(id),
      fullName: resolvedName,
      email: resolvedEmail,
      createdAt: createdAt || new Date().toISOString(),
      token: response.token,
      tenantId: userTenantId ?? response.tenantId,
      role,
      permissions
    }
  },
  loginTenantUser: async (
    identifier: string,
    password: string,
    context?: TenantRequestContext
  ): Promise<SecretaryUser> => {
    const payload = {
      username: identifier.trim(),
      password: password.trim()
    }

    try {
      const response = await api.post<SecretaryLoginResponse | SecretaryUser>('/secretary-users/login', payload, buildTenantOptions(context))
      const resolvedToken = (response as SecretaryLoginResponse)?.token
      const resolvedUser = (response as SecretaryLoginResponse)?.user || (response as SecretaryUser)

      if (resolvedToken && typeof window !== 'undefined') {
        localStorage.setItem('token', resolvedToken)
      }

      return {
        ...resolvedUser,
        adminType: resolvedUser.adminType || (resolvedUser.isAdmin ? 'system' : 'none'),
        permissions: {
          ...(resolvedUser.permissions || {}),
          allowedLocationIds: Array.isArray(resolvedUser.permissions?.allowedLocationIds)
            ? resolvedUser.permissions?.allowedLocationIds.map((value) => String(value))
            : []
        }
      }
    } catch {
      const legacyPayload = {
        identifier: identifier.trim().toLowerCase(),
        senha: password.trim()
      }
      const response = await api.post<UserApiResponse>('/users/login', legacyPayload, buildTenantOptions(context))
      return usersService.mapApiUser(response)
    }
  }
}
