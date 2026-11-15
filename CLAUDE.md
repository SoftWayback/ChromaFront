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

- SvelteKit with `adapter-auto` (svelte.config.js) — no deployment target has been pinned yet, so adapter choice is environment-dependent.
- Routing is filesystem-based under `src/routes`:
  - `/` (`+page.svelte`) — the landing / sign-in page (Sidebar + HeroImage).
  - `/login` — where the backend redirects after a successful Google login; confirms the session then bounces to `/dashboard` or `/`.
  - `/Error` — login failure page, reads `?type=&message=` (capital `E`, matches the backend redirect).
  - `(protected)/` — route group (`+layout.js` sets `ssr = false`) whose `+layout.svelte` guards on `isAuthenticated()` and redirects to `/` when unauthed. Holds `/dashboard`, `/entities`, `/entities/[id]`, `/articles`, `/articles/[id]`, `/stats` and `/db` (the group parens don't change the URL). Each page renders `NavSidebar` + a `<main class="content">`.
  - `/articles` — articles admin list (cover thumbnail, title + slug, Brouillon/Publié badge, dates, Modifier / Supprimer with inline confirm, Tous/Brouillons/Publiés filter, empty state, "Nouvel article").
  - `/articles/[id]` — the editor (`ArticleEditor.svelte`). `id = "new"` creates; there is deliberately **no** `articles/new/` folder: after the first save the editor `goto`s `/articles/<id>` (replaceState) on the *same* route, so the component stays mounted with the article in hand instead of reloading.
  - `/stats` — admin panel for ChromaBack's statistics engine (see ChromaBack/CLAUDE.md "Statistics engine"): "Tout recalculer" (`POST /stats/recompute` with no period, ~50 s), quick buttons (Aujourd'hui / 3 derniers jours / Depuis le début / Baselines) + month / week selects fed by `/public/stats/periods`, the `"StatsCache"` table (`GET /stats/cache`; label + key, relative "il y a 12 min" with absolute on hover, "Figé" / "expire dans …" / "expiré", size in Ko, per-row "Recalculer" — not for `periods`, which only the full recompute refreshes), and a compact sanity preview of the `all` bundle (`/public/stats?period=all`, fetched `no-store`). Only one recompute runs at a time: every recompute button is disabled while one is in flight, with a spinner + elapsed-seconds banner; the fetch has no client timeout. Returned timings are shown afterwards and the table (plus periods / preview when relevant) is reloaded.
- `src/lib/api.js` — API client for the backend (`apiFetch` always sends `credentials: "include"`; `getSession()` returns `{ sub, email, name }` or null; `isAuthenticated()`, `refreshSession()`, `logout()`).
- `src/lib/articles.js` — client for ChromaBack's JWT-protected `/articles` routes: `AdminArticle` / `ArticleInput` typedefs, `listArticles`, `getArticle` (null on 404), `createArticle`, `updateArticle`, `deleteArticle`, `uploadArticleCover(id, blob)` (`PUT /articles/:id/cover` with the image as the **raw body** + its Content-Type, not multipart), `deleteArticleCover`, `articleCoverUrl(coverPath)` (`${API_BASE_URL}${coverPath}`), `slugify`, `formatDate`. Failures throw `ApiError` (`.status`, message = backend `{ error }`); 401/403 trigger one `refreshSession()` + retry so a long editing session doesn't lose a save. `authedFetch` and `readJson` are exported and reused by `stats.js`.
- `src/lib/stats.js` — stats client: `listStatsCache`, `recomputeStats(period?)`, `getStatsPeriods`, `getStatsBundle(period)` (public routes via `apiFetch`, `cache: "no-store"`), typedefs (`CacheEntry`, `RecomputeResult`, `StatsPeriods`, `StatsBundle` subset), and FR formatters: `periodLabel(key)` ("Juillet 2026", "Semaine du 13 juil. 2026"), `sortCacheEntries` (all, today, last3d, months then weeks newest first, then baselines / periods), `relativeTime`, `absoluteTime`, `formatMs`, `formatSize` (Ko), `formatNumber`, `dayLabel`. Re-exports `ApiError`.
- `src/lib/images.js` — `downscale(file)` (≤1920px WebP re-encode, GIF untouched), shared by `PhotoGallery` and the article cover upload.
- `src/lib/components/articles/ArticleEditor.svelte` — title, slug (follows the title via `slugify` until edited by hand; "Regénérer" button; auto-follow is off for published articles so their URL doesn't move), excerpt with a `n / 300` soft counter, plain-text content (paragraphs = blank line, hint + paragraph/word count), Brouillon/Publié toggle, sticky Save bar (Ctrl+S), "Annuler les modifications", delete. Cover upload/remove is immediate (not part of Save) and only enabled once the article exists. Unsaved-changes guard via `beforeNavigate` (`confirm()` for in-app navigation, `cancel()` on `leave` for the browser's native prompt). 409 is shown under the slug field, other API errors next to Save.
- `src/lib/session.svelte.js` — shared rune store (`session.user`) filled by the protected layout guard and read by `NavSidebar` (shows the signed-in email/name + logout button).
- `src/routes/+layout.svelte` imports the global stylesheet (`$lib/assets/css/global.css`) and sets the favicon; all pages render through it via `{@render children()}`.
- `src/lib` is the `$lib` alias target.
  - `src/lib/components` holds page-building blocks (e.g. `Sidebar.svelte`, `HeroImage.svelte`). Each is a direct child of the `.grid` container and carries its own `data-col="..."` attribute on its root element — a Svelte component doesn't add a wrapper element, so the root element becomes the actual grid item.
  - `src/lib/components/dashboard/` holds the `/dashboard` ("Live") building blocks: `LiveTable.svelte`, `StatsPanel.svelte`, `WaitTimeChart.svelte` (a from-data inline-SVG bar chart, not a Figma asset). Each takes its data as props; `dashboard/+page.svelte` fetches `/dashboard/{live,stats,wait-times}` from the backend on mount and falls back to Figma placeholder values.
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
- Requires `PUBLIC_API_BASE_URL` in `.env` (see `.env.example`), read via `$env/static/public` — the key must exist at build/check time or `svelte-check`/`vite build` fail with a missing-export error.
- Wired into `Sidebar.svelte` (which renders `GoogleSignInButton` with no props). The backend implements `/google/login`, `/google/callback`, `/status/ping` (returns identity), `/account/token` (refresh), `/logout`. What's left is the manual Google Cloud Console step (register the redirect URI) before a real end-to-end login works.
