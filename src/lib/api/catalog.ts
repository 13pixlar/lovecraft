import { supabase } from '@/lib/supabaseClient'
import type { WorkDetailResponse, WorkListItem } from '@/lib/types'

function coverUrlFromFilename(coverFilename: string | null): string | null {
  if (!coverFilename) return null
  return `/books/covers/${encodeURIComponent(coverFilename)}`
}

export async function fetchWorksFromSupabase(): Promise<{ works: WorkListItem[] }> {
  const { data: works, error: wErr } = await supabase
    .from('lovecraft_works')
    .select('slug, title_sv, description_sv, original_title_en, sort_order, cover_filename')
    .order('sort_order', { ascending: true })

  if (wErr) throw wErr
  if (!works?.length) return { works: [] }

  const slugs = works.map((w) => w.slug)
  const { data: tracks, error: tErr } = await supabase
    .from('lovecraft_tracks')
    .select('work_slug')
    .in('work_slug', slugs)

  if (tErr) throw tErr

  const countBySlug = new Map<string, number>()
  for (const row of tracks ?? []) {
    const s = row.work_slug
    countBySlug.set(s, (countBySlug.get(s) ?? 0) + 1)
  }

  const list: WorkListItem[] = works.map((w) => ({
    id: w.slug,
    slug: w.slug,
    title_sv: w.title_sv,
    description_sv: w.description_sv,
    original_title_en: w.original_title_en ?? null,
    sort_order: w.sort_order,
    track_count: countBySlug.get(w.slug) ?? 0,
    coverUrl: coverUrlFromFilename(w.cover_filename),
  }))

  return { works: list }
}

export async function fetchWorkDetailFromSupabase(slug: string): Promise<WorkDetailResponse> {
  const { data: work, error: wErr } = await supabase
    .from('lovecraft_works')
    .select('slug, title_sv, description_sv, original_title_en, sort_order, cover_filename')
    .eq('slug', slug)
    .maybeSingle()

  if (wErr) throw wErr
  if (!work) throw new Error('Verk hittades inte')

  const { data: trackRows, error: tErr } = await supabase
    .from('lovecraft_tracks')
    .select('filename, title_sv, sort_order')
    .eq('work_slug', slug)
    .order('sort_order', { ascending: true })

  if (tErr) throw tErr

  const tracks = (trackRows ?? []).map((t) => ({
    id: t.filename,
    filename: t.filename,
    title_sv: t.title_sv,
    part_index: t.sort_order,
    duration_seconds: null as number | null,
    audioUrl: `/books/${encodeURIComponent(t.filename)}`,
  }))

  return {
    work: {
      id: work.slug,
      slug: work.slug,
      title_sv: work.title_sv,
      description_sv: work.description_sv,
      original_title_en: work.original_title_en ?? null,
      sort_order: work.sort_order,
      coverUrl: coverUrlFromFilename(work.cover_filename),
    },
    tracks,
  }
}
