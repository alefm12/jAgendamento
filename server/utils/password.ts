import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${derivedKey}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':')
  if (!salt || !key) {
    return false
  }

  const storedBuffer = Buffer.from(key, 'hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH)

  if (storedBuffer.length !== derivedKey.length) {
    return false
  }

  return timingSafeEqual(storedBuffer, derivedKey)
}
