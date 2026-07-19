## 2026-07-03 · docs(vendor-tiers): Custom tier rate card proposed (§11) — formula-driven quotes for franchise/multi-location vendors

- `apps/web/VENDOR_TIERS_AND_BENEFITS.md` — new **§11 Custom tier rate card (PROPOSED, owner sign-off pending)**: base ₱14,999/28d incl. 3 fully-loaded locations · +₱2,499/location · +₱1,999/brand · overflow units (extra seat / +1 event slot ₱499 / +100 photos ₱99) · charm-round-up · floor at base · annual = 10 × 28d (3 free cycles). Model = "per-location Enterprise"; sub-Custom asks are served as Enterprise + overflow units. Stage 1 = manual quote via org-scoped `vendor_billing_catalog` row; Stage 2 = HQ admin quote builder (build after sign-off).
- §2 Custom card now points at §11; "from ~₱15,000" charm-normalized to "from ₱14,999" (pending sign-off item 1).
- §10 annotated with the **extra-seat price conflict**: open PR #2623 implements ₱250/28d vs §10's owner-attributed ₱500/28d — owner must pick one before #2623 merges.
- No code, no gates, no public copy changed — spec/pricing-model doc only.

SPEC IMPACT: corpus `DECISION_LOG.md` — row appended (2026-07-03, Custom tier rate card proposed; numbers pending owner sign-off). No iteration .md affected (vendor tiers SSOT lives in-repo at `apps/web/VENDOR_TIERS_AND_BENEFITS.md`).
