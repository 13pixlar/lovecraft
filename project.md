# Arkhamsagor — teknisk översikt

Svensk webbapp för att lista och spela MP3-ljudböcker (H.P. Lovecraft, svenska översättningar). All användartext ska vara på **svenska**.

Detta dokument är avsett som ingång för utvecklare/agenter som ska arbeta i repot.

## Arkitektur

- **Frontend:** **Vite + React** (`src/`). Ingen separat Node-backend för produktion.
- **`/books` i utveckling:** [`vite-plugin-books.ts`](vite-plugin-books.ts) serverar `books/` via Vite (dev + `vite preview`) med **HTTP Range** för MP3.
- **Katalog + betyg/kommentarer:** [Supabase](https://supabase.com/) — tabeller `lovecraft_*`. Klienten använder **`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`** (`.env.local`).
- **Källfil för seed:** `server/catalog.json` + `server/covers-map.json` → `scripts/load_lovecraft_catalog.py` (service role).
- **Personliga data:** localStorage (återuppta, bokmärken, spårlängder).

```
Lokal dev: npm run dev (Vite :5173, /books från vite-plugin-books)
Produktion: Nginx → dist/ + /books/ (ingen Node-process)
```

## Kommandon

| Script | Beskrivning |
|--------|-------------|
| `npm run dev` | Vite dev server (5173), `/books` från plugin |
| `npm run build` | `tsc -b` + `vite build` → `dist/` |
| `npm run deploy` | Kör `build` (lägg gärna till egen Nginx/systemd-steg på servern) |
| `npm run preview` | Förhandsgranskning av produktionsbuild; `/books` via samma plugin |
| `npm run lint` | ESLint |
| `npm run seed:catalog` | Laddar katalog till Supabase (Python + env) |

## Att sätta live (översikt)

1. **Bygg:** på byggmaskin eller server: `npm run build` med `VITE_SUPABASE_*` satta (eller `.env.production` / CI secrets).
2. **Synka `dist/`** till servern (rsync, git artifact, etc.).
3. **Nginx** (eller motsvarande):
   - `root` → katalog med innehållet i `dist/`
   - `try_files` för SPA: `try_files $uri $uri/ /index.html;`
   - `location /books/` → `alias` till repots `books/` (MP3 + `covers/`)
4. **SSL:** t.ex. Let’s Encrypt (certbot).
5. **Systemd / Node:** ingen Node-process krävs för appen. Ta bort eller inaktivera gamla enheter som startade `npm start` / Hono om de fanns.
6. **Miljö:** Supabase-nycklar bakas in vid **build**-tid; bygg om efter byte av projekt/nyckel.

Se även [`deploy/nginx-lovecraft.conf.example`](deploy/nginx-lovecraft.conf.example).

## Katalogstruktur (relevant)

| Sökväg | Roll |
|--------|------|
| `src/` | React-app |
| `vite-plugin-books.ts` | Dev/preview: statiska `/books` |
| `server/catalog.json`, `server/covers-map.json` | Seed-källor |
| `books/` | MP3 + omslag (Nginx eller Vite-plugin) |
| `supabase/migrations/` | SQL |
| `deploy/nginx-lovecraft.conf.example` | Nginx-exempel |

## Supabase

1. Applicera migrationer.
2. `SUPABASE_URL` + service role → `npm run seed:catalog` (eller motsvarande).
3. Anon/public key → `VITE_SUPABASE_ANON_KEY` vid build/lokal `.env.local`.

## ESLint

- `eslint.config.js` ignorerar `dist/`, `src/components/ui/**`, `syntaxerror/**`.

## Vanliga tillägg

1. Nytt verk: uppdatera `books/`, JSON-filer, kör seed.
2. Howler: [`src/lib/howler.ts`](src/lib/howler.ts).
