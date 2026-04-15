import type { WorkDetailResponse, WorksResponse } from '@/lib/types'

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
