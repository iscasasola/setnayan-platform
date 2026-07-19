## 2026-06-22 · chore(catalog): SDE build-status → live

The Same-Day Edit deliverable shipped end-to-end (PR #2031: admin-upload pipeline → auto-shows on the day-of page + recap, gated on `eventSkuActive('SDE')`), so its `BUILD_STATUS` honesty-map entry flips `not_built` → `live` and `/pricing` can now sell it. Removed the stale "AI edit pipeline not built" comment — V1 SDE is crew-rendered + admin-uploaded, not an in-app AI render.

SPEC IMPACT: None (catalog honesty-map only; the feature + gate already shipped). Pricing stays admin-catalog-driven.
