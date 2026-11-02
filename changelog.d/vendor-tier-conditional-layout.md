## 2026-07-03 · feat(vendor-page): tier-conditional website layout + "Powered by Setnayan" mark

The public `/v/[slug]` page now **adjusts its design by subscription tier** (owner:
"adjust their website design depending on their tier" · "let's make it live") —
the first slice of the Free/Solo/Pro/Enterprise website ladder.

- **Premium layout gated to Pro+** — the 2-column layout + sticky Inquire rail
  (shipped to everyone in #2650) is now a **Pro/Enterprise** benefit (`premiumLayout
  = viewerTierCaps.customWebsiteName`). **Free/Solo render the clean single column**
  (no grid, no rail; the inline Inquire Now / Share actions stay visible on all
  viewports so they never lose the CTA). Every tier still collapses to one column
  on mobile.
- **Setnayan visibility (item K)** — a "Powered by **SETNAYAN** · Set na 'yan" mark
  now sits in the footer of **every** vendor site, every tier (incl. future
  Enterprise custom domains).

Content a vendor already set (About / accent / featured services) still renders
for whoever set it — the gate here is on the LAYOUT, not the content.

Next slices: Enterprise cinematic layer (hero overlay · awards strip · editorial
spotlight · video portfolio) + editor control re-tiering (Solo gets About / accent
/ featured; Pro keeps hero / slug / pinned / editorials). tsc + lint green.

SPEC IMPACT: `/v/[slug]` layout is now tier-conditional (premium 2-col = Pro+;
Free/Solo = single column) + a permanent Setnayan brand mark on all vendor sites.
No schema/pricing change (reuses the existing `customWebsiteName` cap). Logged in
DECISION_LOG.md.
