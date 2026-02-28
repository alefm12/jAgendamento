export function toFirstAndSecondName(fullName?: string | null): string {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''

  const parts = normalized.split(' ')
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1]}`
}

