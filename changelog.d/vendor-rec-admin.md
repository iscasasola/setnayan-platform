## 2026-06-30 · feat(vendor): recommend-to-couples engine — Phase 2 data layer (two-way curation)

Builds on Phase 1. Adds the two tables the owner-decided **two-way** curation
model needs:

- `vendor_recommendation_feedback` — vendors flag `not_a_fit` / `suggest_add`
  against their leaf → an admin review queue (mirrors `taxonomy_category_requests`
  governance). Vendor-owned RLS (own rows select/insert; admin sees all).
- `vendor_recommendation_optins` — per-vendor enabled state for `is_opt_in`
  (cannibalization-risk) SKUs. Absent row = not opted in = hidden. Vendor-owned RLS.

Migration `20270326230210_vendor_recommendation_feedback_and_optins.sql`. Applied
to prod + ledger recorded. **Lands INERT** — the admin curation surface + queue
(rest of Phase 2) and the vendor panel (Phase 3) read these.

SPEC IMPACT: Decision logged in corpus `DECISION_LOG.md` (2026-06-30 — curation
model = two-way).
