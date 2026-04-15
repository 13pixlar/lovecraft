import type { WorkDetailResponse, WorksResponse } from '@/lib/types'
import { fetchWorkDetailFromSupabase, fetchWorksFromSupabase } from '@/lib/api/catalog'

export async function fetchWorks(): Promise<WorksResponse> {
  return fetchWorksFromSupabase()
}

export async function fetchWork(slug: string): Promise<WorkDetailResponse> {
  return fetchWorkDetailFromSupabase(slug)
}
