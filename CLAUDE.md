# NoonFrame Admin (admin.saurroemanuele.com)

- Before editing, always `git pull` / start from the latest `origin/main`: more than one session works on this repo, and editing a stale copy of `app.js` silently removes other sections.
- Never rewrite `app.js` wholesale; make targeted edits and keep every existing view (`VIEW_PERM`, `load()`, `render()`, `SUB`, nav buttons in `index.html`).
- Owner-only "Personal brand" section (view `brand`, perm `brand_owner`, RPC `brand_funnel` / `brand_lead_delete`): leads and funnel of saurroemanuele.com. Must stay.
- Bump the `?v=` cache numbers in `index.html` when changing `app.js` / `app.css` / `studio.js` / `studio.css`.

## Company layer (studio.js + studio.css)
- The company name lives only in `COMPANY` at the top of `app.js` (for now "NoonFrame"; it will be renamed). Nav wordmark, login screen, page title and favicon read it.
- `studio.js` holds the company sections and registers them in `EXT` (defined in `app.js`): Panoramica (view `home`, the landing view), one page per portfolio app (view `app:<id>`, perm `launch`), Pagine satellite (view `satellite`). Keep the `EXT` hooks in `allowed()`, `go()`, `load()`, `render()` and `enter()`; `gate()` starts on `DOMContentLoaded` so `studio.js` is loaded first.
- Everything in `studio.js` stays inside its IIFE (no new globals: they would clash with `app.js` names).
- Brand: warm ink/paper palette from the pitch deck, NoonFrame blue for actions; Archivo (titles, big numbers) and Inter, self-hosted in `/fonts` (CSP has `font-src 'self'`). App colours come from the 8 chart-safe colours in `APP_COLORS`.
- Database (Supabase `jhoidpugjjvvkjccyrxg`): `admin_api.apps`, `app_metrics`, `sat_pages`, `sat_accounts`, `sat_weeks`; routes `studio`, `apps`, `app`, `app_save` (perm `apps`), `sat`, `sat_save`, `sat_secret` (perm `sat_access`, owner-only to grant) in `admin_call`. Account passwords and private notes are only in Supabase Vault and only `sat_secret` returns them; every `sat_secret` call is written to the audit log.
- Partner apps (e.g. Strikt) send numbers to `public.metrics_push(token, data)` with a key created on their app page (only a SHA-256 hash is stored).
