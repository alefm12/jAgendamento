import type { Tenant } from '@/lib/types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

interface PrefeituraResponse {
  id: number
  nome: string
  slug: string
  ativo: boolean
  criado_em: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    ...init
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(async () => ({ message: await response.text() }))
    const error = new Error(errorBody?.message || 'Falha ao comunicar com o servidor')
    throw error
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

const mapPrefeituraToTenant = (prefeitura: PrefeituraResponse): Tenant => ({
  id: prefeitura.id.toString(),
  name: prefeitura.nome,
  slug: prefeitura.slug,
  cityName: prefeitura.nome,
  createdAt: prefeitura.criado_em,
  createdBy: 'Sistema',
  isActive: prefeitura.ativo,
  config: undefined
})

const buildUpdatePayload = (updates: Partial<Tenant>) => {
  const body: Record<string, unknown> = {}

  if (updates.name) {
    body.nome = updates.name
  } else if (updates.cityName) {
    body.nome = updates.cityName
  }

  if (typeof updates.isActive === 'boolean') {
    body.ativo = updates.isActive
  }

  return body
}

export const tenantService = {
  list: async () => {
    const data = await request<PrefeituraResponse[]>('/prefeituras')
    return data.map(mapPrefeituraToTenant)
  },
  create: async (payload: Omit<Tenant, 'id' | 'createdAt'>) => {
    const body = {
      nome: payload.name.trim(),
      slug: payload.slug.trim(),
      ativo: payload.isActive ?? true
    }

    const result = await request<PrefeituraResponse>('/prefeituras', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    return mapPrefeituraToTenant(result)
  },
  update: async (tenantId: string, updates: Partial<Tenant>) => {
    const body = buildUpdatePayload(updates)

    if (Object.keys(body).length === 0) {
      throw new Error('Informe pelo menos um campo válido para atualizar (nome ou status).')
    }

    const result = await request<PrefeituraResponse>(`/prefeituras/${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    })

    return mapPrefeituraToTenant(result)
  },
  remove: (tenantId: string) =>
    request<void>(`/prefeituras/${tenantId}`, {
      method: 'DELETE'
    })
}
