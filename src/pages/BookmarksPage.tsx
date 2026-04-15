import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { BookmarkRow } from '@/lib/types'
import { formatTime } from '@/lib/format'
import { usePlayer } from '@/context/PlayerContext'
import * as storage from '@/lib/storage'
import { fetchWork } from '@/lib/api'
import { SITE_NAME } from '@/lib/siteConstants'
import { absoluteUrl } from '@/lib/siteUrl'

export function BookmarksPage() {
  const [items, setItems] = useState<BookmarkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const { playWork } = usePlayer()

  async function load() {
    try {
      setItems(storage.loadBookmarks() as BookmarkRow[])
    } catch {
      setErr('Kunde inte ladda bokmärken.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function remove(id: string) {
    try {
      storage.deleteBookmark(id)
      setItems((prev) => prev.filter((b) => b.id !== id))
    } catch {
      setErr('Kunde inte ta bort bokmärket.')
    }
  }

  async function goToBookmark(b: BookmarkRow) {
    const detail = await fetchWork(b.workSlug)
    const idx = detail.tracks.findIndex((t) => t.id === b.trackId)
    if (idx < 0) return
    playWork(detail.work.slug, detail.work.title_sv, detail.tracks, idx, b.positionSeconds)
  }

  const bmCanonical = absoluteUrl('/bokmarken')
  const bmTitle = `Bokmärken · ${SITE_NAME}`

  if (loading) {
    return (
      <>
        <Helmet>
          <title>{bmTitle}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-8">
      <Helmet>
        <title>{bmTitle}</title>
        <meta
          name="description"
          content="Dina sparade positioner i Lovecraft-ljudböckerna. Endast i den här webbläsaren."
        />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={bmCanonical} />
      </Helmet>
      <div>
        <h1 className="font-serif text-3xl tracking-tight md:text-4xl">Bokmärken</h1>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm">
          Sparade positioner i ljudböckerna. Klicka för att hoppa till exakt den platsen.
        </p>
      </div>

      {err && (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      )}

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Inga bokmärken ännu</CardTitle>
            <CardDescription>
              Öppna ett verk och spela upp — där kan du lägga till ett bokmärke vid nuvarande position.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" asChild>
              <Link to="/">Till biblioteket</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((b) => (
            <li key={b.id}>
              <Card className="border-border/80 bg-card/50">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">{b.workTitle}</p>
                    <p className="truncate font-medium">{b.trackTitle}</p>
                    {b.label && <p className="text-primary text-sm">{b.label}</p>}
                    <p className="text-muted-foreground text-xs">
                      {formatTime(b.positionSeconds)} ·{' '}
                      {new Date(b.createdAt).toLocaleString('sv-SE')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => void goToBookmark(b)}>
                      Spela härifrån
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void remove(b.id)}
                      aria-label="Ta bort bokmärke"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
