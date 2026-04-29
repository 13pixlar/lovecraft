import { useState } from 'react'
import { BookmarkPlus, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePlayer } from '@/context/PlayerContext'
import { formatTime } from '@/lib/format'

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]

export function PlayerBar() {
  const [bmOpen, setBmOpen] = useState(false)
  const [bmLabel, setBmLabel] = useState('')
  const [bmErr, setBmErr] = useState<string | null>(null)
  // Tracks the slider thumb position while the user is actively dragging.
  // null = not dragging; a number = the dragged percentage (0-100).
  const [dragPct, setDragPct] = useState<number | null>(null)

  const {
    workTitle,
    currentTrack,
    tracks,
    currentIndex,
    isPlaying,
    position,
    duration,
    rate,
    toggle,
    seek,
    next,
    prev,
    setRate,
    addBookmark,
  } = usePlayer()

  if (!currentTrack || tracks.length === 0) {
    return (
      <div className="border-border/80 bg-card/95 text-muted-foreground fixed inset-x-0 bottom-0 z-50 w-full max-w-full min-w-0 border-t px-4 py-6 text-center text-sm backdrop-blur-md">
        Välj en berättelse i biblioteket för att börja lyssna.
      </div>
    )
  }

  const pct = duration > 0 ? (position / duration) * 100 : 0
  // While dragging: show the dragged position; otherwise show the real playback position.
  const displayPct = dragPct !== null ? dragPct : pct
  const displayPosition = dragPct !== null ? (dragPct / 100) * duration : position

  return (
    <div className="border-border/80 bg-card/95 fixed inset-x-0 bottom-0 z-50 w-full max-w-full min-w-0 border-t shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-2 px-3 py-3 sm:px-4">
        <div className="min-w-0 text-left">
          <p className="text-muted-foreground truncate text-xs">{workTitle}</p>
          <p className="truncate font-medium">{currentTrack.title_sv}</p>
          {tracks.length > 1 && (
            <p className="text-muted-foreground text-xs">
              Del {currentIndex + 1} av {tracks.length}
            </p>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={prev}
              disabled={currentIndex <= 0}
              aria-label="Föregående spår"
            >
              <SkipBack className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-10 rounded-full"
              onClick={toggle}
              aria-label={isPlaying ? 'Pausa' : 'Spela'}
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 pl-0.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={next}
              disabled={currentIndex >= tracks.length - 1}
              aria-label="Nästa spår"
            >
              <SkipForward className="size-4" />
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Dialog
              open={bmOpen}
              onOpenChange={(open) => {
                setBmOpen(open)
                if (!open) {
                  setBmLabel('')
                  setBmErr(null)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Bokmärke">
                  <BookmarkPlus className="size-4" />
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
                {bmErr ? (
                  <p className="text-destructive text-sm" role="alert">
                    {bmErr}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBmOpen(false)
                      setBmLabel('')
                      setBmErr(null)
                    }}
                  >
                    Avbryt
                  </Button>
                  <Button
                    onClick={async () => {
                      setBmErr(null)
                      try {
                        await addBookmark(bmLabel.trim() || null)
                        setBmLabel('')
                        setBmOpen(false)
                      } catch {
                        setBmErr('Kunde inte spara bokmärket.')
                      }
                    }}
                  >
                    Spara
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 tabular-nums">
                  {rate}×
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={String(rate)}
                  onValueChange={(v) => setRate(parseFloat(v))}
                >
                  {RATES.map((r) => (
                    <DropdownMenuRadioItem key={r} value={String(r)}>
                      {r}× hastighet
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="text-muted-foreground w-11 shrink-0 text-right text-xs tabular-nums sm:w-12">
            {formatTime(displayPosition)}
          </span>
          <Slider
            value={[displayPct]}
            max={100}
            step={0.1}
            onValueChange={([v]) => {
              // Update the visual position while dragging without seeking the audio.
              // This avoids flooding HTML5 audio with rapid currentTime changes on mobile.
              setDragPct(v)
            }}
            onValueCommit={([v]) => {
              // Seek only once when the user releases the slider (pointerup / touchend).
              setDragPct(null)
              if (duration <= 0) return
              seek((v / 100) * duration)
            }}
            className="flex-1"
            aria-label="Uppspelningsposition"
          />
          <span className="text-muted-foreground w-11 shrink-0 text-xs tabular-nums sm:w-12">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
