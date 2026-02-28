const CLIENT_LOCATION_STORAGE_KEY = 'client_geolocation_v1'

export interface ClientLocation {
  latitude: number
  longitude: number
  city?: string
  region?: string
  country?: string
  capturedAt: string
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const getStoredClientLocation = (): ClientLocation | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CLIENT_LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const latitude = parseNumber(parsed?.latitude)
    const longitude = parseNumber(parsed?.longitude)
    if (latitude === undefined || longitude === undefined) return null
    return {
      latitude,
      longitude,
      city: parsed?.city || undefined,
      region: parsed?.region || undefined,
      country: parsed?.country || undefined,
      capturedAt: parsed?.capturedAt || new Date().toISOString()
    }
  } catch {
    return null
  }
}

const resolveAddressByCoordinates = async (latitude: number, longitude: number) => {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
    )
    if (!response.ok) return {}
    const data: any = await response.json()
    return {
      city: data.city || data.locality || data.principalSubdivision || undefined,
      region: data.principalSubdivision || data.localityInfo?.administrative?.[0]?.name || undefined,
      country: data.countryName || undefined
    }
  } catch {
    return {}
  }
}

export const requestAndStoreClientLocation = async (force = false): Promise<ClientLocation | null> => {
  if (typeof window === 'undefined' || !navigator?.geolocation) return null

  const existing = getStoredClientLocation()
  if (!force && existing) {
    const ageMs = Date.now() - new Date(existing.capturedAt).getTime()
    if (ageMs < 24 * 60 * 60 * 1000) return existing
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5 * 60 * 1000
    })
  })

  const latitude = Number(position.coords.latitude.toFixed(6))
  const longitude = Number(position.coords.longitude.toFixed(6))
  const address = await resolveAddressByCoordinates(latitude, longitude)

  const payload: ClientLocation = {
    latitude,
    longitude,
    city: address.city,
    region: address.region,
    country: address.country,
    capturedAt: new Date().toISOString()
  }
  localStorage.setItem(CLIENT_LOCATION_STORAGE_KEY, JSON.stringify(payload))
  return payload
}

