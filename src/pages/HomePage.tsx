import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { BookOpen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkRatingCardLine } from '@/components/WorkStarRating'
import * as api from '@/lib/api'
import { fetchWorkRatingStats, type WorkRatingStat } from '@/lib/api/ratings'
import { usePlayer } from '@/context/PlayerContext'
import type { WorkListItem } from '@/lib/types'
import { fetchWork } from '@/lib/api'
import * as storage from '@/lib/storage'
import { buildWebSiteJsonLd } from '@/lib/jsonLd'
import { DEFAULT_META_DESCRIPTION, SITE_NAME } from '@/lib/siteConstants'
import { absoluteUrl } from '@/lib/siteUrl'
import { trimMetaDescription } from '@/lib/seoText'

export function HomePage() {
  const [works, setWorks] = useState<WorkListItem[]>([])
  const [ratingStats, setRatingStats] = useState<Map<string, WorkRatingStat>>(new Map())
  const [resume, setResume] = useState<storage.PlaybackState | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const { playWork } = usePlayer()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [data, stats] = await Promise.all([api.fetchWorks(), fetchWorkRatingStats()])
        if (cancelled) return
        setWorks(data.works)
        setRatingStats(stats)
        setResume(storage.loadPlayback())
      } catch {
        setErr(
          'Kunde inte ladda biblioteket. Kontrollera VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY och att databasen är seedad.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleResume() {
    if (!resume?.trackId || !resume.workSlug) return
    const detail = await fetchWork(resume.workSlug)
    const idx = detail.tracks.findIndex((t) => t.id === resume.trackId)
    if (idx < 0) return
    playWork(
      detail.work.slug,
      detail.work.title_sv,
      detail.tracks,
      idx,
      resume.positionSeconds,
    )
  }

  async function handleListen(workSlug: string) {
    const detail = await fetchWork(workSlug)
    playWork(detail.work.slug, detail.work.title_sv, detail.tracks, 0, 0)
  }

  const siteUrl = absoluteUrl('/')
  const ogImage = absoluteUrl('/og-default.png')
  const pageTitle = `${SITE_NAME} · Lovecraft ljudbok & talbok på svenska`
  const pageDesc = trimMetaDescription(DEFAULT_META_DESCRIPTION)
  const websiteLd = buildWebSiteJsonLd(siteUrl, DEFAULT_META_DESCRIPTION)

  return (
    <div className="space-y-10">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={siteUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="sv_SE" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(websiteLd)}</script>
      </Helmet>
      <div className="space-y-2">
        <p className="text-muted-foreground font-sans text-xs font-medium uppercase tracking-wider">
          Lovecraft på svenska
        </p>
        <h1 className="font-serif text-3xl tracking-tight md:text-4xl">Bibliotek</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Svenska inspelningar av H.P. Lovecraft — lyssna som ljudbok eller talbok i webbläsaren. Mörkret
          väntar; du kan pausa när som helst och återuppta senare.
        </p>
      </div>

      {resume && resume.trackId && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">Fortsätt lyssna</CardTitle>
              <CardDescription>
                {resume.trackTitle ?? 'Senaste spår'} ·{' '}
                {formatResumeTime(resume.positionSeconds)}
              </CardDescription>
            </div>
            <Button onClick={handleResume}>
              <Play className="size-4" />
              Återuppta
            </Button>
          </CardHeader>
        </Card>
      )}

      {err && (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {works.map((w) => (
            <Card
              key={w.id}
              className={cn(
                'group border-border/80 hover:border-primary/30 overflow-hidden transition-colors',
                w.coverUrl
                  ? 'gap-0 bg-transparent p-0 ring-1 ring-foreground/10'
                  : 'bg-card/60',
              )}
            >
              {w.coverUrl ? (
                <div className="relative aspect-[10/11] w-full">
                  <Link
                    to={`/verk/${w.slug}`}
                    className="absolute inset-0 z-0 block overflow-hidden rounded-xl"
                    aria-label={`Öppna ${w.title_sv}`}
                  >
                    <img
                      src={w.coverUrl}
                      alt=""
                      className="h-full w-full object-cover object-[center_top] transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background/78 via-background/30 to-transparent px-4 pb-12 pt-5 text-center">
                    <CardTitle className="font-serif text-[1.4375rem] leading-snug sm:text-[1.5625rem] [text-shadow:0_1px_3px_rgba(0,0,0,0.88),0_2px_10px_rgba(0,0,0,0.45)]">
                      {w.title_sv}
                    </CardTitle>
                    {w.original_title_en && (
                      <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[1rem] italic leading-snug sm:text-[1.0625rem] [text-shadow:0_1px_2px_rgba(0,0,0,0.82),0_2px_8px_rgba(0,0,0,0.42)]">
                        {w.original_title_en}
                      </p>
                    )}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-background/66 via-background/10 to-transparent" />
                  <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-b-xl border-t border-border/28 bg-background/38 px-4 pb-3 pt-4 text-card-foreground shadow-[0_-12px_32px_rgba(0,0,0,0.13)] backdrop-blur-sm">
                    <CardHeader className="p-0 pb-2">
                      <CardDescription className="text-foreground/95 line-clamp-3 text-sm leading-snug">
                        {w.description_sv}
                      </CardDescription>
                      <WorkRatingCardLine stat={ratingStats.get(w.slug)} />
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 p-0 pt-3">
                      <span className="text-muted-foreground text-xs">
                        {w.track_count} {w.track_count === 1 ? 'spår' : 'spår'}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="sm" onClick={() => void handleListen(w.slug)}>
                          <Play className="size-4" />
                          Lyssna
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                          <Link to={`/verk/${w.slug}`}>
                            <BookOpen className="size-4" />
                            Öppna
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </div>
              ) : (
                <>
                  <CardHeader>
                    <CardTitle className="font-serif text-xl leading-snug">{w.title_sv}</CardTitle>
                    {w.original_title_en && (
                      <p className="text-muted-foreground -mt-1 text-sm italic">{w.original_title_en}</p>
                    )}
                    <CardDescription className="line-clamp-3">{w.description_sv}</CardDescription>
                    <WorkRatingCardLine stat={ratingStats.get(w.slug)} />
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      {w.track_count} {w.track_count === 1 ? 'spår' : 'spår'}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" onClick={() => void handleListen(w.slug)}>
                        <Play className="size-4" />
                        Lyssna
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/verk/${w.slug}`}>
                          <BookOpen className="size-4" />
                          Öppna
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function formatResumeTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m} min ${s} s`
}
