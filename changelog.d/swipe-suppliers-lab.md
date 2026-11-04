## 2026-11-04 · test(suppliers): a lab draws the supplier rows that delete by their swipe

`/dev/swipe-rows-lab/suppliers` (dev only, 404 in production) draws, on fixtures, the supplier rows that #7222
moved onto the swipe: `?part=team` (the real "Your team" from the real `buildPlanBudgetModel`), `?part=package`
(the real `PackageItemSwipe`) and `?part=notes` (the real `WorkingNoteSwipe`). Fixture rows live in the lab's own
`fixtures.ts`, registered with the agreed-total guard. Follow-up to #7222, which merged before the lab existed.

SPEC IMPACT: None
