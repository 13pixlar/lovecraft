export type PlaybackState = {
  workSlug: string
  trackId: string
  positionSeconds: number
  updatedAt: string
  trackTitle: string | null
  filename: string | null
}

export type BookmarkItem = {
  id: string
  workSlug: string
  workTitle: string
  trackId: string
  positionSeconds: number
  label: string | null
  createdAt: string
  trackTitle: string
  filename: string
}

const KEY_PLAYBACK = 'arkhamsagor:playback:v1'
const KEY_BOOKMARKS = 'arkhamsagor:bookmarks:v1'
const KEY_DURATIONS = 'arkhamsagor:durations:v1'

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadPlayback(): PlaybackState | null {
  const v = safeParseJson<PlaybackState>(localStorage.getItem(KEY_PLAYBACK))
  if (!v || typeof v.workSlug !== 'string' || typeof v.trackId !== 'string') return null
  if (typeof v.positionSeconds !== 'number' || Number.isNaN(v.positionSeconds)) return null
  if (typeof v.updatedAt !== 'string') return null
  return v
}

export function savePlayback(next: PlaybackState | null) {
  if (!next) {
    localStorage.removeItem(KEY_PLAYBACK)
    return
  }
  localStorage.setItem(KEY_PLAYBACK, JSON.stringify(next))
}

export function loadBookmarks(): BookmarkItem[] {
  const v = safeParseJson<BookmarkItem[]>(localStorage.getItem(KEY_BOOKMARKS))
  if (!Array.isArray(v)) return []
  return v.filter((b) => b && typeof b.id === 'string' && typeof b.trackId === 'string')
}

export function saveBookmarks(items: BookmarkItem[]) {
  localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(items))
}

export function addBookmark(item: Omit<BookmarkItem, 'id' | 'createdAt'> & { createdAt?: string }) {
  const items = loadBookmarks()
  const now = item.createdAt ?? new Date().toISOString()
  const id = `${item.workSlug}:${item.trackId}:${now}:${Math.random().toString(16).slice(2)}`
  const next: BookmarkItem = { ...item, id, createdAt: now }
  saveBookmarks([next, ...items])
  return next
}

export function deleteBookmark(id: string) {
  const items = loadBookmarks()
  const next = items.filter((b) => b.id !== id)
  saveBookmarks(next)
}

export function loadDurations(): Record<string, number> {
  const v = safeParseJson<Record<string, number>>(localStorage.getItem(KEY_DURATIONS))
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'number' && !Number.isNaN(val) && val >= 0) out[k] = val
  }
  return out
}

export function saveDuration(trackId: string, durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return
  const m = loadDurations()
  m[trackId] = durationSeconds
  localStorage.setItem(KEY_DURATIONS, JSON.stringify(m))
}

export function getDuration(trackId: string): number | null {
  const m = loadDurations()
  const d = m[trackId]
  return typeof d === 'number' ? d : null
}
