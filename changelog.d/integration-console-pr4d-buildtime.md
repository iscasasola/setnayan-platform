## 2026-06-22 · feat(integrations): read-only "Build-time & env-only" section completes the console (Integration Console PR4d)

Closes out the Integration Activation Console. The integrations that genuinely **cannot** be made no-redeploy are now shown read-only on `/admin/integrations` (present/absent), so the console honestly represents *every* integration — live toggles for the no-redeploy-able ones (PR1–PR4c), read-only status for the build-time/bootstrap ones.

- **`_components/build-time-status.tsx`** — a read-only list; **never renders a secret value** (secrets show present/absent only; only the non-secret host / subject show a value).
- **`page.tsx`** — a "Build-time & env-only" section listing:
  - `R2_PUBLIC_URL` — build-time via `next/image` `remotePatterns`; **deliberately NOT made DB-first** (a different DB host would make `next/image` block media that runtime URLs point at — a media-blanking footgun, for ~zero benefit since it's already set).
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` — **deliberately NOT DB-first**: the public key is inlined into the client bundle at build time and the private key is cryptographically paired with it, so DB-flipping is incoherent.
  - Bootstrap secrets (`ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) — env-only by nature (the DB read itself depends on them).

No migration, no resolver, no read-site flip — pure read-only display (server-side `process.env` presence booleans). `tsc` 0 · `next lint` clean.

**The Integration Activation Console is now complete:** email + AI-paywall (PR1), OpenAI (PR2), OAuth trio (PR3/PR3b), Meta/IG (PR4a), TikTok token (PR4b), Maya (PR4c), and the read-only build-time/bootstrap view (PR4d).

SPEC IMPACT: DECISION_LOG row (2026-06-22) + memory `project_setnayan_integration_activation_console` (initiative complete). No SKU change.
