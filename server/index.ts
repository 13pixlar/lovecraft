import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const booksDir = path.join(rootDir, 'books')

type Catalog = {
  works: Array<{
    slug: string
    title_sv: string
    original_title_en?: string | null
    description_sv: string
    tracks: string[]
  }>
}

const catalog = JSON.parse(readFileSync(path.join(rootDir, 'server/catalog.json'), 'utf8')) as Catalog

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

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    allowMethods: ['GET', 'OPTIONS'],
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
  return c.json({
    works: catalog.works.map((w, sort_order) => ({
      id: w.slug,
      slug: w.slug,
      title_sv: w.title_sv,
      description_sv: w.description_sv,
      original_title_en: w.original_title_en ?? null,
      sort_order,
      track_count: w.tracks.length,
      coverUrl: coverUrlForSlug(w.slug),
    })),
  })
})

app.get('/api/works/:slug', (c) => {
  const slug = c.req.param('slug')
  const wi = catalog.works.findIndex((w) => w.slug === slug)
  if (wi < 0) return c.json({ error: 'Verk hittades inte' }, 404)
  const w = catalog.works[wi]!

  return c.json({
    work: {
      id: w.slug,
      slug: w.slug,
      title_sv: w.title_sv,
      description_sv: w.description_sv,
      original_title_en: w.original_title_en ?? null,
      sort_order: wi,
      coverUrl: coverUrlForSlug(w.slug),
    },
    tracks: w.tracks.map((filename, part_index) => ({
      id: filename,
      filename,
      title_sv: w.tracks.length > 1 ? `${w.title_sv} — del ${part_index + 1}` : w.title_sv,
      part_index,
      duration_seconds: null as number | null,
      audioUrl: `/books/${encodeURIComponent(filename)}`,
    })),
  })
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
