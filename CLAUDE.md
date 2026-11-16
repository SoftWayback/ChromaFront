# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

ChromaFront is a SvelteKit 5 app scaffolded from the minimal `sv` template with JSDoc-based typing (no `.ts` source files — types are checked via `jsconfig.json` + `svelte-check` against JSDoc comments). It is the private admin: landing/sign-in page, then protected Dashboard, Entités (rides), Articles and DB screens.

## Commands

```sh
npm run dev            # start dev server (add -- --open to open a browser tab)
npm run build           # production build
npm run preview          # preview the production build
npm run check           # svelte-kit sync + svelte-check (type/diagnostics check across the project)
npm run check:watch       # same, in watch mode
```

There is no test runner or lint script configured in `package.json` — don't assume `npm test`/`npm run lint` exist.

## Architecture

- SvelteKit with `adapter-node` (svelte.config.js) — the target is a Node server in a Docker image on CapRover, see "Deployment" below.
- Routing is filesystem-based under `src/routes`:
  - `/` (`+page.svelte`) — the landing / sign-in page (Sidebar + HeroImage).
  - `/login` — where the backend redirects after a successful Google login; confirms the session then bounces to `/dashboard` or `/`.
  - `/Error` — login failure page, reads `?type=&message=` (capital `E`, matches the backend redirect).
  - `(protected)/` — route group (`+layout.js` sets `ssr = false`) whose `+layout.svelte` guards on `isAuthenticated()` and redirects to `/` when unauthed. Holds `/dashboard`, `/entities`, `/entities/[id]`, `/articles`, `/articles/[id]`, `/stats` and `/db` (the group parens don't change the URL). Each page renders `NavSidebar` + a `<main class="content">`.
  - `/articles` — articles admin list (cover thumbnail, title + slug, Brouillon/Publié badge, dates, Modifier / Supprimer with inline confirm, Tous/Brouillons/Publiés filter, empty state, "Nouvel article").
  - `/articles/[id]` — the editor (`ArticleEditor.svelte`). `id = "new"` creates; there is deliberately **no** `articles/new/` folder: after the first save the editor `goto`s `/articles/<id>` (replaceState) on the *same* route, so the component stays mounted with the article in hand instead of reloading.
  - `/dashboard` ("Live") — fed by ChromaBack's `/dashboard/{overview,live,wait-times}` + `/rides/lands` (all JWT, see ChromaBack/CLAUDE.md). No placeholder data: skeleton / error / empty states. Header "Relevé il y a … · actualisé il y a …" + "Actualiser"; overview + live auto-refresh every 60 s (skipped while `document.hidden`, caught up on `visibilitychange`), the chart too when it shows the latest day. Blocks: `KpiRow` (dernier relevé — red if `late`, "cron désactivé" —, ouvertes x/y, attente moyenne, plus longue attente → `/entities/<rideId>`, relevés aujourd'hui), `LiveTable` (all ~40 rides in one response, sorted/filtered client-side: search on name + land, type select, "Ouvertes" toggle; sort name / live / précédent, default longest wait first; wait colour ≤15 mint, ≤45 gold, >45 red, "Fermé", "—" = no measurement; ▲/▼ trend vs previous poll; type badge + land under the name; virtual lines dimmed; row → `/entities/<rideId>` when catalogued), `SystemPanel` (DB size / rows, articles, catalogue incomplete / no photo, stats cache entries / stored size / warm-up, Rulantica + weather last poll, links to `/stats` and `/db`), `WaitTimeChart` (scope chips park / coaster / flat / dark / water / Quartier + land select — `show` is not a scope —, day select from `days`, null slot = no bar, hover/tap readout with rides count). Down to ~360 px: the live table stacks name / badge / land, the chart scrolls inside its own box (`min-width` 620 px).
  - `/db` ("Gestion DB") — `GET /db/overview`: env badge (production red/gold, development mint) + database name, Maintenance (the 4 `POST /db/actions/:action`: warm-stats, sync-holidays, purge-tokens with `confirm()`, analyze — per-action spinner / result / error, all disabled while one runs, overview reloaded after; while `statsCache.warmup.running` the overview is re-polled every 10 s), PostgreSQL card (version, uptime, size, connections), schema check (expected table per migration ✓/✗), refresh tokens, holidays coverage, tables (rows ≈ n_live_tup, total / data / index size with a size bar, last vacuum / analyze), collection per day (14 days; days with fewer weather snapshots than polls are flagged gold), catalogue gaps (uncatalogued ApiIDs, incomplete sheets with missing-field chips → `/entities/<id>`), stats cache by kind + warm-up status. Cache sizes are the **stored** (TOAST-compressed) size: label them "taille stockée".
  - `/stats` — admin panel for ChromaBack's statistics engine (see ChromaBack/CLAUDE.md "Statistics engine"). The cache is pre-computed automatically by the backend warm-up, so "Tout recalculer" only forces. `GET /stats/cache` excludes `ride:*` keys by default; if some ever arrive they are hidden and summarised in one line pointing to `/db`. "Tout recalculer" (`POST /stats/recompute` with no period, ~50 s), quick buttons (Aujourd'hui / 3 derniers jours / Depuis le début / Baselines) + month / week selects fed by `/public/stats/periods`, the `"StatsCache"` table (`GET /stats/cache`; label + key, relative "il y a 12 min" with absolute on hover, "Figé" / "expire dans …" / "expiré", size in Ko, per-row "Recalculer" — not for `periods`, which only the full recompute refreshes), and a compact sanity preview of the `all` bundle (`/public/stats?period=all`, fetched `no-store`). Only one recompute runs at a time: every recompute button is disabled while one is in flight, with a spinner + elapsed-seconds banner; the fetch has no client timeout. Returned timings are shown afterwards and the table (plus periods / preview when relevant) is reloaded.
