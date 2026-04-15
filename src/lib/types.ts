export type WorkListItem = {
  id: string
  slug: string
  title_sv: string
  description_sv: string
  original_title_en: string | null
  sort_order: number
  track_count: number
  coverUrl: string | null
}

export type WorksResponse = {
  works: WorkListItem[]
}

export type TrackRow = {
  id: string
  filename: string
  title_sv: string
  part_index: number
  duration_seconds: number | null
  audioUrl: string
}

export type WorkDetailResponse = {
  work: {
    id: string
    slug: string
    title_sv: string
    description_sv: string
    original_title_en: string | null
    sort_order: number
    coverUrl: string | null
  }
  tracks: TrackRow[]
}

export type BookmarkRow = {
  id: string
  trackId: string
  positionSeconds: number
  label: string | null
  createdAt: string
  trackTitle: string
  filename: string
  workSlug: string
  workTitle: string
}
