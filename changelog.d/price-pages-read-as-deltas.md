## 2026-08-13 · fix(pricing): the price pages stop making people read a haystack — and Setnayan AI's second price finally reaches a public page

design#6, second half. Two surfaces: the vendor tier ladder on `/vendors` and the customer-side Free → Setnayan AI step on `/pricing`.

### 1 · 🚨 SETNAYAN AI HAS HAD TWO PRICES SINCE 2026-08-12 AND EVERY PUBLIC PAGE SHOWED ONE

The owner set a **sign-up price** — one figure if you take Setnayan AI while creating your event, another afterwards. Both sit on the catalog row (`retail_price_php` / `onboarding_price_php`), and the sign-up figure was **already being charged**: `lib/setnayan-ai-event-pricing.ts` resolves it at checkout.

It reached no public surface, for the repo's most familiar reason: **`fetchV2CustomerCatalog` never SELECTED the column.** No error, no log. A field you do not ask for comes back `undefined`, and `undefined` is indistinguishable from "this service has no sign-up price". Prod today: regular **₱2,499**, sign-up **₱1,499** — so `/pricing` was quoting its own visitor the higher of two live prices.

The public data layer had even been *shaped* for this: `PricingData` already carried `aiIntroPhp` / `aiRegularPhp`, collapsed to one value under a comment saying "there is no intro/renewal split". That comment was true of the retired ₱499→₱799 cadence and false of the live catalog.

Now: the column is selected, `resolveAiPrices()` is the one place the two prices are decided (shared by `/pricing` and the nav overlay so they cannot disagree), and the card leads with the sign-up figure and shows the regular one beside it.

### 2 · 🪤 AND THE "LAST-RESORT FALLBACK" WAS FIVE TIMES OFF

`/pricing` carried `: '₱499'` behind the catalog read. It was declared in `public-price-literals.ts` as `sku: null` — the category the runtime drift audit **deliberately skips** — with the reason *"Last-resort fallback when the Setnayan AI catalog row is unreadable."*

The live price was ₱2,499. On the page where somebody decides to pay, for weeks, with green CI.

🔑 **A FALLBACK FOR A CATALOG ROW IS THAT SKU'S PRICE BY DEFINITION.** It can never honestly be a non-price, and `sku: null` is exactly where a stale price hides, because nothing in that category is ever compared to prod. There is now a test that fails when a `sku: null` entry describes itself as a fallback or default — the shape, written down. Mutation-proved by putting the ₱499 declaration back verbatim.

The literal is gone rather than relabelled: an unreadable catalog now renders **no figure at all**. A missing price is recoverable; a confidently wrong one is not.

### 3 · THE DELTA MODEL SHIPPED. NOTHING RENDERED IT AS A DELTA.

`VENDOR_TIER_SECTIONS` has said *"Everything in Free, plus…"*, *"Everything in Solo, plus:"*, *"Everything in Pro, plus:"* since 2026-07-01, and each tier's items are what **it** introduces. **The model was already right.**

Its only renderer, `vendor-tier-matrix.tsx`, deliberately un-deltas it — its own comment: *"applied CUMULATIVELY (a benefit a tier adds is ✓ from that tier upward, — below it)"*. ~90 benefits × 5 columns = **~450 cells, of which ~360 are restatement.** The haystack, rebuilt from the data written to kill it.

`/vendors` now leads with `VendorTierDeltas`: each plan, its price, its own tagline, only the benefits it adds, and only the numeric ceilings that actually MOVE at that step.

⚖ **THE MATRIX IS KEPT, BEHIND A DISCLOSURE.** A matrix is what the owner asked for on 2026-07-04, and a vendor comparing two specific plans wants a grid. What changed is which one a person meets first. Deleting it outright would be reversing an owner instruction on the strength of a design brief — not an engineering call to make quietly.

### 4 · THREE MORE HARDCODED PESO FIGURES, AND THE REASON GIVEN FOR TWO WAS FALSE

`vendor-benefits.ts` — whose own type says *"prices are NOT stored here… never hardcode prices"* — carried `'Custom · from ₱8,999 / 28 days'` and `'Additional branches (₱999 each)'`. Both were declared rather than fixed, on the stated grounds that Custom *"is not a DB catalog SKU (Custom is composed per plan)"*.

**Untrue.** `vendor_custom_base` is an active row at ₱8,999 and `vendor_branch_28day` is an active row at ₱999 — the same two numbers, in the table an admin edits. `vendor-tier-matrix.tsx` then parsed "₱8,999" back out of the display label with a regex **and carried its own literal as that regex's fallback**, so one reprice would have left three copies disagreeing. All now read `getVendorPrices()`; unreadable → the figure is omitted, never guessed.

🔑 The Custom dials stay **price-free as labels**, because `HomeOverlays` counts them at module level where no catalog read exists. Counting must not need a price; rendering resolves one.

### 5 · A GUARD THAT PUNISHED THE RIGHT FIX

`public-price-literals.test.ts` asserted `backed.length >= 4`. Removing three SKU-backed entries **by deleting the literals** — the outcome the whole file pushes toward — failed it. A count cannot tell that apart from someone relabelling prices as non-prices, and "lower the number until CI is green" is how a guard becomes a rubber stamp. The floor is now a smoke test and the real check (rule 2 above) sits beside it.

Also: the taper sentence in the new component is **derived** via `bookingFeeScheduleSummary()` instead of typing "₱100,000" like the four other surfaces do. That helper composes the whole claim from the same constant `bookingFeePhp()` charges from, is pinned by its own test — and **had zero callers until now**. It also states the ₱50 minimum, which the hand-typed copy omits and its docblock argues is a defect.

### 6 · 🪤 AND THIS CHANGE INTRODUCED ONE OF ITS OWN, CAUGHT BY RE-READING THE CONSUMERS

`aiIntroPhp` used to be an **alias** of the regular price, so the nav overlay's savings comparator doing `const mine = pricing.aiIntroPhp` was harmless. Giving the field its real meaning silently repointed that comparator at the **lower** figure — on a panel that already headlines `aiPrice`, the regular one. Two different prices on one card with no explanation, and every *"you save X"* below it quietly growing.

🔑 **CHANGING WHAT A SHARED FIELD MEANS CHANGES EVERY READER OF IT.** Widening a type is visible to the compiler; narrowing a MEANING is not. The comparator now names `aiRegularPhp` explicitly, which UNDERSTATES the saving — the safe direction, since making it larger is a marketing claim and not a refactor. Guarded and mutation-proved (occurrences 0 → 1, caught).

### VERIFIED

`tsc --noEmit` clean · **7,922/7,922** unit tests · **all 22** `lint-*.mjs` green · `next lint` adds no new warning · **5/5 mutations caught**, each verified to have landed by occurrence count (including the ₱499 declaration restored verbatim, and the catalog read stripped of the column).

SPEC IMPACT: None — no price, SKU or schema changed. Prices that were typed into code are now read from the catalog they already lived in.