- `src/lib/api.js` — API client for the backend (`apiFetch` always sends `credentials: "include"`; `getSession()` returns `{ sub, email, name }` or null; `isAuthenticated()`, `refreshSession()`, `logout()`).
- `src/lib/articles.js` — client for ChromaBack's JWT-protected `/articles` routes: `AdminArticle` / `ArticleInput` typedefs, `listArticles`, `getArticle` (null on 404), `createArticle`, `updateArticle`, `deleteArticle`, `uploadArticleCover(id, blob)` (`PUT /articles/:id/cover` with the image as the **raw body** + its Content-Type, not multipart), `deleteArticleCover`, `articleCoverUrl(coverPath)` (`${API_BASE_URL}${coverPath}`), `slugify`, `formatDate`. Failures throw `ApiError` (`.status`, message = backend `{ error }`); 401/403 trigger one `refreshSession()` + retry so a long editing session doesn't lose a save. `authedFetch` and `readJson` are exported and reused by `stats.js`.
- `src/lib/stats.js` — stats client: `listStatsCache`, `recomputeStats(period?)`, `getStatsPeriods`, `getStatsBundle(period)` (public routes via `apiFetch`, `cache: "no-store"`), typedefs (`CacheEntry`, `RecomputeResult`, `StatsPeriods`, `StatsBundle` subset), and FR formatters: `periodLabel(key)` ("Juillet 2026", "Semaine du 13 juil. 2026"), `sortCacheEntries` (all, today, last3d, months then weeks newest first, then baselines / periods), `relativeTime`, `absoluteTime`, `formatMs`, `formatSize` (Ko), `formatNumber`, `dayLabel`. Re-exports `ApiError`.
- `src/lib/dashboard.js` — `/dashboard` client (`getOverview`, `getLive`, `getWaitTimes({ scope, land, date })`, `getLands`, all via `authedFetch`, `no-store`), typedefs (`DashboardOverview`, `LiveRide`, `WaitTimes`, `WaitScope`, `Land`), `WAIT_SCOPES` and the live-wait helpers `waitLevel` / `waitText` / `waitSortValue` / `waitTrend`.
- `src/lib/db.js` — `/db` client (`getDbOverview`, `runDbAction(action)`), typedefs (`DbOverview`, `DbAction`, `WarmupStatus`), labels (`MISSING_LABELS`, `CACHE_KIND_LABELS`, `warmReasonLabel`) and formatters `formatBytes` (o / Ko / Mo / Go, 1024-based), `formatSince` ("3 j 4 h"), `formatPct`. Relative / absolute times and numbers come from `stats.js`.
- `src/lib/images.js` — `downscale(file)` (≤1920px WebP re-encode, GIF untouched), shared by `PhotoGallery` and the article cover upload.
- `src/lib/components/articles/ArticleEditor.svelte` — title, slug (follows the title via `slugify` until edited by hand; "Regénérer" button; auto-follow is off for published articles so their URL doesn't move), excerpt with a `n / 300` soft counter, plain-text content (paragraphs = blank line, hint + paragraph/word count), Brouillon/Publié toggle, sticky Save bar (Ctrl+S), "Annuler les modifications", delete. Cover upload/remove is immediate (not part of Save) and only enabled once the article exists. Unsaved-changes guard via `beforeNavigate` (`confirm()` for in-app navigation, `cancel()` on `leave` for the browser's native prompt). 409 is shown under the slug field, other API errors next to Save.
- `src/lib/session.svelte.js` — shared rune store (`session.user`) filled by the protected layout guard and read by `NavSidebar` (shows the signed-in email/name + logout button).
- `src/routes/+layout.svelte` imports the global stylesheet (`$lib/assets/css/global.css`) and sets the favicon; all pages render through it via `{@render children()}`.
- `src/lib` is the `$lib` alias target.
  - `src/lib/components` holds page-building blocks (e.g. `Sidebar.svelte`, `HeroImage.svelte`). Each is a direct child of the `.grid` container and carries its own `data-col="..."` attribute on its root element — a Svelte component doesn't add a wrapper element, so the root element becomes the actual grid item.
  - `src/lib/components/dashboard/` holds the `/dashboard` ("Live") building blocks: `KpiRow.svelte`, `LiveTable.svelte` (owns its sort / search / filter state), `SystemPanel.svelte`, `WaitTimeChart.svelte` (a from-data inline-SVG bar chart with the mint → gold → red gradient, not a Figma asset; emits `onChange({ scope, land, date })`). Each takes its data as props; `dashboard/+page.svelte` does all the fetching and refreshing.
  - `NavSidebar.svelte` collapses to a 52 px icon rail below 768 px (labels kept for screen readers + `title`), so protected pages fit a 360 px screen.
  - `src/lib/assets/css` holds the shared CSS:
    - `reset.css` — a standard Meyer-style reset applied globally.
    - `responsive.css` — a hand-rolled Bootstrap-like 12-column grid system used instead of a CSS framework. Apply it via `class="grid"` on the container and `data-col="xs-<n> sm-<n> md-<n> lg-<n> xl-<n>"` attributes on children (breakpoints: sm ≥576px, md ≥768px, lg ≥992px, xl ≥1200px), e.g. `data-col="xs-12 md-8"`. Only the breakpoints you specify apply; smaller breakpoints don't fall back automatically.
    - `global.css` `@import`s the two files above and defines the shared colour palette as `--color-*` custom properties on `:root` (from the Figma "chroma v2" design). Add new global styles here rather than creating additional top-level stylesheets. Older components still use raw hex; new code should use the tokens.
