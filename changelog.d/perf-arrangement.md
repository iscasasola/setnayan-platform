## 2026-07-02 · refactor(vendor): re-arrange My Performance into filter-scoped zones

Reorders the vendor "My Performance" cockpit so the Daily/Monthly/Annual +
service filter's scope is unambiguous and the acquisition→conversion→revenue
story reads top-to-bottom. Chosen from a 3-way design panel (narrative /
filter-boundary / jobs-to-be-done) synthesized into one layout; owner-approved.

New order (was: Health → Inquiry → Conversion → Reputation → Capacity → Demand →
[filter] Momentum → ROI → Funnel → by-source):

1. **Snapshot** (all tiers, point-in-time) — Health composite + Growth tips.
2. **Performance over time** — the ONE windowed zone. The filter row is its
   header; Momentum → **Funnel** → ROI → by-source (+ the coming money graphs)
   all follow the window/service instantly. A short scope caption reinforces it.
3. **Conversion & responsiveness · last 12 months** (not filtered) — Inquiry
   handling + Conversion/deals, kept at 12 months in their own labeled band
   (the inquiry arrival heatmap needs a long window to be meaningful).
4. **Looking ahead & the market · not affected by the period filter** —
   Capacity (forward-looking) + Demand radar (market intel), grouped together.
5. **Reputation · all-time** — the closing standing signal.

Key moves: filter relocated from mid-page to the header of one bounded windowed
zone (scope now answered by containment); **Funnel promoted from dead-last to
right after Momentum** (reunites the split acquisition→conversion→revenue story);
Capacity + Demand grouped and clearly marked outside the filter; Reputation moved
to the end so the whole back-half is a clean non-windowed run. Added a small
`SectionEyebrow` label per zone. Tier degradation verified (Solo still gets a
strong top; sections collapse with no gaps).

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (layout/IA reorder of existing cards; no data or pricing
change). Logged in `DECISION_LOG.md` (2026-07-02).
