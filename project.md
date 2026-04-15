# Arkhamsagor — teknisk översikt

Svensk webbapp för att lista och spela MP3-ljudböcker (H.P. Lovecraft, svenska översättningar). All användartext ska vara på **svenska**.

Detta dokument är avsett som ingång för utvecklare/agenter som ska arbeta i repot.

## Arkitektur

- **Monolit i ett repo:** en **Vite + React**-SPA (`src/`) och en **Node**-HTTP-server (`server/`) som körs samtidigt i utveckling.
- **API + statiska filer:** [Hono](https://hono.dev/) via `@hono/node-server`. Katalogen läses från `server/catalog.json`. Personliga data (återuppta, bokmärken, spårlängder) sparas i webbläsarens **localStorage**.
- **Ljud:** webbläsaren hämtar MP3 under `/books/…`; servern stöder **HTTP Range** för seek/streaming. Spelaren bygger på **Howler.js** (npm `howler@2.2.4`).

```
Webbläsare → Vite :5173 (dev) proxar /api och /books → Node :3001
Produktion: en process (`npm start`) serverar API + statisk `dist/` + /books
```

## Kommandon

| Script | Beskrivning |
|--------|-------------|
| `npm run dev` | `concurrently`: API (`tsx watch server/index.ts`, port **3001**) + Vite (**5173**) |
| `npm run build` | `tsc -b` + `vite build` → `dist/` |
| `npm start` | `NODE_ENV=production tsx server/index.ts` (API + statisk frontend + böcker) |
| `npm run lint` | ESLint (se nedan) |

**Portar:** API lyssnar på `PORT` eller **3001**. Vid `EADDRINUSE` på 3001: frigör porten eller sätt `PORT=…` och uppdatera proxyn i `vite.config.ts` om du byter standard.

## Katalogstruktur (relevant)

| Sökväg | Roll |
|--------|------|
| `src/` | React-app: sidor, layout, spelarkontext, API-klient, typer |
| `src/components/ui/` | shadcn/ui-komponenter (genererade; ESLint ignoreras här) |
| `src/lib/howler.ts` | CJS-interop för Howler (`Howl`) — importera härifrån, inte `import { Howl } from 'howler'` direkt i komponenter |
| `server/index.ts` | Hono-app: `/api/*`, `/books/*` (MP3 + PNG-omslag), prod: `serveStatic` + SPA fallback |
| `server/catalog.json` | Verk, svenska beskrivningar, ordnad lista över MP3-filnamn per verk |
| `server/covers-map.json` | Slug → filnamn under `books/covers/` (API lägger på `coverUrl`) |
| `books/*.mp3` | Ljudfiler (refereras i katalogen) |
| `books/covers/*.png` | Omslag (valfria; mappas via `covers-map.json`) |
| `howler.js/` | Vendorkopia av Howler (referens); **runtime** använder npm-paketet `howler` |
| `components.json` | shadcn-konfiguration |
| `vite.config.ts` | `@`-alias → `src/`, proxy `/api` och `/books` → `127.0.0.1:3001`, `optimizeDeps.include: ['howler']` |

## Backend (API)

- **CORS** i dev mot `localhost:5173` / `127.0.0.1:5173`.
- **Statiska filer under `/books/`:** säker sökväg (ingen `..`). **Content-Type** sätts från filändelse (t.ex. `audio/mpeg`, `image/png`). Range-requests för ljud (och vid behov bilder).
- **Katalog:** servern läser `server/catalog.json` vid start och bygger API-svar i minnet.

Ungefärliga endpoints:

- `GET /api/works` — verk + `track_count`, `coverUrl`
- `GET /api/works/:slug` — verk + spår med `audioUrl`
- (Klientdata) Återuppta/bokmärken/spårlängder sparas lokalt i webbläsaren via `localStorage`.

## Frontend

- **Router:** `react-router-dom` — `/`, `/verk/:slug`, `/bokmarken` ([`src/App.tsx`](src/App.tsx)).
- **Spelare:** [`src/context/PlayerContext.tsx`](src/context/PlayerContext.tsx) — `Howl`-instanser, autospar av position, bokmärken och spårlängd i `localStorage`, automatisk nästa spår i samma verk.
- **API-bas:** relativa URL:er `/api/…` och `/books/…` (proxas i dev).
- **Typer:** [`src/lib/types.ts`](src/lib/types.ts); fetch wrappers i [`src/lib/api.ts`](src/lib/api.ts).

## UI / design

- **shadcn/ui** (Tailwind v4, Radix Nova-preset). Nya komponenter: `npx shadcn@latest add …` (se `components.json`).
- Tema och typsnitt: [`src/index.css`](src/index.css), mörkt Lovecraft-inspirerat utseende.
- Bibliotekskort med omslag: overlay med halvgenomskinlig panel; startsidan döljer synlig titel när omslag finns (`sr-only`) om titeln syns i bilden.

## Produktion

- `npm run build` bygger SPA till `dist/`.
- `npm start` sätter `NODE_ENV=production`; servern mountar statiska filer från `./dist` och fallback till `index.html` för klientrouting.

## ESLint

- `eslint.config.js` ignorerar `dist/`, `src/components/ui/**` och **`server/**`** (servern typkontrolleras inte av samma `tsc -b` som frontend i nuvarande setup).

## Vanliga tillägg för en agent

1. **Nytt verk / nya MP3:** lägg filer i `books/`, uppdatera `server/catalog.json`, starta om dev-servern vid behov.
2. **Nytt omslag:** fil i `books/covers/`, ny rad i `server/covers-map.json` (slug → exakt filnamn).
3. **Howler:** utöka [`src/lib/howler.ts`](src/lib/howler.ts) vid behov; behåll `optimizeDeps.include: ['howler']` i Vite.
