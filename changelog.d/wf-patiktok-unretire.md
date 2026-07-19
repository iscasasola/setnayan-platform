## 2026-07-01 · feat(patiktok): un-retire Patiktok as a single admin-managed SKU

Reverses the 2026-06-29 product cut (PR #2391 / commit `00116f029`). Patiktok the
product — the TikTok-style mimic-station booth + 9:16 vertical-reel pipeline — is
back, restored surgically (forward migration, not `git revert`).

**Schema** — new forward migration `20270331200000_unretire_patiktok_recreate_tables.sql`
re-creates the 5 product tables FK-safe with RLS at CREATE time
(`patiktok_render_jobs`, `patiktok_source_clips`, `patiktok_render_job_clips`,
`patiktok_oauth_grants`, `patiktok_oauth_state`). All 5 were empty at the cut, so
nothing is lost. `patiktok_render_jobs.music_track_slug` references the KEPT
`reel_music_tracks(track_slug)` (the music catalogue was renamed, not dropped, at
retirement). Idempotently re-asserts `is_active=TRUE` on the surviving
`platform_retail_catalog_v2.PATIKTOK_COMPILER` row — NO price is written (price is
admin-managed; the retirement migration never deleted that row).

**Single-SKU model (owner-locked 2026-07-01).** The dead 2026-05-16 dual-tier
per-day pricing (`patiktok_setnayan_daily` ₱999 / `patiktok_personal_daily` ₱1,999
/ `patiktok_video_overage` ₱49) is NOT restored — those codes stay in
`RETIRED_SKU_CODES` for legacy-order resolution. Patiktok is now ONE SKU keyed
`PATIKTOK_COMPILER`; ownership reads orders on that key, the buy CTA creates an
order under it, the display price + the authoritative charge both resolve from
`platform_retail_catalog_v2` (`formatV2Sku` / the checkout re-resolve). No peso is
hardcoded anywhere. NO bundle: Patiktok is deliberately kept OUT of MEDIA_PACK /
Complete (entitlements `BUNDLE_CHILD_SKUS`, `onboarding-pricing.ts BUNDLE_MEMBERS`,
and the `bundles_granting_sku()` SQL stay byte-identical — `lint:entitlement-gates`
green, Essentials 7 · Complete 16).

**Code** — restored the `studio/patiktok` tree (gallery, template detail, booth,
actions, components, loadings), `/patiktok` + `/admin/patiktok`, the
`api/patiktok/*` + `api/tiktok/auth/*` routes, and `lib/patiktok.ts` (prices
stripped → catalog reads), `lib/patiktok-reel-emails.ts`,
`lib/patiktok-tiktok.ts`, the offline handler. Re-threaded the render engine
(`@/lib/patiktok-render` → `@/lib/reel-render`, `renderPatiktokReel` →
`renderReel`) and the music table (`patiktok_music_tracks` → `reel_music_tracks`).
Re-added the data-driven Studio card (`add-ons-catalog.ts`, serviceKey
`PATIKTOK_COMPILER` — auto-surfaces + auto-flips Active on ownership), the V2
catalog allowlist + build-status, route/route-meta/wizard/upcoming-items entries,
offline registration, drive-copy/upload, auto-recap reader, verify-telemetry case,
admin nav, supplies-marketplace cross-sell, and marketing/keynote/llms.txt copy.
Render test re-pointed to `lib/reel-render.test.ts` (19/19 pass).

**TikTok auto-post ships DORMANT.** The path-A per-couple OAuth (routes + tables +
`OAUTH_SPECS.tiktok`) is restored but env-gated on
`TIKTOK_CLIENT_KEY`/`SECRET`/`OAUTH_REDIRECT_URI`. `getTiktokOAuthConfig()` returns
`{ ready:false }` (never throws) when env is unset; the OAuth routes redirect with
`tiktok_error=not_configured`. record → render → download works with ZERO TikTok
connection. The connect affordance only renders when the app is configured —
which won't be until the owner registers the app + clears TikTok's
Content-Posting-API audit.

SPEC IMPACT: Reverses a memory-locked retirement — `DECISION_LOG.md` row appended,
`project_setnayan_patiktok_retired.md` memory updated to "un-retired (single SKU)".
Owner-action gate: R2 CORS must be set for record/render end-to-end; TikTok
auto-post stays deferred behind the external audit.
