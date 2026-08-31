## 2026-08-31 · docs(live-studio): 44 comments catch up with the price the owner set on 2026-08-27

**Nothing customer-facing was wrong.** `LIVE_STUDIO` renders from
`platform_retail_catalog_v2` (`retail_price_php = 3000.00`, `is_active = true`), exactly as the
catalogue docblock promised — "price is admin-managed via the catalog, never hardcoded here".

**But 44 comments across 24 files still said ₱2,999**, four days after `DECISION_LOG.md`
2026-08-27 ("THE OWNER'S PRICE SHEET") recorded `LIVE_STUDIO` ₱2,999 → **₱3,000**. This repo has
a documented disease — a false claim written into comments outlives the thing that made it false,
because nobody edits a comment to check a price. A session reading any one of these would have
repeated ₱2,999 to the owner. One did, today.

Only LIVE_STUDIO references were touched. `PAPIC_SEATS`, `PAPIC_GUEST`, `SEATING_3D` and the
supplies-marketplace rows keep their own ₱2,999 — those are different SKUs at that price.

Also corrects `CLAUDE.md`'s locked-decisions mirror, which still claimed **"PHP-direct charm
pricing (-1 endings)"**. The same 2026-08-27 sheet rounded three SKUs OFF their -1 endings in one
day (owner: *"make the whole number 500, 2500"*), so that "lock" has been false since. Replaced
with the rule that actually holds: never derive a price from this file or a comment — read the
catalogue table.

SPEC IMPACT: None. The price decision was already made and logged (`DECISION_LOG.md` 2026-08-27);
this only stops the code from contradicting it.
