import axios, { isAxiosError } from 'axios'
import type { SecretaryUser } from './types'

export interface TenantRequestContext {
  tenantId?: string
  tenantSlug?: string
}

export interface UserApiResponse {
  id: number
  nome: string
  email: string
  cpf: string | null
  telefone: string | null
  perfil: string
  ativo: boolean
  criado_em: string
}

interface CreateUserInput extends Omit<SecretaryUser, 'id' | 'createdAt'> {
  password: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const USERS_ENDPOINT = `${API_BASE_URL}/users`

const getLocalStorageValue = (key: string) => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const buildRequestConfig = (context?: TenantRequestContext) => {
  const headers: Record<string, string> = {}

  if (context?.tenantId) {
    headers['x-tenant-id'] = context.tenantId
  } else {
    const storedTenantId = getLocalStorageValue('tenantId')
    if (storedTenantId) {
      headers['x-tenant-id'] = storedTenantId
    }
  }

  if (context?.tenantSlug) {
    headers['x-prefeitura-slug'] = context.tenantSlug
  } else if (!context?.tenantId) {
    const storedTenantSlug = getLocalStorageValue('tenantSlug')
    if (storedTenantSlug) {
      headers['x-prefeitura-slug'] = storedTenantSlug
    }
  }

  if (!headers['x-tenant-id']) {
    headers['x-tenant-id'] = '1'
  }

  return { headers }
}

const mapApiUser = (user: UserApiResponse): SecretaryUser => ({
  id: user.id.toString(),
  username: user.email,
  fullName: user.nome,
  email: user.email,
  cpf: user.cpf ?? undefined,
  phone: user.telefone ?? undefined,
  createdAt: user.criado_em,
  isAdmin: user.perfil?.toLowerCase() === 'admin',
  isActive: user.ativo
})

const sanitizeDigits = (value?: string) => (value ? value.replace(/\D/g, '') : '')

const toApiPayload = (input: Partial<CreateUserInput>) => {
  const payload: Record<string, unknown> = {}

  if (input.fullName !== undefined) {
    payload.nome = input.fullName.trim()
  }
  if (input.email !== undefined) {
    payload.email = input.email.trim().toLowerCase()
  }
  if (input.cpf !== undefined) {
    const digits = sanitizeDigits(input.cpf).slice(0, 11)
    if (digits) {
      payload.cpf = digits
    }
  }
  if (input.phone !== undefined) {
    const digits = sanitizeDigits(input.phone).slice(0, 11)
    if (digits) {
      payload.telefone = digits
    }
  }
  if (input.password !== undefined && input.password.trim()) {
    payload.senha = input.password
  }
  if (input.isAdmin !== undefined) {
    payload.perfil = input.isAdmin ? 'admin' : 'secretaria'
  }
  if (input.isActive !== undefined) {
    payload.ativo = input.isActive
  }

  return payload
}

const toUserServiceError = (error: unknown): Error => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    if (data?.message && typeof data.message === 'string') {
      return new Error(data.message)
    }
    return new Error('Falha ao comunicar com o serviço de usuários')
  }
  if (error instanceof Error) {
    return error
  }
  return new Error('Erro desconhecido ao processar a requisição de usuários')
}

const getUsers = async (context?: TenantRequestContext): Promise<SecretaryUser[]> => {
  try {
    const response = await axios.get<UserApiResponse[]>(`${USERS_ENDPOINT}`, buildRequestConfig(context))
    return response.data.map(mapApiUser)
  } catch (error) {
    throw toUserServiceError(error)
  }
}

const createUser = async (
  userData: CreateUserInput,
  context?: TenantRequestContext
): Promise<SecretaryUser> => {
  const payload = toApiPayload(userData)
  try {
    const response = await axios.post<UserApiResponse>(`${USERS_ENDPOINT}`, payload, buildRequestConfig(context))
    return mapApiUser(response.data)
  } catch (error) {
    throw toUserServiceError(error)
  }
}

const updateUser = async (
  userId: string,
  updates: Partial<SecretaryUser> & { password?: string },
  context?: TenantRequestContext
): Promise<SecretaryUser> => {
  const payload = toApiPayload(updates)
  try {
    const response = await axios.patch<UserApiResponse>(`${USERS_ENDPOINT}/${userId}`, payload, buildRequestConfig(context))
    return mapApiUser(response.data)
  } catch (error) {
    throw toUserServiceError(error)
  }
}

const deleteUser = async (userId: string, context?: TenantRequestContext): Promise<void> => {
  try {
    await axios.delete(`${USERS_ENDPOINT}/${userId}`, buildRequestConfig(context))
  } catch (error) {
    throw toUserServiceError(error)
  }
}

export const usersService = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  list: getUsers,
  create: createUser,
  update: updateUser,
  remove: deleteUser,
  mapApiUser
}
