const resolveApiBaseUrl = () => {
  const envValue = import.meta.env?.VITE_API_URL
  if (envValue && envValue.trim().length > 0) {
    return envValue.trim()
  }

  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')) {
    return `${window.location.origin}/api`
  }

  return 'http://localhost:4000/api'
}

const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, '')

const deriveSlugFromPath = () => {
  if (typeof window === 'undefined') {
    return undefined
  }
  const segments = window.location.pathname.split('/').filter(Boolean)
  return segments.length > 0 ? segments[0] : undefined
}

const getTenantHeaders = () => {
  const storedTenantId = localStorage.getItem('tenantId')
  const storedTenantSlug = localStorage.getItem('tenantSlug')

  if (storedTenantId) {
    return { 'x-tenant-id': storedTenantId }
  }
  if (storedTenantSlug) {
    return { 'x-prefeitura-slug': storedTenantSlug }
  }

  const slugFromPath = deriveSlugFromPath()
  if (slugFromPath) {
    return { 'x-prefeitura-slug': slugFromPath }
  }

  // fallback para ambiente de testes
  return { 'x-tenant-id': '1' }
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  if (token) {
    return { 'Authorization': `Bearer ${token}` }
  }
  return {}
}

const getClientLocationHeaders = () => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('client_geolocation_v1')
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const latitude = Number(parsed?.latitude)
    const longitude = Number(parsed?.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {}

    const headers: Record<string, string> = {
      'x-client-latitude': String(latitude),
      'x-client-longitude': String(longitude)
    }
    if (parsed?.city) headers['x-client-city'] = String(parsed.city)
    if (parsed?.region) headers['x-client-region'] = String(parsed.region)
    if (parsed?.country) headers['x-client-country'] = String(parsed.country)
    return headers
  } catch {
    return {}
  }
}

interface RequestOptions extends RequestInit {
  skipAuthHeaders?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(options.headers || {})

  if (!options.skipAuthHeaders) {
    const tenantHeaders = getTenantHeaders()
    Object.entries(tenantHeaders).forEach(([key, value]) => headers.set(key, value))
    
    // Adicionar token JWT de autenticação
    const authHeaders = getAuthHeaders()
    Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value))

    const clientLocationHeaders = getClientLocationHeaders()
    Object.entries(clientLocationHeaders).forEach(([key, value]) => headers.set(key, value))
  }

  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    cache: options.cache ?? 'no-store',
    ...options,
    headers
  })

  if (!response.ok) {
    const errorResponse = response.clone()
    let body: { message?: string } | undefined
    try {
      body = await errorResponse.json()
    } catch {
      try {
        const text = await errorResponse.text()
        body = text ? { message: text } : undefined
      } catch {
        body = undefined
      }
    }
    throw new Error(body?.message || 'Erro ao comunicar com a API')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'DELETE'
    })
}
