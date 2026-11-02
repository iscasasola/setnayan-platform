## 2026-06-28 · fix(marketing-nav): point Explore + footer Real Stories at canonical routes

Website master-plan Phase 0 (IA hygiene) — remove redirect hops in the shared marketing chrome so links go straight to canonical routes:

- Top-nav **Explore** href `/vendors` → `/explore` (middleware already 308s `/vendors` → `/explore` per the 2026-06-14 rename; the nav was sending users through that hop).
- Footer **Real Stories** href `/weddings` → `/realstories` (matches the top nav, which already uses `/realstories`; drops the redirect hop).

SPEC IMPACT: None. Pure link-target hygiene; both destination routes are already live. Part of `03_Strategy/Website_Master_Plan_2026-06-28.md` Phase 0.
