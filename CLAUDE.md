# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

ChromaFront is a SvelteKit 5 app scaffolded from the minimal `sv` template with JSDoc-based typing (no `.ts` source files — types are checked via `jsconfig.json` + `svelte-check` against JSDoc comments). It currently consists of a single landing page.

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
  - `(protected)/` — route group (`+layout.js` sets `ssr = false`) whose `+layout.svelte` guards on `isAuthenticated()` and redirects to `/` when unauthed. Holds `/dashboard` and `/entities` (the group parens don't change the URL).
- `src/lib/api.js` — API client for the backend (`apiFetch` always sends `credentials: "include"`; `getSession()` returns `{ sub, email, name }` or null; `isAuthenticated()`, `refreshSession()`, `logout()`).
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
