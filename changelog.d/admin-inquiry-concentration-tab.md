## 2026-07-12 · feat(anti-fraud): admin "Inquiries" tab — surface the concentration WATCH flags

Completes fake-inquiry protection Phase E slice 2: the `detect_inquiry_concentration` sweep raises `integrity_flags(kind='inquiry_concentration')` WATCH rows, but `/admin/integrity-watch` filtered by kind per tab, so they were invisible. Adds a third **Inquiries** tab.

- **`apps/web/app/admin/integrity-watch/page.tsx`** — `inquiry_concentration` added to the `FlagRow` kind + a `Tab='inquiries'`; tab nav (open-count badge), kind→query mapping, reason label (`Linked accounts targeting one vendor`), non-PII evidence chips (`N linked accounts → this vendor`, `within Nd`, `cluster <label>`), empty-state + header copy, and the source footnote. No rescan button (these are cron-free-sweep-raised, not backfilled).
- **`apps/web/app/admin/integrity-watch/actions.ts`** — allow `confirm_fraud` on `inquiry_concentration` (it's a VERDICT only — records status + audit, never mutates the subject; only `hide_listing` touches a vendor). The tab's action row offers **Confirm attack** (confirm_fraud) + **Dismiss** — and deliberately NO "Hide listing", because the flagged vendor is the **victim** and must never be penalized.

`tsc` / `lint` green. Verdict-only + victim-safe by construction; mirrors the proven Reviews/Listings tabs.

SPEC IMPACT: None (admin UI over an existing table + one guard relaxation; no schema/pricing change).
