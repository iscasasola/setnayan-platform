## 2026-11-13 · feat(for-suppliers): the Pro and Ultra plan previews draw the branches ("Also in <city>")

Owner, 13 Nov 2026 (DECISION_LOG "BRANCHES SHOW ON THE SHOP PAGE, AS NEEDED · PLAN PRICES CONFIRMED"), verbatim:
*"Show the branches as needed."* — the shop page shows "Also in <city> · <city>" whenever the shop has branches,
and the plan-preview miniatures for Pro/Ultra draw the same line. That settles the question ruling 5735 left open,
so the plan cards no longer leave branches out.

- `app/v/[slug]/_components/sample-shop-page.tsx`: the sample's branch cities move here (`SAMPLE_BRANCH_CITIES`,
  from the lab) and `samplePlanBranchCities(plan)` takes the first `tierCaps(tier).branchesIncluded` of them — Pro 3,
  Ultra 6, every other plan 0. No count is typed.
- `app/for-suppliers/_components/supplier-front-page.tsx`: each plan card's miniature and full-screen page pass
  `branchCities={samplePlanBranchCities(plan)}`, drawn by the shipped `ShopBranchesLine` that `/v/[slug]` renders.
- `app/dev/shop-plan-lab/page.tsx`: reads the same list (no second copy); its `?branches=` stays.
- Test: `app/dev/shop-plan-lab/the-lab-never-ships.test.ts` — the "draw NO branches" guard is replaced: the plan cards
  pass the plan's branches; executed per plan, Pro and Ultra produce `Also in …` and the others produce nothing; the
  sample has enough cities for the top plan. Sabotaged twice (cards pass none · helper returns none) → red.

SPEC IMPACT: None — implements the 2026-11-13 DECISION_LOG row as written.
