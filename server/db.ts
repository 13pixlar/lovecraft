import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.join(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'app.db')

export function getDbPath() {
  return dbPath
}

export function openDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title_sv TEXT NOT NULL,
      description_sv TEXT NOT NULL DEFAULT '',
      original_title_en TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      filename TEXT NOT NULL UNIQUE,
      title_sv TEXT NOT NULL,
      part_index INTEGER NOT NULL DEFAULT 0,
      duration_seconds REAL
    );

    CREATE TABLE IF NOT EXISTS playback_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
      position_seconds REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position_seconds REAL NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_work ON tracks(work_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_track ON bookmarks(track_id);
  `)

  const row = db.prepare('SELECT COUNT(*) AS c FROM playback_state WHERE id = 1').get() as { c: number }
  if (row.c === 0) {
    db.prepare('INSERT INTO playback_state (id, track_id, position_seconds) VALUES (1, NULL, 0)').run()
  }

  return db
}

export type Db = ReturnType<typeof openDb>
