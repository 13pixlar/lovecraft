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
import * as api from '@/lib/api'
import type { TrackRow } from '@/lib/types'

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

  const persistPlayback = useCallback((trackId: number | null, pos: number) => {
    void api.patchPlayback(trackId, pos)
  }, [])

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
        void api.patchTrackDuration(tr.id, d)
        const s = Math.min(Math.max(0, seekTo), Math.max(0, d - 0.25))
        howl.seek(s)
        setPosition(s)
        persistPlayback(tr.id, s)
        howl.play()
      })

      howl.on('play', () => {
        setIsPlaying(true)
        startPositionLoop()
        if (saveTimerRef.current) clearInterval(saveTimerRef.current)
        saveTimerRef.current = setInterval(() => {
          const hh = howlRef.current
          if (!hh?.playing()) return
          const tid = tracksRef.current[index]?.id
          if (tid == null) return
          persistPlayback(tid, hh.seek() as number)
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
        const tid = tracksRef.current[index]?.id
        if (tid != null) persistPlayback(tid, howl.seek() as number)
      })

      howl.on('end', () => {
        setIsPlaying(false)
        setPosition(0)
        if (index < list.length - 1) {
          loadHowlAtIndexRef.current(index + 1, 0, list)
        } else {
          persistPlayback(tr.id, 0)
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
      const tid = tracksRef.current[currentIndex]?.id
      if (tid == null) return
      const pos = h.seek() as number
      void fetch('/api/playback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: tid, positionSeconds: pos }),
        keepalive: true,
      })
    }
    window.addEventListener('beforeunload', save)
    return () => window.removeEventListener('beforeunload', save)
  }, [currentIndex])

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
      const id = tracksRef.current[currentIndex]?.id
      if (id != null) persistPlayback(id, seconds)
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
    const id = tracksRef.current[currentIndex]?.id
    if (id == null) return
    const h = howlRef.current
    const pos = h ? (h.seek() as number) : position
    await api.postBookmark(id, pos, label)
  }, [currentIndex, position])

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
