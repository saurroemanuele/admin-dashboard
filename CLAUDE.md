# NoonFrame Admin (admin.saurroemanuele.com)

- Before editing, always `git pull` / start from the latest `origin/main`: more than one session works on this repo, and editing a stale copy of `app.js` silently removes other sections.
- Never rewrite `app.js` wholesale; make targeted edits and keep every existing view (`VIEW_PERM`, `load()`, `render()`, `SUB`, nav buttons in `index.html`).
- Owner-only "Personal brand" section (view `brand`, perm `brand_owner`, RPC `brand_funnel` / `brand_lead_delete`): leads and funnel of saurroemanuele.com. Must stay.
- Bump the `?v=` cache numbers in `index.html` when changing `app.js` / `app.css`.
