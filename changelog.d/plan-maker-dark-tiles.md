## 2026-11-20 · fix(plan-maker): the Grid's tiles and chairs turn dark with the page

The 375 dark proof for #7968 showed the shared `PlanMaker`'s Grid tiles as white cards with invisible words. The tiles
(`bg-white`) and empty chairs (`fill-white`) now wear the card token (`bg-raised` / `fill-raised`), and a filled chair's
number is `fill-cream`. Guard: `plan-maker.test.ts` fails on any `bg-white` with no `dark:bg-` partner.

SPEC IMPACT: None.
