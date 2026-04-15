import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import * as api from '@/lib/api'
import { usePlayer } from '@/context/PlayerContext'
import type { WorkListItem } from '@/lib/types'
import { fetchWork } from '@/lib/api'

export function HomePage() {
  const [works, setWorks] = useState<WorkListItem[]>([])
  const [resume, setResume] = useState<Awaited<ReturnType<typeof api.fetchWorks>>['resume']>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const { playWork } = usePlayer()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.fetchWorks()
        if (cancelled) return
        setWorks(data.works)
        setResume(data.resume)
      } catch {
        setErr('Kunde inte ladda biblioteket. Kontrollera att servern kör.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleResume() {
    if (!resume?.trackId || resume.workId == null) return
    const w = works.find((x) => x.id === resume.workId)
    if (!w) return
    const detail = await fetchWork(w.slug)
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

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight md:text-4xl">Bibliotek</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Svenska ljudinspelningar av H.P. Lovecrafts noveller och romaner. Mörkret väntar — men du kan
          pausa när som helst och återuppta senare.
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
            <Button onClick={handleResume} disabled={works.length === 0}>
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
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-background/66 via-background/10 to-transparent" />
                  <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-b-xl border-t border-border/28 bg-background/38 px-4 pb-3 pt-4 text-card-foreground shadow-[0_-12px_32px_rgba(0,0,0,0.13)] backdrop-blur-sm">
                    <CardHeader className="p-0 pb-2">
                      <CardTitle className="sr-only">{w.title_sv}</CardTitle>
                      <CardDescription className="text-foreground/95 line-clamp-3 text-sm leading-snug">
                        {w.description_sv}
                      </CardDescription>
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
                    <CardDescription className="line-clamp-3">{w.description_sv}</CardDescription>
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
