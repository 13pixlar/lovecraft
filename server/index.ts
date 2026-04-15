import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { openDb } from './db.js'
import { runSeed } from './seed.js'

const rootDir = process.cwd()
const booksDir = path.join(rootDir, 'books')

const coversMap = JSON.parse(
  readFileSync(path.join(rootDir, 'server/covers-map.json'), 'utf8'),
) as Record<string, string>

function coverUrlForSlug(slug: string): string | null {
  const fn = coversMap[slug]
  if (!fn) return null
  return `/books/covers/${encodeURIComponent(fn)}`
}

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.mp3':
      return 'audio/mpeg'
    default:
      return 'application/octet-stream'
  }
}

const db = openDb()

function ensureCatalog() {
  const n = db.prepare('SELECT COUNT(*) AS c FROM works').get() as { c: number }
  if (n.c === 0) {
    console.log('Tom databas — kör seed …')
    runSeed()
  }
}

ensureCatalog()

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

function safeBookPath(rel: string): string | null {
  const decoded = decodeURIComponent(rel)
  const normalized = path.normalize(decoded)
  if (normalized.includes('..')) return null
  const full = path.join(booksDir, normalized)
  const resolved = path.resolve(full)
  if (!resolved.startsWith(path.resolve(booksDir))) return null
  return resolved
}

