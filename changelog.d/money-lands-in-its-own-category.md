## 2026-09-21 · fix(budget): a supplier's "also covers" is never where its money lands

`bucketForVendor` (`lib/budget-truth.ts`) took `covers_plan_groups[0]` as the
money bucket. Two writers mean different things by that column:

- `budget/cost-actions.ts` writes `[planGroupId]` — the row's HOME — and stamps
  `category` from that group (`vendorCategoryForCostCategory`);
- the Add-manually sheet and the workspace editor write the groups a supplier
  ALSO covers, never its own.

So a reception venue that also covers catering filed its whole price under
Catering (totals right, split wrong — Budget, the checklist health card).

**One rule both satisfy** — `isHomeGroupFor(group, category)`: a covered group
is the money's home only if the row's category could belong to it (the group
lists it, or the group lists none and the row is `misc`). The cost writer's
group always qualifies; an also-covered group never does. Otherwise the
category maps the bucket, as before. `checklist-budget-attribution` now takes
its primary from the same rule (flag ON; flag OFF untouched).

**Measured in prod (read-only, 2026-09-21):** 51 `event_vendors` rows; exactly
ONE carries covers — a manually-added `venue` with covers
`[catering, cake, accommodation]`, contracted, no price / line items /
payments. Nothing was misfiled yet; no existing row needs rewriting.

**Residual, stated in the docblock and pinned exactly by the test:** 6
(category, also-covers) pairs are indistinguishable from the two columns alone
— `transportation`→`logistics`, and `misc`→ each of the five category-less
groups. There, an also-covered group still takes the money.

Guarded by `apps/web/lib/also-covered-is-never-the-money-home.test.ts`: every
plan group through the cost writer, every (category × other group) pair through
the supplier writer, the prod row, and the picker's own-group re-save. Two
existing fixtures that asserted the old `[0]` rule were updated to real row
shapes.

SPEC IMPACT: `DECISION_LOG.md` — one 2026-09-21 row (money-bucket rule).
