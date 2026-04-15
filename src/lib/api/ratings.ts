import { supabase } from '@/lib/supabaseClient'

export type WorkRatingStat = {
  work_slug: string
  avg_rating: number
  rating_count: number
}

export async function fetchWorkRatingStats(): Promise<Map<string, WorkRatingStat>> {
  const { data, error } = await supabase
    .from('lovecraft_work_rating_stats')
    .select('work_slug, avg_rating, rating_count')

  if (error) throw error
  const map = new Map<string, WorkRatingStat>()
  for (const row of data ?? []) {
    const ws = row.work_slug
    const avg = row.avg_rating
    const count = row.rating_count
    if (ws == null || avg == null || count == null) continue
    map.set(ws, {
      work_slug: ws,
      avg_rating: Number(avg),
      rating_count: Number(count),
    })
  }
  return map
}

export async function upsertWorkRating(
  workSlug: string,
  rating: number,
  clientId: string,
): Promise<void> {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('Betyg måste vara 1–5')
  }
  const { error } = await supabase.from('lovecraft_work_ratings').upsert(
    {
      work_slug: workSlug,
      client_id: clientId,
      rating,
    },
    { onConflict: 'work_slug,client_id' },
  )
  if (error) throw error
}

export async function fetchMyWorkRating(
  workSlug: string,
  clientId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('lovecraft_work_ratings')
    .select('rating')
    .eq('work_slug', workSlug)
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) throw error
  const r = data?.rating
  if (r == null) return null
  return typeof r === 'number' ? r : null
}

export async function fetchRatingStatForWork(
  workSlug: string,
): Promise<WorkRatingStat | null> {
  const { data, error } = await supabase
    .from('lovecraft_work_rating_stats')
    .select('work_slug, avg_rating, rating_count')
    .eq('work_slug', workSlug)
    .maybeSingle()

  if (error) throw error
  if (
    !data ||
    data.work_slug == null ||
    data.avg_rating == null ||
    data.rating_count == null
  ) {
    return null
  }
  return {
    work_slug: data.work_slug,
    avg_rating: Number(data.avg_rating),
    rating_count: Number(data.rating_count),
  }
}