app.get('/books/*', async (c) => {
  const rel = c.req.path.replace(/^\/books\/?/, '')
  const filePath = safeBookPath(rel)
  if (!filePath || !existsSync(filePath)) {
    return c.text('Fil hittades inte', 404)
  }
  const stat = statSync(filePath)
  const size = stat.size
  const range = c.req.header('range')
  const ct = contentTypeForFile(filePath)
  const isAudio = ct === 'audio/mpeg'

  if (range && isAudio) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!m) {
      return c.text('Ogiltigt intervall', 416)
    }
    const start = m[1] !== '' ? parseInt(m[1], 10) : 0
    let end = m[2] !== '' ? parseInt(m[2], 10) : size - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start >= size) {
      return c.text('Intervall utanför filen', 416)
    }
    end = Math.min(end, size - 1)
    const chunkSize = end - start + 1
    const stream = createReadStream(filePath, { start, end })
    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        AcceptRanges: 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  if (range && !isAudio) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (m) {
      const start = m[1] !== '' ? parseInt(m[1], 10) : 0
      let end = m[2] !== '' ? parseInt(m[2], 10) : size - 1
      if (!Number.isNaN(start) && !Number.isNaN(end) && start < size) {
        end = Math.min(end, size - 1)
        const chunkSize = end - start + 1
        const stream = createReadStream(filePath, { start, end })
        return new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${size}`,
            AcceptRanges: 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    }
  }

  const stream = createReadStream(filePath)
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Length': String(size),
      'Content-Type': ct,
      ...(isAudio ? { AcceptRanges: 'bytes' as const } : {}),
      'Cache-Control': 'public, max-age=86400',
    },
  })
})

app.get('/api/works', (c) => {
  const works = db
    .prepare(
      `SELECT w.id, w.slug, w.title_sv, w.description_sv, w.original_title_en, w.sort_order,
        (SELECT COUNT(*) FROM tracks t WHERE t.work_id = w.id) AS track_count
       FROM works w ORDER BY w.sort_order ASC`,
    )
    .all() as Array<{
      id: number
      slug: string
      title_sv: string
      description_sv: string
      original_title_en: string | null
      sort_order: number
      track_count: number
    }>

  const pb = db
    .prepare(
      `SELECT ps.track_id, ps.position_seconds, ps.updated_at,
        t.work_id, t.filename, t.title_sv AS track_title
       FROM playback_state ps
       LEFT JOIN tracks t ON t.id = ps.track_id
       WHERE ps.id = 1`,
    )
    .get() as {
      track_id: number | null
      position_seconds: number
      updated_at: string
      work_id: number | null
      filename: string | null
      track_title: string | null
    } | undefined

  return c.json({
    works: works.map((w) => ({
      ...w,
      coverUrl: coverUrlForSlug(w.slug),
    })),
    resume:
      pb?.track_id != null
        ? {
            trackId: pb.track_id,
            workId: pb.work_id,
            positionSeconds: pb.position_seconds,
            updatedAt: pb.updated_at,
            trackTitle: pb.track_title,
            filename: pb.filename,
          }
        : null,
  })
})

app.get('/api/works/:slug', (c) => {
  const slug = c.req.param('slug')
  const work = db
    .prepare('SELECT * FROM works WHERE slug = ?')
    .get(slug) as
    | {
        id: number
        slug: string
        title_sv: string
        description_sv: string
        original_title_en: string | null
        sort_order: number
      }
    | undefined
  if (!work) return c.json({ error: 'Verk hittades inte' }, 404)

  const tracks = db
    .prepare(
      `SELECT id, filename, title_sv, part_index, duration_seconds
       FROM tracks WHERE work_id = ? ORDER BY part_index ASC`,
    )
    .all(work.id) as Array<{
      id: number
      filename: string
      title_sv: string
      part_index: number
      duration_seconds: number | null
    }>

  const withUrls = tracks.map((t) => ({
    ...t,
    audioUrl: `/books/${encodeURIComponent(t.filename)}`,
  }))

  return c.json({
    work: {
      ...work,
      coverUrl: coverUrlForSlug(work.slug),
    },
    tracks: withUrls,
  })
})

app.get('/api/tracks/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return c.json({ error: 'Ogiltigt id' }, 400)
  const row = db
    .prepare(
      `SELECT t.*, w.slug AS work_slug, w.title_sv AS work_title_sv
       FROM tracks t JOIN works w ON w.id = t.work_id WHERE t.id = ?`,
    )
    .get(id) as
    | {
        id: number
        work_id: number
        filename: string
        title_sv: string
        part_index: number
        duration_seconds: number | null
        work_slug: string
        work_title_sv: string
      }
    | undefined
  if (!row) return c.json({ error: 'Spår hittades inte' }, 404)
  return c.json({
    track: {
      id: row.id,
      workId: row.work_id,
      filename: row.filename,
      titleSv: row.title_sv,
      partIndex: row.part_index,
      durationSeconds: row.duration_seconds,
      workSlug: row.work_slug,
      workTitleSv: row.work_title_sv,
      audioUrl: `/books/${encodeURIComponent(row.filename)}`,
    },
  })
})

app.get('/api/playback', (c) => {
  const pb = db
    .prepare(
      `SELECT ps.track_id, ps.position_seconds, ps.updated_at,
        t.work_id, t.filename, t.title_sv AS track_title, w.slug AS work_slug, w.title_sv AS work_title
       FROM playback_state ps
       LEFT JOIN tracks t ON t.id = ps.track_id
       LEFT JOIN works w ON w.id = t.work_id
       WHERE ps.id = 1`,
    )
    .get() as
    | {
        track_id: number | null
        position_seconds: number
        updated_at: string
        work_id: number | null
        filename: string | null
        track_title: string | null
        work_slug: string | null
        work_title: string | null
      }
    | undefined
  if (!pb) return c.json({ playback: null })
  return c.json({
    playback:
      pb.track_id != null
        ? {
            trackId: pb.track_id,
            workId: pb.work_id,
            positionSeconds: pb.position_seconds,
            updatedAt: pb.updated_at,
            trackTitle: pb.track_title,
            filename: pb.filename,
            workSlug: pb.work_slug,
            workTitle: pb.work_title,
          }
        : null,
  })
})

app.patch('/api/playback', async (c) => {
  const body = (await c.req.json()) as {
    trackId?: number
    positionSeconds?: number
  }
  const trackId = body.trackId ?? null
  const positionSeconds =
    typeof body.positionSeconds === 'number' && !Number.isNaN(body.positionSeconds)
      ? Math.max(0, body.positionSeconds)
      : 0

  if (trackId != null) {
    const t = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId) as { id: number } | undefined
    if (!t) return c.json({ error: 'Spår finns inte' }, 400)
  }

  db.prepare(
    `UPDATE playback_state SET track_id = ?, position_seconds = ?, updated_at = datetime('now') WHERE id = 1`,
  ).run(trackId, positionSeconds)

  return c.json({ ok: true })
})

app.get('/api/bookmarks', (c) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.track_id, b.position_seconds, b.label, b.created_at,
        t.title_sv AS track_title, t.filename, w.slug AS work_slug, w.title_sv AS work_title
       FROM bookmarks b
       JOIN tracks t ON t.id = b.track_id
       JOIN works w ON w.id = t.work_id
       ORDER BY b.created_at DESC`,
    )
    .all() as Array<{
      id: number
      track_id: number
      position_seconds: number
      label: string | null
      created_at: string
      track_title: string
      filename: string
      work_slug: string
      work_title: string
    }>

  return c.json({
    bookmarks: rows.map((r) => ({
      id: r.id,
      trackId: r.track_id,
      positionSeconds: r.position_seconds,
      label: r.label,
      createdAt: r.created_at,
      trackTitle: r.track_title,
      filename: r.filename,
      workSlug: r.work_slug,
      workTitle: r.work_title,
    })),
  })
})

