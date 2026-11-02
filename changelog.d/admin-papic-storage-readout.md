# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(admin): Papic storage telemetry readout

Gives the byte-telemetry a readout (it was write-only). New `/admin/papic-storage` (+ nav entry under Pricing) reads the `orig/display/thumb_bytes` columns and shows the two numbers the pricing councils asked to lock from real data:

- **Portfolio web-copy ratio** — the real "~8%" (now born-AVIF), weighted over every measured still (not an average of per-event ratios).
- **Events with data** (progress toward the ≥50-event target), **total web-copy GB hosted forever**, and **events over the 40 GB ceiling** (should stay 0).
- Per-event table (captures · stills · orig GB · web-copy GB · ratio), over-ceiling rows highlighted.

Read-only server component, `requireAdmin`-guarded, reuses the pure `aggregateEventStorage`/`webCopyRatio` from `papic-storage-telemetry.ts` (one source of truth with the governor). Fetch capped at 200k rows/table with a visible "add a SQL-aggregation RPC" note before that scale. This is what makes the "lock the numbers from the first ~50 Unli events" plan actionable.

SPEC IMPACT: None.
