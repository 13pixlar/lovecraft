# Arkhamsagor — teknisk översikt

Svensk webbapp för att lista och spela MP3-ljudböcker (H.P. Lovecraft, svenska översättningar). All användartext ska vara på **svenska**.

Detta dokument är avsett som ingång för utvecklare/agenter som ska arbeta i repot.

## Arkitektur

- **Frontend:** **Vite + React** (`src/`). Ingen separat Node-backend för produktion.
- **`/books` i utveckling:** [`vite-plugin-books.ts`](vite-plugin-books.ts) serverar katalogen `books/` via Vite (**dev** + **`vite preview`**) med **HTTP Range** för MP3 (seek i spelaren).
- **Data:** [Supabase](https://supabase.com/) (PostgREST) — tabeller med prefix **`lovecraft_*`** (katalog, betyg, kommentarer). Klienten anropar Supabase direkt från webbläsaren (`@supabase/supabase-js`).
- **Källfiler för seed:** [`server/catalog.json`](server/catalog.json) + [`server/covers-map.json`](server/covers-map.json) → [`scripts/load_lovecraft_catalog.py`](scripts/load_lovecraft_catalog.py) (kräver `SUPABASE_URL` + **service role** i miljön).
- **Personliga data:** localStorage (återuppta lyssning, bokmärken, cachade spårlängder).

```
Lokal dev:    npm run dev     → Vite :5173, /books via vite-plugin-books
Förhandsvisning: npm run preview → byggd SPA + samma /books-plugin
Produktion:   Nginx → dist/ + /books/   (ingen Node-process för appen)
```

## Miljövariabler (Vite)

| Variabel | Var |
|----------|-----|
| `VITE_SUPABASE_URL` | Projektets API-URL, t.ex. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon-nyckel (Dashboard → Settings → API) |
| `VITE_SITE_URL` | **Valfri men rekommenderad i produktion:** kanonisk publik bas-URL utan avslutande snedstreck, t.ex. `https://www.example.com`. Används för sitemap, Open Graph, kanoniska länkar och strukturerad data. Utan värde används webbläsarens origin (bra lokalt). |

- **Lokalt:** kopiera [`.env.example`](.env.example) till **`.env.local`** och fyll i värden. `*.local` är gitignorerat.
- **Build:** Vite läser `.env`, `.env.local`, `.env.production` m.m. — nycklarna **bakas in i klientbundle**; bygg om om du byter projekt eller nyckel.

## Kommandon

| Script | Beskrivning |
|--------|-------------|
| `npm run dev` | Vite dev server (standardport 5173), `/books` från plugin |
| `npm run build` | `tsc -b` + `vite build` + genererar `dist/sitemap.xml` och `dist/robots.txt` från [`server/catalog.json`](server/catalog.json) |
| `npm run deploy` | Kör endast `build` — lägg till eget steg (rsync, `systemctl reload nginx`, etc.) i er pipeline |
| `npm run preview` | Lokalt: serverar `dist/` + `/books` via samma plugin |
| `npm run lint` | ESLint |
| `npm run seed:catalog` | Python: laddar/ uppdaterar katalogtabeller i Supabase |

**På servern vid deploy:** kör **`npm ci`** (eller `npm install`) i repokatalogen **före** `npm run build` så att `node_modules` innehåller bl.a. `@supabase/supabase-js`.

## Att sätta live (checklista)

1. **Installera beroenden:** `npm ci` (rekommenderat om `package-lock.json` följer med).
2. **Bygg:** sätt `VITE_SUPABASE_*` (eller använd `.env.production` på byggmaskinen) och kör `npm run build`.
3. **Publicera `dist/`** till webbservern (rsync, artifact, etc.).
4. **Nginx** (eller motsvarande):
   - `root` → katalog med innehållet i `dist/`
   - SPA-fallback: `try_files $uri $uri/ /index.html;`
   - `location /books/` → `alias` till repots [`books/`](books/) (MP3 + `covers/`)
5. **HTTPS:** t.ex. Let’s Encrypt.
6. **Ingen** separat systemd-tjänst för `npm start` / Node behövs för denna app om Nginx redan serverar statik + `/books`.
7. **Supabase:** säkerställ att migrationer är applicerade och katalog seedad om databasen är tom.
8. **SEO:** sätt `VITE_SITE_URL` till den kanoniska domänen vid `npm run build` så att `sitemap.xml` och metadata får rätt absoluta URL:er. Välj **en** variant (www eller apex) och låt Nginx göra **301**-omdirigering från den andra. Efter deploy: verifiera sajten i [Google Search Console](https://search.google.com/search-console) och [Bing Webmaster Tools](https://www.bing.com/webmasters), skicka in `https://<din-domän>/sitemap.xml`.

Se [`deploy/nginx-lovecraft.conf.example`](deploy/nginx-lovecraft.conf.example).

## Katalogstruktur (relevant)

| Sökväg | Roll |
|--------|------|
| [`src/`](src/) | React-app, router (`/`, `/verk/:slug`, `/bokmarken`) |
| [`src/lib/supabaseClient.ts`](src/lib/supabaseClient.ts) | `createClient` + env |
| [`src/lib/api/catalog.ts`](src/lib/api/catalog.ts) | Hämtar verk/spår från Supabase |
| [`src/lib/api/ratings.ts`](src/lib/api/ratings.ts), [`comments.ts`](src/lib/api/comments.ts) | Betyg och kommentarer |
| [`src/lib/database.types.ts`](src/lib/database.types.ts) | Typer för Supabase-tabeller (uppdatera vid schemaändring) |
| [`vite-plugin-books.ts`](vite-plugin-books.ts) | Dev/preview: `/books` |
| [`server/catalog.json`](server/catalog.json), [`server/covers-map.json`](server/covers-map.json) | Seed-källor (inte en runtime-server) |
| [`books/`](books/) | MP3 + omslag på disk |
| [`supabase/migrations/`](supabase/migrations/) | SQL-migrationer |
| [`deploy/nginx-lovecraft.conf.example`](deploy/nginx-lovecraft.conf.example) | Nginx-exempel |

## Supabase

1. Applicera SQL i [`supabase/migrations/`](supabase/migrations/) (dashboard eller CLI).
2. Sätt `SUPABASE_URL` + **`SUPABASE_SERVICE_ROLE_KEY`** och kör `npm run seed:catalog` när katalog-JSON ändrats.
3. **Anon**-nyckel till frontend: `VITE_SUPABASE_ANON_KEY` vid build/lokal utveckling.

## ESLint

[`eslint.config.js`](eslint.config.js) ignorerar bland annat `dist/`, `src/components/ui/**`, `syntaxerror/**`.

## Vanliga tillägg

1. **Nytt verk / nya filer:** uppdatera `books/`, `server/catalog.json`, `server/covers-map.json`, kör seed mot Supabase.
2. **Howler:** [`src/lib/howler.ts`](src/lib/howler.ts); `optimizeDeps.include: ['howler']` i [`vite.config.ts`](vite.config.ts).
