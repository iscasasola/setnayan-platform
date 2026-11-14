## 2026-11-14 · fix(features): /features/setnayan-ai is priced by the plans that carry it (RW-149)

The W1 re-walk of #7609 found `/features/setnayan-ai` showing "Price From ₱265", read from `SETNAYAN_AI_D`, an
inactive tier of the AI ladder the 2026-11-04 final price sheet took off sale (`inactiveRowsArePrices: true`).
Setnayan AI is not sold on its own; it comes inside Event Plus, Event Pro and Event Ultra (`AI_INCLUDED_PLAN_SKUS`).

- The page now names the three plans (EN + TL: answer, first step, "Do I have to use it?", "How is it priced?") and is
  priced by their ACTIVE catalogue rows — "From" the cheapest — never by an off-sale row.
- `lib/v2-catalog.ts` `BUILD_STATUS`: `EVENT_PLUS` and `EVENT_ULTRA` → `'live'`. Unlisted, they fell to `not_built`,
  so /pricing's structured data offered both as a PreOrder while they were on sale.
- Guard `app/features/setnayan-ai-is-priced-by-its-plans.test.ts`: the page's codes equal `AI_INCLUDED_PLAN_SKUS`; no
  feature page reads inactive rows as a price; a cheaper inactive AI tier can never become the "From"; both languages
  name all three plans; every AI-carrying plan is `live` on /pricing.

SPEC IMPACT: None — implements the 2026-11-04 price-sheet ruling on a page that had not caught up.
