# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(anti-fraud): Phase 3 — fraud detection engine (fraud_signals store + five scored anomaly signals)

Phase 3 of the Anti-Fraud & Trust Integrity workstream (spec `03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md` § 4). Adds a per-vendor `fraud_signals` store + deterministic scoring for the five anomaly types, computed on write (via `after()`) and in a cron-free full pass. **DETECT + SCORE ONLY** — nothing here suspends, bans, hides, or mutates a vendor; enforcement is Phase 4.

New migration `supabase/migrations/20270517644717_fraud_signals_detection_engine.sql`:

- **`fraud_signal_type` + `fraud_signal_status` enums** — the closed set `ring | velocity | graph_isolation | import_spike | rating_shape` and `open | dismissed | actioned`.
- **`fraud_signals` TABLE** — one row per `(vendor_profile_id, signal_type, window_start)` (UNIQUE → re-runs UPSERT, never stack). Columns: `public_id` (`generate_public_id('F')`), `score` SMALLINT 0–100, `evidence` JSONB (non-PII counts/ratios/opaque cluster labels/booleans), `detected_at`, `window_start`/`window_end`, `status`, admin-resolution columns. Distinct from `integrity_flags` (per-review/per-listing grain).
- **`vendor_fraud_scores` MATERIALIZED VIEW** — per-vendor aggregate over OPEN signals: `max_open_score`, `sum_open_score` (clamped 100), `open_signal_count`, `open_signal_types[]`, `latest_detected_at`. The Phase-4 queue sorts vendors by this. `refresh_vendor_fraud_scores()` service-role fn (CONCURRENTLY + plain-refresh fallback, fail-soft).
- **Privacy:** table + matview are **service-role/admin ONLY** — RLS at CREATE (admin SELECT/UPDATE via `is_admin()`; no anon/authenticated INSERT/DELETE), plus belt-and-suspenders `REVOKE ALL ... FROM anon, authenticated` and explicit `service_role` grants. Header + `COMMENT`: "RA 10173 fraud-prevention; service-role/admin only; counsel review pending."

New lib `apps/web/lib/fraud-detection.ts` (pure, I/O-free, NOT `server-only` so `tsx --test` can import it) — one scorer per signal returning `{score, evidence}`, thresholds as exported named constants, plus an aggregate `scoreVendor(...)`:

- **ring** — `distinct_clusters / review_count` low (via Phase-2 `identity_clusters`); MIN-N 4; saturates at ratio ≤ 0.25 (e.g. 8 reviews / 2 clusters). 
- **velocity** — brand-new couple accounts (`users.created_at` within 3 days of their review) reviewing one vendor inside a 72h window, ≥4★; saturates at 4.
- **graph_isolation** — reviewers whose only `event_vendors` link is this vendor and who have no other events; MIN-N 3; saturates when all reviewers are isolated.
- **import_spike** — `event_vendors` host_manual/import/NULL-source delivered rows with NEITHER a `matched` payment NOR an arm's-length couple (§ 3 rule 2); MIN-N 3; saturates at 8.
- **rating_shape** — MIN-N 5; ANY 1–4★ tail → 0; all-5★ with no tail saturates.

New runner `apps/web/lib/fraud-detection-runner.ts` (`server-only`) — `scoreVendorFraud(vendorProfileId)` gathers the vendor's data, scores, UPSERTs each signal (never re-opens an admin-resolved row), refreshes the aggregate; `runAllFraudScoring()` full-pass over published vendors; `maybeRunNightlyFraudScoring()` cron-free `after()` piggyback (once/day/instance throttle, mirrors `spotlight-awards.ts`). All fail-soft (Sentry-captured) so a couple's review write is never blocked.

Wired `scoreVendorFraud(vendorProfileId)` into an `after()` task on the review-create path (`app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts submitCoupleReview`), alongside the existing per-review screener.

Tests `apps/web/lib/fraud-detection.test.ts` — deterministic (fixed `NOW`, no clock/random): clean vendor scores 0 on every signal; ring 8/2, velocity day-old burst, isolated accounts, unbacked import spike, and all-5★ each score high on their own detector without false-tripping others.

No badge threshold changes. Migration is a FILE only; CI applies on merge.

SPEC IMPACT: None — implements the already-locked § 4 detection plan / § 6 Phase 3; no new product surface or pricing. (Privacy note: counsel review of the fraud-prevention personal-data processing is pending — flagged in the PR body.)
