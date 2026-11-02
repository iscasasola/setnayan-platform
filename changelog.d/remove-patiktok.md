## 2026-06-29 · chore(retire): remove Patiktok entirely

Owner directive ("remove patiktok ... just remove them entirely"). Patiktok
(iteration 0017 — the TikTok-format booth / vertical-reel product) is CUT from
V1 across code, schema, and data.

**Schema (migration `20270319615897_retire_patiktok_drop_tables_and_skus.sql`):**

- Drops the **5 Patiktok-only tables**, FK-safe (children first):
  `patiktok_render_job_clips` → `patiktok_oauth_state` → `patiktok_oauth_grants`
  → `patiktok_source_clips` → `patiktok_render_jobs`. FK audit (prod, 2026-06-29):
  all 5 were EMPTY (0 rows); every inbound FK was Patiktok-internal.
- **Keeps the owned-AI music catalogue** — `patiktok_music_tracks` (30 seed rows)
  is **RENAMEd to `reel_music_tracks`**, NOT dropped, because the KEPT Guest
  Stories feature reads it (`lib/guest-stories.ts pickMusic`) to back free reels.
  The owner wants the Patiktok *product* gone, not the music catalogue. RENAME
  preserves the 30 rows + `beat_grid` column + RLS + indexes + grants (no
  re-seed). Safe because `patiktok_render_jobs` — the only table holding an
  inbound FK on the music table — is dropped in the step BEFORE the rename, so no
  FK remains. Mirrors the `lib/patiktok-render.ts → lib/reel-render.ts` rename.
- `DELETE FROM service_catalog WHERE sku_code LIKE 'patiktok%'` — clears all 6
  already-inactive Patiktok SKU rows. No `orders` / `vendor_tool_bundles` /
  `vendor_ad_subscriptions` rows reference them (verified 0 each), so the delete
  orphans nothing. No Patiktok-only functions or enum values existed to drop.

**Code (apps/web):** removed the whole `studio/patiktok` route tree, the public
`/patiktok` landing page, `/admin/patiktok`, `api/patiktok/*`,
`api/internal/patiktok/*`, `api/tiktok/auth/*` (the per-couple Patiktok TikTok
OAuth — path A), and `lib/patiktok*.ts` + the offline patiktok handler. Renamed
the shared `lib/patiktok-render.ts` → `lib/reel-render.ts` (+ `renderPatiktokReel`
→ `renderReel`) because the kept Guest Stories feature renders through that
engine. Surgically removed the SKU/catalog/route/wizard/taxonomy/offline/admin/
marketing/onboarding/privacy references so the prod build + typecheck stay green.

**Deliberately left:**

- `lib/social/tiktok.ts` + the `tiktok_social` integration (path B — the
  Setnayan-account social auto-publish for recap cards). Distinct from Patiktok.
- The Camera Bridge `BridgeSurface = 'papic' | 'patiktok' | 'panood'` union and
  its FSM "record-on-stream" branch (kept feature; no product code constructs the
  `'patiktok'` surface; internal record-mode vocabulary only).
- The `setnayan_patiktok` taxonomy row (already `marketplace_hidden=true` in prod;
  the live `vendor_market_stats` view references the slug as a string literal).

**Guest Stories music — preserved (no regression):** Guest Stories sources its
background music from the owned-AI catalogue that lived in `patiktok_music_tracks`.
Rather than drop it, the migration RENAMEs it to `reel_music_tracks` and this PR
repoints every reader — `lib/guest-stories.ts pickMusic()` (the two queries) and
the offline `scripts/analyze-beat-grids.mjs` beat-grid writer — to the new table.
The 30 seed rows + `beat_grid` carry through the rename untouched, so Stories
music **resolves exactly as before** (it is NOT silenced). `pickMusic()` keeps its
graceful-degrade (returns null on any error) as defense-in-depth.

SPEC IMPACT: 0017 retired; RETIRED_ITEMS.md + DECISION_LOG 2026-06-29 updated in corpus.
