# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-31 · fix(checkout): fetch the QR payload columns as a soft probe, not inside the main SELECT

PR #3964 added `bdo_qr_payload` / `gcash_qr_payload` to `fetchPlatformSettings`'s main `SELECT`. That is precisely the trap this file already documents two functions further down: on a **pre-migration database** the select fails `42703`, `error` is truthy, and `fetchPlatformSettings` returns `FALLBACK` — blanking the **business name, VAT rate, brand icons and the BDO/GCash account details** across receipts and checkout. A total payment-details outage, caused by an optional nicety.

This was not hypothetical. On the #3964 deploy the **`supabase-migrations` job was cancelled while `deploy-prod` succeeded**, so the code went live against a database without the columns. Prod happened to migrate moments later (verified: both columns present, correctly backfilled, `anon` denied, `authenticated` read-only), but nothing guarantees that ordering — a rollback, a preview environment pointed at an older database, or another cancelled migration job reproduces it exactly.

**Change:** the two payload columns move out of `SELECT` into their own tolerant probe that degrades to `null` on any error. `null` already means "serve the static QR image" everywhere downstream, so the worst case is losing the amount-in-QR nicety while every core payment detail keeps rendering. Same function signature; no caller changes.

SPEC IMPACT: None — robustness fix, no product surface, pricing or schema change.