app.post('/api/bookmarks', async (c) => {
  const body = (await c.req.json()) as {
    trackId?: number
    positionSeconds?: number
    label?: string | null
  }
  const trackId = body.trackId
  const positionSeconds = body.positionSeconds
  if (typeof trackId !== 'number' || typeof positionSeconds !== 'number') {
    return c.json({ error: 'trackId och positionSeconds krävs' }, 400)
  }
  const t = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId) as { id: number } | undefined
  if (!t) return c.json({ error: 'Spår finns inte' }, 400)

  const info = db
    .prepare(
      `INSERT INTO bookmarks (track_id, position_seconds, label) VALUES (?, ?, ?)`,
    )
    .run(trackId, Math.max(0, positionSeconds), body.label?.trim() || null)

  const id = Number(info.lastInsertRowid)
  return c.json({ id })
})

app.delete('/api/bookmarks/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return c.json({ error: 'Ogiltigt id' }, 400)
  const r = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  if (r.changes === 0) return c.json({ error: 'Bokmärke hittades inte' }, 404)
  return c.json({ ok: true })
})

app.patch('/api/tracks/:id/duration', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return c.json({ error: 'Ogiltigt id' }, 400)
  const body = (await c.req.json()) as { durationSeconds?: number }
  const d = body.durationSeconds
  if (typeof d !== 'number' || d < 0) return c.json({ error: 'durationSeconds krävs' }, 400)
  const r = db.prepare('UPDATE tracks SET duration_seconds = ? WHERE id = ?').run(d, id)
  if (r.changes === 0) return c.json({ error: 'Spår hittades inte' }, 404)
  return c.json({ ok: true })
})

const isProd = process.env.NODE_ENV === 'production'

if (isProd && existsSync('./dist')) {
  app.use(
    '/*',
    serveStatic({
      root: './dist',
      rewriteRequestPath: (p) => (p === '/' ? '/index.html' : p),
    }),
  )
  app.notFound((c) => {
    try {
      const html = readFileSync(path.join(rootDir, 'dist', 'index.html'), 'utf8')
      return c.html(html)
    } catch {
      return c.text('Saknas', 404)
    }
  })
}

const port = parseInt(process.env.PORT ?? '3001', 10)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API lyssnar på http://localhost:${info.port}`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${port} är redan upptagen. Stoppa den andra processen, t.ex.:\n  fuser -k ${port}/tcp\n  # eller: kill $(lsof -t -i:${port})\n`,
    )
  } else {
    console.error(err)
  }
  process.exit(1)
})
