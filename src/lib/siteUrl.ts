/** Public site origin for canonical URLs, Open Graph, and JSON-LD. No trailing slash. */
export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Absolute URL for a path starting with `/`. Falls back to path-only if origin unknown. */
export function absoluteUrl(path: string): string {
  const base = getSiteOrigin()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
