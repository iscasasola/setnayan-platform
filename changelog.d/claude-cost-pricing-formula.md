## 2026-11-21 · feat(admin/pricing): the cost-based price formula suggests a price beside every row

Owner ruling 2026-11-21 (Setnayan-specs DECISION_LOG "NEW BASE PRICING FORMULA"):
price = base cost × 10 (OPEX) × 4.5 ÷ 0.73 (Maya fees + tax), rounded up.

- **Base cost is the existing `saas_overhead_cost_php`** — relabelled in the catalog editor
  "Base cost (what it costs us)". No second cost column.
- **Four settings** on `platform_settings` (migration `the_price_formula_is_an_admin_setting`):
  `pricing_opex_factor` 10 · `pricing_margin_factor` 4.5 · `pricing_fee_tax_cover` 0.73
  (CHECK > 0 and ≤ 1) · `pricing_round_step_php` 1 (1, 5 or 10). Same access as the other
  pricing settings on that row; written only by `pricingFormula` (op=save), audited as
  `pricing_formula_edit`.
- **`lib/pricing-formula.ts`** — `formulaPrice(cost, settings)` rounds UP to the step and
  returns null when there is no cost; `formulaCandidates` is the one rule for which rows the
  bulk apply may touch, used by both the confirm list and the server.
- **The catalog editor** shows "Formula ₱X" and the difference beside each customer price
  ("Add cost" where there is none), a small settings card at the top, "Use formula price" in
  each open card, and "Apply to all rows with a cost" behind a confirm that lists every SKU,
  old → new.
- **It suggests, it never charges.** Every change goes through the existing audited per-row
  save (`validateRetailRowFields` → the § 9.1 second-admin approval). No trigger, no cron, no
  save-on-cost-edit; the migration writes no price. Main price (`retail_price_php`) only —
  per-head, sign-up, yearly and gift-bundle prices are left alone, and the card says so.

The save and the apply are ONE server action, `pricingFormula` (`op=save` | `op=apply`), not two: every exported
`'use server'` function is a Vercel route and `lint-server-action-budget.mjs` had exactly one left (1250 / 1251).

SPEC IMPACT: None — implements the 2026-11-21 DECISION_LOG row as ruled (commit 19430f52 in
Setnayan-specs); no corpus edit needed.
