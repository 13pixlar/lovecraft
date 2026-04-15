import type { BookmarkRow, WorkDetailResponse, WorksResponse } from '@/lib/types'

const json = async <T>(r: Response): Promise<T> => {
  if (!r.ok) {
    const t = await r.text()
    throw new Error(t || r.statusText)
  }
  return r.json() as Promise<T>
}

export async function fetchWorks(): Promise<WorksResponse> {
  const r = await fetch('/api/works')
  return json<WorksResponse>(r)
}

export async function fetchWork(slug: string): Promise<WorkDetailResponse> {
  const r = await fetch(`/api/works/${encodeURIComponent(slug)}`)
  return json<WorkDetailResponse>(r)
}

export async function patchPlayback(trackId: number | null, positionSeconds: number) {
  const r = await fetch('/api/playback', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId, positionSeconds }),
  })
  if (!r.ok) throw new Error('Kunde inte spara uppspelning')
}

export async function patchTrackDuration(trackId: number, durationSeconds: number) {
  await fetch(`/api/tracks/${trackId}/duration`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durationSeconds }),
  })
}

export async function fetchBookmarks(): Promise<{ bookmarks: BookmarkRow[] }> {
  const r = await fetch('/api/bookmarks')
  return json(r)
}

export async function postBookmark(
  trackId: number,
  positionSeconds: number,
  label?: string | null,
) {
  const r = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId, positionSeconds, label }),
  })
  if (!r.ok) throw new Error('Kunde inte skapa bokmärke')
  return json<{ id: number }>(r)
}

export async function deleteBookmark(id: number) {
  const r = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('Kunde inte ta bort bokmärke')
}
