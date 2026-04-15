import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookmarkPlus, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkComments } from '@/components/WorkComments'
import { WorkTitleRatingStars } from '@/components/WorkStarRating'
import { usePlayer } from '@/context/PlayerContext'
import * as api from '@/lib/api'
import {
  fetchMyWorkRating,
  fetchRatingStatForWork,
  upsertWorkRating,
  type WorkRatingStat,
} from '@/lib/api/ratings'
import { getOrCreateClientId } from '@/lib/clientId'
import type { TrackRow } from '@/lib/types'
import { formatTime } from '@/lib/format'
import * as storage from '@/lib/storage'
import { buildAudiobookJsonLd } from '@/lib/jsonLd'
import { DEFAULT_META_DESCRIPTION, SITE_NAME } from '@/lib/siteConstants'
import { absoluteUrl } from '@/lib/siteUrl'
import { trimMetaDescription } from '@/lib/seoText'

export function WorkPage() {
  const { slug } = useParams<{ slug: string }>()
  const { playWork, currentTrack, tracks, isPlaying, addBookmark } = usePlayer()
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.fetchWork>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [bmOpen, setBmOpen] = useState(false)
  const [bmLabel, setBmLabel] = useState('')
  const [ratingStat, setRatingStat] = useState<WorkRatingStat | null>(null)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [ratingBusy, setRatingBusy] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.fetchWork(slug)
        if (!cancelled) setDetail(d)
        const clientId = getOrCreateClientId()
        const [stat, mine] = await Promise.all([
          fetchRatingStatForWork(slug),
          fetchMyWorkRating(slug, clientId),
        ])
        if (!cancelled) {
          setRatingStat(stat)
          setMyRating(mine)
        }
      } catch {
        setErr('Verket kunde inte laddas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleRate(n: number) {
    if (!slug) return
    setRatingBusy(true)
    try {
      const clientId = getOrCreateClientId()
      await upsertWorkRating(slug, n, clientId)
      setMyRating(n)
      const stat = await fetchRatingStatForWork(slug)
      setRatingStat(stat)
    } catch {
      /* tyst fel — kan visa toast senare */
    } finally {
      setRatingBusy(false)
    }
  }

  function startFromBeginning() {
    if (!detail) return
    playWork(detail.work.slug, detail.work.title_sv, detail.tracks, 0, 0)
  }

  function playTrack(i: number) {
    if (!detail) return
    playWork(detail.work.slug, detail.work.title_sv, detail.tracks, i, 0)
  }

  const activeHere =
    Boolean(detail && currentTrack && tracks.length > 0 && detail.work.slug === slug)

  const defaultTitle = `${SITE_NAME} · Lovecraft ljudböcker`

  if (loading) {
    return (
      <>
        <Helmet>
          <title>{defaultTitle}</title>
          <meta name="description" content={trimMetaDescription(DEFAULT_META_DESCRIPTION)} />
        </Helmet>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (err || !detail) {
    return (
      <>
        <Helmet>
          <title>Verk hittades inte · {SITE_NAME}</title>
          <meta name="description" content="Verket kunde inte laddas eller finns inte i biblioteket." />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="space-y-6">
          <p className="text-destructive" role="alert">
            {err ?? 'Saknas'}
          </p>
          <Button variant="secondary" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" />
              Tillbaka till biblioteket
            </Link>
          </Button>
        </div>
      </>
    )
  }

  const { work, tracks: list } = detail

  const infoColumn = (
    <>
      <header className="space-y-1">
        <h1 className="font-serif text-3xl tracking-tight md:text-4xl">{work.title_sv}</h1>
        {work.original_title_en && (
          <p className="text-muted-foreground text-sm italic">{work.original_title_en}</p>
        )}
        <WorkTitleRatingStars
          stat={ratingStat}
          myRating={myRating}
          onRate={(n) => void handleRate(n)}
          disabled={ratingBusy}
        />
      </header>

      <Card className="border-border/80 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Om berättelsen</CardTitle>
          <CardDescription className="text-foreground/90 leading-relaxed">
            {work.description_sv}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={startFromBeginning}>
            <Play className="size-4" />
            Spela från början
          </Button>
          <Dialog open={bmOpen} onOpenChange={setBmOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" disabled={!activeHere}>
                <BookmarkPlus className="size-4" />
                Bokmärke här
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nytt bokmärke</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                Sparar din nuvarande position i detta spår. Valfritt namn:
              </p>
              <Input
                placeholder="T.ex. viktig vändpunkt"
                value={bmLabel}
                onChange={(e) => setBmLabel(e.target.value)}
              />
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBmOpen(false)
                    setBmLabel('')
                  }}
                >
                  Avbryt
                </Button>
                <Button
                  disabled={!activeHere}
                  onClick={async () => {
                    await addBookmark(bmLabel.trim() || null)
                    setBmLabel('')
                    setBmOpen(false)
                  }}
                >
                  Spara
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  )

  const tracksSection = (
    <section className="w-full">
      <h2 className="mb-4 font-serif text-xl">Spår</h2>
      <div className="rounded-xl border">
        <ul className="divide-border divide-y p-2">
          {list.map((t: TrackRow, i: number) => {
            const isCurrent = activeHere && currentTrack?.id === t.id
            const playing = isCurrent && isPlaying
            const duration = t.duration_seconds ?? storage.getDuration(t.id)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => playTrack(i)}
                  className="hover:bg-muted/60 flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title_sv}</p>
                    {duration != null && (
                      <p className="text-muted-foreground text-xs">
                        {formatTime(duration)}
                      </p>
                    )}
                  </div>
                  {isCurrent ? (
                    <span className="text-primary shrink-0 text-xs">
                      {playing ? 'Spelas' : 'Valt'}
                    </span>
                  ) : (
                    <Play className="text-muted-foreground size-4 shrink-0" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )

  const canonical = absoluteUrl(`/verk/${work.slug}`)
  const pageTitle = `${work.title_sv} · ${SITE_NAME}`
  const pageDesc = trimMetaDescription(work.description_sv)
  const ogImage = work.coverUrl ? absoluteUrl(work.coverUrl) : absoluteUrl('/og-default.png')
  const audiobookLd = buildAudiobookJsonLd({
    url: canonical,
    name: work.title_sv,
    description: work.description_sv,
    imageAbsolute: work.coverUrl ? absoluteUrl(work.coverUrl) : null,
  })

  return (
    <div className="space-y-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="book" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="sv_SE" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(audiobookLd)}</script>
      </Helmet>
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/">
          <ArrowLeft className="size-4" />
          Tillbaka till biblioteket
        </Link>
      </Button>

      {work.coverUrl ? (
        <>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
            <aside className="min-w-0 lg:sticky lg:top-24">
              <div className="border-border/60 overflow-hidden rounded-xl border">
                <img
                  src={work.coverUrl}
                  alt={`Omslag: ${work.title_sv}`}
                  className="block h-auto w-full max-w-full"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </aside>
            <div className="min-w-0 space-y-8">{infoColumn}</div>
          </div>
          {tracksSection}
        </>
      ) : (
        <div className="space-y-8">
          {infoColumn}
          {tracksSection}
        </div>
      )}

      {slug ? <WorkComments workSlug={slug} /> : null}
    </div>
  )
}
