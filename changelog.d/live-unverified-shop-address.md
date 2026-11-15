## 2026-11-15 · fix(live): an unverified shop's page shows its city, not its street

W1 Walk A: an unverified shop's page printed its exact street with a pinned map and Get directions. DECISION_LOG
2026-11-15 "AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE" says *no exact address*; the approved prototype
(`shop_website_two_looks_2026-11-15/site.html`) prints the city and "the exact address shows once verified". New pure
`shopWhere` (lib/shop-page-plan.ts) decides it: unverified = city only, no map, no directions; verified unchanged. The
unverified Where section now draws the reach line and that one note. Guard:
`lib/an-unverified-shop-hides-its-exact-address.test.ts`.

SPEC IMPACT: None
