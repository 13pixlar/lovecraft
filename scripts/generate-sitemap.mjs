import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')

const origin = (process.env.VITE_SITE_URL ?? '').trim().replace(/\/$/, '') || 'http://localhost:5173'
if (!process.env.VITE_SITE_URL?.trim()) {
  console.warn(
    '[generate-sitemap] VITE_SITE_URL is unset; using http://localhost:5173 for sitemap URLs. Set VITE_SITE_URL for production.',
  )
}

const catalogPath = join(root, 'server/catalog.json')
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const lastmod = statSync(catalogPath).mtime.toISOString().split('T')[0]

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const urls = [
  { loc: `${origin}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${origin}/bokmarken`, changefreq: 'monthly', priority: '0.3' },
  ...catalog.works.map((w) => ({
    loc: `${origin}/verk/${encodeURIComponent(w.slug)}`,
    changefreq: 'monthly',
    priority: '0.8',
  })),
]

const urlEntries = urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`

const robots = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`

writeFileSync(join(dist, 'sitemap.xml'), sitemap, 'utf8')
writeFileSync(join(dist, 'robots.txt'), robots, 'utf8')
console.log(`[generate-sitemap] Wrote ${urls.length} URLs to dist/sitemap.xml and dist/robots.txt`)
