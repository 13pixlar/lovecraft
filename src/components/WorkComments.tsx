import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type WorkComment,
  createWorkComment,
  fetchCommentsForWork,
} from '@/lib/api/comments'
import { getOrCreateClientId } from '@/lib/clientId'

const STORAGE_KEY = 'arkhamsagor:comment-display-name'

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function getSavedName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    /* ignore */
  }
}

type WorkCommentsProps = {
  workSlug: string
}

export function WorkComments({ workSlug }: WorkCommentsProps) {
  const [comments, setComments] = useState<WorkComment[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [name, setName] = useState(getSavedName)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    fetchCommentsForWork(workSlug)
      .then((rows) => {
        if (!cancelled) {
          setComments(rows)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Kunde inte ladda kommentarer.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [workSlug])

  const canSubmit = name.trim().length > 0 && body.trim().length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setPostError(null)
    try {
      const clientId = getOrCreateClientId()
      const saved = await createWorkComment({
        workSlug,
        clientId,
        authorDisplayName: name.trim(),
        body: body.trim(),
      })
      saveName(name.trim())
      setBody('')
      setComments((prev) => [...prev, saved])
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Kunde inte skicka kommentaren.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <MessageSquare className="size-4 text-primary" aria-hidden />
          Kommentarer
          {!loading && comments.length > 0 ? (
            <span className="font-mono text-muted-foreground text-sm font-normal">
              ({comments.length})
            </span>
          ) : null}
        </CardTitle>
        <CardDescription className="font-body text-base">
          Inget konto krävs. Håll tonen respektfull.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Input
            type="text"
            placeholder="Visningsnamn"
            value={name}
            onChange={(e) => setName((e.target as HTMLInputElement).value)}
            maxLength={64}
            required
            className="font-body"
            aria-label="Visningsnamn"
          />
          <textarea
            placeholder="Skriv en kommentar…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            required
            rows={4}
            className={cn(
              'border-input bg-transparent font-body placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-20 w-full min-w-0 rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm',
            )}
            aria-label="Kommentar"
          />
          {postError ? (
            <p className="font-body text-destructive text-xs">{postError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {submitting ? 'Skickar…' : 'Publicera'}
            </Button>
          </div>
        </form>

        <div className="border-t border-border/40 pt-2">
          {loading ? (
            <div className="flex flex-col gap-4 py-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : fetchError ? (
            <p className="font-body text-destructive text-sm">{fetchError}</p>
          ) : comments.length === 0 ? (
            <p className="font-body text-muted-foreground text-sm">
              Inga kommentarer ännu. Var först ut!
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {comments.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-body font-semibold text-primary text-sm">
                      {c.author_display_name}
                    </span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <p className="font-body text-foreground/90 mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
