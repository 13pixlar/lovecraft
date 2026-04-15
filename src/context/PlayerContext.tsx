/* eslint-disable react-refresh/only-export-components -- provider + hook belong together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Howl } from '@/lib/howler'
import type { TrackRow } from '@/lib/types'
import * as storage from '@/lib/storage'

type PlayerContextValue = {
  workSlug: string | null
  workTitle: string | null
  tracks: TrackRow[]
  currentIndex: number
  currentTrack: TrackRow | null
  isPlaying: boolean
  position: number
  duration: number
  rate: number
  playWork: (
    slug: string,
    title: string,
    list: TrackRow[],
    startIndex?: number,
    seekTo?: number,
  ) => void
  playTrackAt: (index: number) => void
  toggle: () => void
  seek: (seconds: number) => void
  next: () => void
  prev: () => void
  setRate: (r: number) => void
  addBookmark: (label?: string | null) => Promise<void>
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

const SAVE_INTERVAL_MS = 5000

function audioSrc(url: string) {
  return new URL(url, window.location.origin).href
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [workSlug, setWorkSlug] = useState<string | null>(null)
  const [workTitle, setWorkTitle] = useState<string | null>(null)
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRateState] = useState(1)

  const howlRef = useRef<Howl | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const positionRafRef = useRef<number | null>(null)
  const tracksRef = useRef<TrackRow[]>([])
  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  const currentTrack = tracks[currentIndex] ?? null

  const clearHowl = useCallback(() => {
    if (positionRafRef.current != null) {
      cancelAnimationFrame(positionRafRef.current)
      positionRafRef.current = null
    }
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (howlRef.current) {
      howlRef.current.unload()
      howlRef.current = null
    }
  }, [])

  const persistPlayback = useCallback(
    (track: TrackRow | null, pos: number) => {
      if (!track || !workSlug) return
      storage.savePlayback({
        workSlug,
        trackId: track.id,
        positionSeconds: Math.max(0, pos),
        updatedAt: new Date().toISOString(),
        trackTitle: track.title_sv ?? null,
        filename: track.filename ?? null,
      })
    },
    [workSlug],
  )

  const startPositionLoop = useCallback(() => {
    const tick = () => {
      const h = howlRef.current
      if (h?.playing()) {
        setPosition(h.seek() as number)
        positionRafRef.current = requestAnimationFrame(tick)
      }
    }
    positionRafRef.current = requestAnimationFrame(tick)
  }, [])

  const loadHowlAtIndexRef = useRef<(index: number, seekTo: number, list: TrackRow[]) => void>(
    () => {},
  )

  const loadHowlAtIndex = useCallback(
    (index: number, seekTo: number, list: TrackRow[]) => {
      clearHowl()
      const tr = list[index]
      if (!tr) return

      setCurrentIndex(index)

      const howl = new Howl({
        src: [audioSrc(tr.audioUrl)],
        html5: true,
        preload: true,
        rate: rate,
      })

      howlRef.current = howl

      howl.once('load', () => {
        const d = howl.duration()
        setDuration(d)
        storage.saveDuration(tr.id, d)
        const s = Math.min(Math.max(0, seekTo), Math.max(0, d - 0.25))
        howl.seek(s)
        setPosition(s)
        persistPlayback(tr, s)
        howl.play()
      })

      howl.on('play', () => {
        setIsPlaying(true)
        startPositionLoop()
        if (saveTimerRef.current) clearInterval(saveTimerRef.current)
        saveTimerRef.current = setInterval(() => {
          const hh = howlRef.current
          if (!hh?.playing()) return
          const t = tracksRef.current[index] ?? null
          if (!t) return
          persistPlayback(t, hh.seek() as number)
        }, SAVE_INTERVAL_MS)
      })

      howl.on('pause', () => {
        setIsPlaying(false)
        if (positionRafRef.current != null) {
          cancelAnimationFrame(positionRafRef.current)
          positionRafRef.current = null
        }
        if (saveTimerRef.current) {
          clearInterval(saveTimerRef.current)
          saveTimerRef.current = null
        }
        const t = tracksRef.current[index] ?? null
        if (t) persistPlayback(t, howl.seek() as number)
      })

      howl.on('end', () => {
        setIsPlaying(false)
        setPosition(0)
        if (index < list.length - 1) {
          loadHowlAtIndexRef.current(index + 1, 0, list)
        } else {
          persistPlayback(tr, 0)
        }
      })
    },
    [clearHowl, persistPlayback, rate, startPositionLoop],
  )

  useEffect(() => {
    loadHowlAtIndexRef.current = loadHowlAtIndex
  }, [loadHowlAtIndex])

  const playWork = useCallback(
    (slug: string, title: string, list: TrackRow[], startIndex = 0, seekTo = 0) => {
      setWorkSlug(slug)
      setWorkTitle(title)
      setTracks(list)
      loadHowlAtIndex(startIndex, seekTo, list)
    },
    [loadHowlAtIndex],
  )

  const playTrackAt = useCallback(
    (index: number) => {
      if (tracks.length === 0) return
      loadHowlAtIndex(index, 0, tracks)
    },
    [loadHowlAtIndex, tracks],
  )

  useEffect(() => {
    return () => {
      clearHowl()
    }
  }, [clearHowl])

  useEffect(() => {
    const save = () => {
      const h = howlRef.current
      if (!h) return
      const t = tracksRef.current[currentIndex] ?? null
      if (!t) return
      const pos = h.seek() as number
      persistPlayback(t, pos)
    }
    window.addEventListener('beforeunload', save)
    return () => window.removeEventListener('beforeunload', save)
  }, [currentIndex, persistPlayback])

  useEffect(() => {
    const h = howlRef.current
    if (h) h.rate(rate)
  }, [rate])

  const toggle = useCallback(() => {
    const h = howlRef.current
    if (!h) return
    if (h.playing()) h.pause()
    else h.play()
  }, [])

  const seek = useCallback(
    (seconds: number) => {
      const h = howlRef.current
      if (!h) return
      h.seek(seconds)
      setPosition(seconds)
      const t = tracksRef.current[currentIndex] ?? null
      if (t) persistPlayback(t, seconds)
    },
    [currentIndex, persistPlayback],
  )

  const next = useCallback(() => {
    if (currentIndex < tracks.length - 1) playTrackAt(currentIndex + 1)
  }, [currentIndex, playTrackAt, tracks.length])

  const prev = useCallback(() => {
    if (currentIndex > 0) playTrackAt(currentIndex - 1)
  }, [currentIndex, playTrackAt])

  const setRate = useCallback((r: number) => {
    setRateState(r)
  }, [])

  const addBookmark = useCallback(async (label?: string | null) => {
    const t = tracksRef.current[currentIndex]
    if (!t || !workSlug || !workTitle) return
    const h = howlRef.current
    const pos = h ? (h.seek() as number) : position
    storage.addBookmark({
      workSlug,
      workTitle,
      trackId: t.id,
      positionSeconds: Math.max(0, pos),
      label: label?.trim() || null,
      trackTitle: t.title_sv,
      filename: t.filename,
    })
  }, [currentIndex, position, workSlug, workTitle])

  const value = useMemo(
    () =>
      ({
        workSlug,
        workTitle,
        tracks,
        currentIndex,
        currentTrack,
        isPlaying,
        position,
        duration,
        rate,
        playWork,
        playTrackAt,
        toggle,
        seek,
        next,
        prev,
        setRate,
        addBookmark,
      }) satisfies PlayerContextValue,
    [
      workSlug,
      workTitle,
      tracks,
      currentIndex,
      currentTrack,
      isPlaying,
      position,
      duration,
      rate,
      playWork,
      playTrackAt,
      toggle,
      seek,
      next,
      prev,
      setRate,
      addBookmark,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer måste användas inom PlayerProvider')
  return ctx
}
