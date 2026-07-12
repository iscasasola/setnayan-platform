## 2026-07-12 · feat(anti-fraud): Phase E slice 2 — inquiry concentration detection (shadow mode)

Detects the competitor-sabotage signature — many LINKED accounts (one `identity_cluster`, i.e. provably the same entity via shared device/address/payment) inquiring to ONE vendor. Owner-approved 2026-07-12 to run in **shadow mode: flag admin only, never quarantine** (silently withholding a real couple's inquiry is the heaviest, highest-false-positive-risk action — reserved as an explicit later decision).

- **`supabase/migrations/20270728339269_inquiry_concentration_detection.sql`** — adds an `inquiry_concentration` kind to `integrity_flags` (the enforcement-FREE admin WATCH surface — never `fraud_signals`, so a *targeted* vendor can't be mis-enforced) + `detect_inquiry_concentration(window, min_accounts)` (SECURITY DEFINER, service-role): raises one deduped WATCH flag per (vendor, cluster) where a linked cluster sprayed one vendor via ≥3 distinct accounts in 14 days. Subject = the **victim** vendor; `detail` carries only non-PII (an opaque `cluster_label = left(md5(cluster_id),12)`, `distinct_accounts`, and a "do NOT penalize this vendor" note).
- **`apps/web/app/api/cron/fraud-cluster-sweep/route.ts`** + `vercel.json` — daily `CRON_SECRET`-gated job: `refresh_identity_clusters()` → `detect_inquiry_concentration()`. Gated on `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED` (read via env — slice 1's flag module isn't in this branch) since concentration is only meaningful once device edges feed the clusters; returns `{skipped}` when off.

**High-confidence by construction** (presumption-of-a-real-couple): the signal is strictly CROSS-account (a cluster of ≥N linked accounts), never a single new couple; a rare false link is harmless in shadow mode (an admin dismisses it).

⚠ **Immediate follow-up (NOT in this PR):** the `/admin/integrity-watch` page filters by `kind` per tab, so these flags land durably but aren't yet shown in the UI — a third "Inquiries" tab is the next small PR to make them admin-visible. Quarantine remains an explicit owner decision, unbuilt.

SPEC IMPACT: None in pricing/SKU. Additive detection (new integrity_flags kind + a read-only cron), flag-gated on device capture. Logged in DECISION_LOG 2026-07-12.
