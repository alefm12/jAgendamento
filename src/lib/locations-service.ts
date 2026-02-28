import { api } from './api'
import type { Location, OriginLocality, Neighborhood } from './types'
import type { TenantRequestContext } from './users-service'

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
    headers,
    skipAuthHeaders: true as const
  }
}

interface ServiceLocationPayload {
  nome?: string
  endereco?: string
  ativo?: boolean
  linkMapa?: string | null
}

interface OriginLocalityPayload {
  nome: string
}

interface NeighborhoodPayload {
  localidadeId?: number
  nome: string
}

const sanitizeText = (value?: string | null) => value?.trim() || undefined

const toServiceLocationPayload = (data: Partial<Location>): ServiceLocationPayload => {
  const payload: ServiceLocationPayload = {}

  if (data.name !== undefined) {
    payload.nome = data.name.trim()
  }
  if (data.address !== undefined) {
    payload.endereco = data.address.trim()
  }
  if (data.isActive !== undefined) {
    payload.ativo = data.isActive
  }
  if (data.googleMapsUrl !== undefined) {
    const trimmed = data.googleMapsUrl?.trim()
    payload.linkMapa = trimmed && trimmed.length > 0 ? trimmed : null
  }

  return payload
}

const toLocalityPayload = (name: string): OriginLocalityPayload => ({
  nome: name.trim()
})

const toNeighborhoodPayload = (name: string, localityId?: string): NeighborhoodPayload => {
  const payload: NeighborhoodPayload = {
    nome: name.trim()
  }

  if (localityId !== undefined) {
    const parsed = Number.parseInt(localityId, 10)
    if (Number.isNaN(parsed)) {
      throw new Error('Localidade inválida')
    }
    payload.localidadeId = parsed
  }

  return payload
}

export interface CreateNeighborhoodInput {
  localityId: string
  name: string
}

export interface UpdateNeighborhoodInput {
  id: string
  name: string
}

export interface UpdateServiceLocationInput {
  id: string
  name?: string
  address?: string
  googleMapsUrl?: string | null
  isActive?: boolean
}

export interface CreateServiceLocationInput {
  name: string
  address: string
  googleMapsUrl?: string
  isActive?: boolean
}

export const locationsService = {
  async listServiceLocations(context?: TenantRequestContext): Promise<Location[]> {
    return api.get<Location[]>('/locais-atendimento', buildTenantOptions(context))
  },
  async createServiceLocation(data: CreateServiceLocationInput, context?: TenantRequestContext): Promise<Location> {
    const payload = toServiceLocationPayload({
      name: data.name,
      address: data.address,
      googleMapsUrl: data.googleMapsUrl,
      isActive: data.isActive ?? true
    })
    return api.post<Location>('/locais-atendimento', payload, buildTenantOptions(context))
  },
  async updateServiceLocation(data: UpdateServiceLocationInput, context?: TenantRequestContext): Promise<Location> {
    const payload = toServiceLocationPayload({
      name: data.name,
      address: data.address,
      googleMapsUrl: data.googleMapsUrl ?? undefined,
      isActive: data.isActive
    })
    return api.put<Location>(`/locais-atendimento/${data.id}`, payload, buildTenantOptions(context))
  },
  async deleteServiceLocation(id: string, context?: TenantRequestContext): Promise<void> {
    await api.delete(`/locais-atendimento/${id}`, buildTenantOptions(context))
  },
  async listOriginLocalities(context?: TenantRequestContext): Promise<OriginLocality[]> {
    return api.get<OriginLocality[]>('/localidades-origem', buildTenantOptions(context))
  },
  async createOriginLocality(name: string, context?: TenantRequestContext): Promise<OriginLocality> {
    const payload = toLocalityPayload(name)
    return api.post<OriginLocality>('/localidades-origem', payload, buildTenantOptions(context))
  },
  async updateOriginLocality(id: string, name: string, context?: TenantRequestContext): Promise<OriginLocality> {
    const payload = toLocalityPayload(name)
    return api.patch<OriginLocality>(`/localidades-origem/${id}`, payload, buildTenantOptions(context))
  },
  async deleteOriginLocality(id: string, context?: TenantRequestContext): Promise<void> {
    await api.delete(`/localidades-origem/${id}`, buildTenantOptions(context))
  },
  async listNeighborhoods(localityId: string, context?: TenantRequestContext): Promise<Neighborhood[]> {
    return api.get<Neighborhood[]>(`/localidades-origem/${localityId}/bairros`, buildTenantOptions(context))
  },
  async createNeighborhood(input: CreateNeighborhoodInput, context?: TenantRequestContext): Promise<Neighborhood> {
    const payload = toNeighborhoodPayload(input.name, input.localityId)
    return api.post<Neighborhood>('/bairros', payload, buildTenantOptions(context))
  },
  async updateNeighborhood(input: UpdateNeighborhoodInput, context?: TenantRequestContext): Promise<Neighborhood> {
    const payload = toNeighborhoodPayload(input.name)
    return api.patch<Neighborhood>(`/bairros/${input.id}`, payload, buildTenantOptions(context))
  },
  async deleteNeighborhood(id: string, context?: TenantRequestContext): Promise<void> {
    await api.delete(`/bairros/${id}`, buildTenantOptions(context))
  }
}
