## 2026-06-25 · fix(studio): in-app services consistency — Tier 1 (catalog data)

First tier of the In-App Services Consistency Plan (2026-06-25). Pure catalog-
data fixes that make the Studio hub's status badge tell the truth (pillFor()
already does the right thing once each row declares what it is):

- **panood** + **patiktok** — added `serviceKey` (`PANOOD_SYSTEM` / `PATIKTOK_COMPILER`,
  canonical V2 codes). They were the paid services with no serviceKey, so their
  grid pill could never flip to Active/Pending when owned — paid-features-auto-show
  was silently broken for them at the hub.
- **photo-delivery** + **save-the-date** — added `tier:'free'` so free tools show
  "Free" instead of a money-style "Get" (Save-the-Date's content film is free; the
  cinematic openings remain a paid in-surface upgrade).
- **supplies-marketplace (Paprint)** — `status: 'coming_soon'` (owner default
  2026-06-25). It was a dead-end (cart with a permanently-disabled checkout over
  mock products); now it renders as a non-clickable "Soon" card instead of
  presenting as live.
- New guard test (`add-ons-detail.test.ts`): every non-`coming_soon` service must
  declare `serviceKey` OR `tier:'free'` — so a future row can't ship with a
  meaningless "Get" badge. Validated: zero offenders.

Tiers 2–3 (flag-driven routing + collapsing the 3 ownership readers to
`eventSkuActive`) follow as the rest of the low-risk consistency sweep.

SPEC IMPACT: catalog data only; see In_App_Services_Consistency_Plan_2026-06-25.md.
