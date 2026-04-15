import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

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

function safeBookPath(booksDir: string, rel: string): string | null {
  const decoded = decodeURIComponent(rel)
  const normalized = path.normalize(decoded)
  if (normalized.includes('..')) return null
  const full = path.join(booksDir, normalized)
  const resolved = path.resolve(full)
  if (!resolved.startsWith(path.resolve(booksDir))) return null
  return resolved
}

/** Serves repo /books in dev and preview (Range requests for MP3). Production uses Nginx. */
export function vitePluginBooks(booksDir: string): Plugin {
  const root = path.resolve(booksDir)

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const rawUrl = req.url
    if (!rawUrl?.startsWith('/books')) return next()
    const pathname = new URL(rawUrl, 'http://localhost').pathname
    const rel = pathname.replace(/^\/books\/?/, '')
    const filePath = safeBookPath(root, rel)
    if (!filePath || !existsSync(filePath)) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Fil hittades inte')
      return
    }

    const stat = statSync(filePath)
    const size = stat.size
    const range = req.headers.range
    const ct = contentTypeForFile(filePath)
    const isAudio = ct === 'audio/mpeg'

    if (range && isAudio) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!m) {
        res.statusCode = 416
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Ogiltigt intervall')
        return
      }
      const start = m[1] !== '' ? parseInt(m[1], 10) : 0
      let end = m[2] !== '' ? parseInt(m[2], 10) : size - 1
      if (Number.isNaN(start) || Number.isNaN(end) || start >= size) {
        res.statusCode = 416
        res.end('Intervall utanför filen')
        return
      }
      end = Math.min(end, size - 1)
      const chunkSize = end - start + 1
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Length', String(chunkSize))
      res.setHeader('Content-Type', ct)
      res.setHeader('Cache-Control', 'public, max-age=3600')
      createReadStream(filePath, { start, end }).pipe(res)
      return
    }

    if (range && !isAudio) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (m) {
        const start = m[1] !== '' ? parseInt(m[1], 10) : 0
        let end = m[2] !== '' ? parseInt(m[2], 10) : size - 1
        if (!Number.isNaN(start) && !Number.isNaN(end) && start < size) {
          end = Math.min(end, size - 1)
          const chunkSize = end - start + 1
          res.statusCode = 206
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
          res.setHeader('Accept-Ranges', 'bytes')
          res.setHeader('Content-Length', String(chunkSize))
          res.setHeader('Content-Type', ct)
          res.setHeader('Cache-Control', 'public, max-age=86400')
          createReadStream(filePath, { start, end }).pipe(res)
          return
        }
      }
    }

    res.statusCode = 200
    res.setHeader('Content-Length', String(size))
    res.setHeader('Content-Type', ct)
    if (isAudio) res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    createReadStream(filePath).pipe(res)
  }

  return {
    name: 'vite-plugin-books',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
