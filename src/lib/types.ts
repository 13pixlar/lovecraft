export type WorkListItem = {
  id: number
  slug: string
  title_sv: string
  description_sv: string
  original_title_en: string | null
  sort_order: number
  track_count: number
  coverUrl: string | null
}

export type ResumeInfo = {
  trackId: number
  workId: number | null
  positionSeconds: number
  updatedAt: string
  trackTitle: string | null
  filename: string | null
}

export type WorksResponse = {
  works: WorkListItem[]
  resume: ResumeInfo | null
}

export type TrackRow = {
  id: number
  filename: string
  title_sv: string
  part_index: number
  duration_seconds: number | null
  audioUrl: string
}

export type WorkDetailResponse = {
  work: {
    id: number
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
  id: number
  trackId: number
  positionSeconds: number
  label: string | null
  createdAt: string
  trackTitle: string
  filename: string
  workSlug: string
  workTitle: string
}