- Fonts: the "Agdasima" Google Font is loaded via `<link>` tags hardcoded in `src/app.html` (not through `@font-face`/local hosting).
- Component styles use plain scoped `<style>` blocks (no `sass` package is installed, so avoid `lang="scss"` unless it's added as a devDependency first — it will fail the build otherwise).
- CSS class names use kebab-case.
- Images/SVGs live in `src/lib/assets` and are imported directly into components (e.g. `import landing from "$lib/assets/eurosatlanding.svg"`), not referenced by static URL.

## Auth

- Auth uses the **authorization-code flow**, owned by the separate backend (`chromaback`, dev port 3000). The frontend does not touch Google directly, holds no client secret, and does no token verification. Full setup + the backend contract live in `docs/google-oauth-setup.md`.
- `src/lib/components/GoogleSignInButton.svelte` is just a styled `<a>` (white button per the Figma `home` frame) pointing at `${PUBLIC_API_BASE_URL}/google/login`. The backend runs the Google redirect, exchanges the `code`, verifies the `id_token`, sets an `HttpOnly` session cookie, and redirects back.
- Requires `PUBLIC_API_BASE_URL` in `.env` (see `.env.example`), read via `$env/static/public` — the key must exist at build/check time or `svelte-check`/`vite build` fail with a missing-export error. Being a build-time value, it is **not** settable from the CapRover app's variables: see "Deployment".
- Wired into `Sidebar.svelte` (which renders `GoogleSignInButton` with no props). The backend implements `/google/login`, `/google/callback`, `/status/ping` (returns identity), `/account/token` (refresh), `/logout`. What's left is the manual Google Cloud Console step (register the redirect URI) before a real end-to-end login works.

## Deployment

Docker image on CapRover, same pipeline as ChromaBack and the CAGE project. [Dockerfile](Dockerfile)
builds with `node:22-alpine` (`npm ci`, `npm run build`, `npm prune --omit=dev`) and the runtime
stage runs `node build/index.js` on port 3000 — set CapRover's **Container HTTP Port to 3000**, it
defaults to 80. `adapter-node` also wants `ORIGIN` (the app's exact public URL, no trailing slash)
in the CapRover app's variables. [captain-definition](captain-definition) points CapRover at the
Dockerfile.

**`PUBLIC_API_BASE_URL` is a `--build-arg`, not a runtime variable.** SvelteKit inlines
`$env/static/public` into the bundle at build time, so the API URL is frozen into the image: an
image is tied to one environment. Consequences, all handled by
[.github/workflows/deploy.yml](.github/workflows/deploy.yml):

- the workflow reads the URL from the `API_BASE_URL_PREPROD` / `API_BASE_URL_PROD` repository
  *Variables* and passes it as a build-arg;
- image tags carry a `-preprod` / `-prod` suffix, so a preprod image cannot be promoted to
  production by mistake — a prod deploy means a fresh build;
- the Dockerfile fails early, with the reason, when the build-arg is missing;
- the `svelte-check` job sets a throwaway value, since the key only has to *exist* at check time.

A push or PR runs `svelte-check` only. Publishing a release builds, pushes to Docker Hub
(`softwayback/chromafront`) and deploys with the `caprover@2` CLI: preprod for a pre-release,
production otherwise. `workflow_dispatch` redeploys a chosen target. Needs the `DOCKER_USERNAME`,
`API_BASE_URL_PREPROD` and `API_BASE_URL_PROD` variables, the `DOCKER_PASSWORD` / `CAPROVER_HOST` /
`CAPROVER_APP_TOKEN_PREPROD` / `CAPROVER_APP_TOKEN_PROD` secrets, and `preprod` / `production`
environments. App names are in the workflow's `env:` block (`chroma-front`, `preprod-chroma-front`).
Production URL: `https://chroma.galaxian.dev` (= `ORIGIN` here, and the backend's `APP_BASE_URL`;
must also be in the backend's `CORS_ORIGINS`). The CapRover app token for each app is a repo secret
(`CAPROVER_APP_TOKEN_PROD` / `_PREPROD`): a wrong one fails the deploy step with "Invalid credentials".
