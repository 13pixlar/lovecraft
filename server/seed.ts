import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'),
) as {
  works: Array<{
    slug: string
    title_sv: string
    description_sv: string
    original_title_en: string
    tracks: string[]
  }>
}

const booksDir = path.join(process.cwd(), 'books')

function assertFilesExist() {
  for (const w of catalog.works) {
    for (const f of w.tracks) {
      const p = path.join(booksDir, f)
      if (!fs.existsSync(p)) {
        throw new Error(`Saknar ljudfil: ${f}`)
      }
    }
  }
}

export function runSeed() {
  assertFilesExist()
  const db = openDb()
  db.exec('DELETE FROM bookmarks')
  db.exec('DELETE FROM tracks')
  db.exec('DELETE FROM works')
  db.prepare('UPDATE playback_state SET track_id = NULL, position_seconds = 0, updated_at = datetime(\'now\') WHERE id = 1').run()

  const insWork = db.prepare(
    `INSERT INTO works (slug, title_sv, description_sv, original_title_en, sort_order)
     VALUES (@slug, @title_sv, @description_sv, @original_title_en, @sort_order)`,
  )
  const insTrack = db.prepare(
    `INSERT INTO tracks (work_id, filename, title_sv, part_index, duration_seconds)
     VALUES (@work_id, @filename, @title_sv, @part_index, NULL)`,
  )

  const tx = db.transaction(() => {
    catalog.works.forEach((w, wi) => {
      const info = insWork.run({
        slug: w.slug,
        title_sv: w.title_sv,
        description_sv: w.description_sv,
        original_title_en: w.original_title_en,
        sort_order: wi,
      })
      const workId = Number(info.lastInsertRowid)
      w.tracks.forEach((filename, ti) => {
        const title_sv =
          w.tracks.length > 1 ? `${w.title_sv} — del ${ti + 1}` : w.title_sv
        insTrack.run({
          work_id: workId,
          filename,
          title_sv,
          part_index: ti,
        })
      })
    })
  })

  tx()
  db.close()
  console.log('Databas seed klar:', catalog.works.length, 'verk.')
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  runSeed()
}
