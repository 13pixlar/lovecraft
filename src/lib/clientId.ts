const STORAGE_KEY = 'arkhamsagor:client-id:v1'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Stable anonymous id for ratings/comments (stored in localStorage). */
export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return randomUuid()
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && UUID_RE.test(existing)) return existing
    const id = randomUuid()
    window.localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return randomUuid()
  }
}
