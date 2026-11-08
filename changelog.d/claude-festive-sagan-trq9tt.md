## 2026-11-06 · feat(shops): a held shop name holds its CORE — "Bulgogi 1" is refused while "Bulgogi Catering" is held

Owner, 2026-11-06: *"there was a shop named Bulgogi Catering. and the shop was deactivated, banned, or deleted. we have
a rule that the name cannot be used for 1 year. then they created Bulgogi 1. that should also not be allowed."* →
*"Yes, build it."*

- **Migration `20271320018288_a_held_shop_name_holds_its_core.sql`** (no table, no column, no policy):
  `shop_name_core(name)` — lowercase, accents folded with `slugify_business_name`'s own pairs, punctuation and spaces
  gone, digits / single letters / standalone roman numerals (to XXXIX) gone, trade words gone (also glued to either
  end of an address). Trade words are DERIVED live from `canonical_service_taxonomy` + `service_categories` labels,
  plus `co · inc · ph · corp` and the joining words `and · the`. A core under 3 letters, or only trade words, is NULL
  and holds nothing.
- `shop_name_core_hold(name, asking_shop)` — THE one question. Held by a CLOSED shop (a live `vendor_closed` row; the
  core is read from the held ADDRESS, because erasure blanks the name), a BANNED shop, or a SUSPENDED shop. A live,
  normal shop holds nothing. The asking shop's own rows never hold against it, and an APPLIED "It's my business"
  correction releases that core for that shop only. service_role only.
- `claim_ready_the_shop` (the couple's link) leaves a held name BLANK instead of copying it onto the joining shop.
- **Every vendor-facing name write asks it** (`lib/shop-name-hold.ts`): the open-shop wizard's submit (name AND
  address) and its live step-1 check, the My Shop rename, the correction request. Fails closed.
- **Never a dead end:** the refusal (its own wording; never says closed / banned / suspended) carries
  **"It's my business"**, which files the name into the existing `/admin/corrections` queue. In the wizard the shop
  opens without that name and the request goes with it; on My Shop it is sent at once. The admin card shows which
  shop holds the core and why; applying it writes the name (the slug is then minted from it).
- Tests: `tests/db/a-held-shop-name-holds-its-core.db.test.ts` (15) · `lib/shop-name-hold.test.ts` (9).

SPEC IMPACT: None new — implements DECISION_LOG 2026-11-06 "A HELD SHOP NAME HOLDS ITS CORE" as written. Two
build-time calls surfaced for the owner in the PR body (the "and/the" joining words; the corrections queue as the
claim's home), not applied to the corpus.
