# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(papic): 3-month full-res drop — retention sweep (SHIPS DRY-RUN / FLAG-OFF)

The retention core (owner 2026-07-11 · Pricing.md § 2.1). After the free full-res window (default 90d), a weekly sweep deletes OUR R2 copy of full-res photo originals and keeps the forever web copy (born-AVIF display/thumb) — so the gallery, which serves the web copy, is unaffected. **The couple's Google Drive copy is NEVER touched** (core invariant); this only reclaims OUR R2 hot copy.

- **Migration `20270722251601`** — `full_res_dropped_at` marker on `papic_photos` + `papic_guest_captures` (+ sweep indexes). Additive/idempotent, validated against live prod in a rolled-back tx.
- **`lib/papic-fullres-drop-core.ts`** (pure, 9 tests) — `isEligibleForDrop` (age ≥ window · has web copy · not already dropped · not a `sample/` seed key) + `resolveOriginalRef` (raw key → media bucket · `r2://` ref → its known bucket · unknown → null so we never delete blindly).
- **`lib/papic-fullres-drop.ts`** + **`/api/cron/papic-fullres-drop`** (weekly, CRON_SECRET) — the guarded sweep.

⚠ **DESTRUCTIVE — SHIPS DRY-RUN. Deletes NOTHING unless `PAPIC_FULLRES_DROP_ENABLED='true'`.** Hit the route with `?dry=1` to preview eligible counts safely. Guards: **PHOTOS ONLY** (a clip's `r2_object_key` IS the video — no web-copy fallback — so clips are excluded); web copy must exist; `sample/` seed data never touched; **Keep-Full-Res (`HIGH_RES_ARCHIVE`) events skipped**; resolves a known bucket or declines.

### 🚨 Resolve BEFORE setting the flag ON (do not enable blind):
1. **Verify the Papic lightbox/full-view serves the web copy (display), not the original.** Gallery *tiles* use thumb/display (confirmed safe), but if a full-res lightbox/download reads `r2_object_key`, dropping breaks it — repoint it first.
2. **Clips are excluded** (video has no web-copy fallback). If clip full-res should also drop, it needs a **Drive-confirmed** path (only drop the clip video once we've confirmed it's in the couple's Drive) — separate build.
3. **Pre-drop notification email** — the model promises 3 months free; couples should get a "your free full-res window ends in N days — download / connect Drive / upgrade" email (0028) before the first drop.

SPEC IMPACT: Applied — DECISION_LOG 2026-07-11; `Pricing.md § 2.1` retention model already describes the 3-month drop.
