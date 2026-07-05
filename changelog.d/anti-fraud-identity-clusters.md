# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(anti-fraud): Phase 2 — identity-cluster dedup of vendor trust stats

Phase 2 of the Anti-Fraud & Trust Integrity workstream (spec `03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md` § 3 rules 3–4). Closes the sockpuppet-ring hole: a vendor could still stack many fake couple accounts (different devices, shared address/payment) and have each one review or "book" them. Phase 1 vetted receipts + arm's-length exact-user exclusions; Phase 2 dedups by identity CLUSTER and extends the arm's-length exclusion to cluster overlap.

New migration `supabase/migrations/20270516600000_identity_clusters_phase2.sql`:

- **`user_identity_signals` VIEW** — normalized `(user_id, signal_type, signal_value)` strong-identity signals: `device` (`user_devices.device_hash`), `address` (`users.address_normalized`), `payment` (`payments.reference_number`, linked to the paying user via `payments.user_id`). **IP is out of scope** — no core identity table captures an IP (only `scan_events.ip_anon` / waitlist / e-sig peripherals), so IP clustering is deferred to Phase 2.1 rather than building IP-capture infra now.
- **`identity_clusters` MATERIALIZED VIEW** — assigns every user a `cluster_id` = `MIN(user_id)` of its connected component in the "shares a strong signal" undirected graph. Singleton (no shared signal) = own `user_id`. Connected component computed by a **bounded (≤64 hops), cycle-guarded** recursive CTE (transitive closure). Unique index on `user_id` for `REFRESH CONCURRENTLY`; `refresh_identity_clusters()` service-role fn. ⚠ caveat: promote to a nightly union-find job at scale.
- **Privacy:** both objects are **service-role ONLY** (`REVOKE ALL ... FROM anon, authenticated`; `GRANT ... TO service_role`). RLS/grants at CREATE time. Header + `COMMENT` note: "RA 10173 legitimate-interest fraud prevention; counsel (Claire) review pending; service-role only." Couples/vendors can never read cluster membership.
- **`vendor_trusted_review_stats`** rebuilt: `trusted_review_count` = COUNT(DISTINCT reviewing-couple `cluster_id`) (10 reviews from one cluster = 1). `trusted_avg_rating` = **mean of per-cluster means** (anti-inflation: a ring's many 5★ reviews collapse to one 5.0 data-point, so row count can't pull the headline average). All existing exclusions preserved verbatim; column names/types unchanged.
- **`vendor_public_completed_events_stats`** rebuilt: `public_completed_count` = COUNT(DISTINCT booking-couple `cluster_id`) (event couple cluster = MIN cluster over its couple roster). **Column name + every consumer preserved** (`lib/vendor-profile.ts`, `lib/vendor-badges.ts`). `vendor_full_completed_events_stats` untouched.
- **Cluster-overlap arm's-length exclusion** added to BOTH stat views: a review/booking is excluded when the reviewing/booking couple shares a cluster with the vendor OWNER or ANY team member — catches the "own second account, different device, same address/payment" case.
- Both existing refresh trigger fns (`refresh_vendor_review_stats`, `refresh_vendor_completed_events_stats`) now refresh `identity_clusters` first so writes pick up fresh clusters. Fail-soft preserved.

No badge threshold changes — only what feeds them. No app-code change (views keep their column contracts). Migration is a FILE only; CI applies on merge.

SPEC IMPACT: None — implements the already-locked § 3 rules 3–4 / § 6 Phase 2 plan; no new product surface or pricing. (Privacy note: counsel review of the fraud-prevention personal-data processing is pending — flagged in the PR body.)
