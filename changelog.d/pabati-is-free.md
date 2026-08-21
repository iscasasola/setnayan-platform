## 2026-08-21 · feat(papic): Pabati is free — and the line between features and shots is now asserted

**Owner, 2026-08-21:** *"we already agreed all features of papic will be free like kwento"* — then, asked to place the boundary exactly: **Pabati free, the Thank-You film stays paid.**

Pabati — the guest-recorded greeting video — was **₱1,299 per day** and had **never been bought by anyone** (0 orders, ever).

## Why it could not stay priced

🔑 Owner: *"pabati is part of papic challenge."* Verified: the Papic Challenges library that shipped the same day already carries a **`greeting`** category — *"a message to camera for the host"* — and a `video_greeting` shape. **Charging ₱1,299 for one challenge while the library containing it is free is not a price, it is a contradiction.**

## Same two halves, third time

Deactivating the row alone would make the feature **unavailable, not free** — every gate asks `eventSkuActive('PABATI')`, so no row ⇒ no owner ⇒ dark for everybody. The migration takes the price off; `FREE_FOR_ALL_SKUS` keeps the feature on. Third application of the LIVE_WALL shape, after Kwento hours earlier.

## ⛔ The line, and it is now a test

Papic **features** are free. Papic **shots** are the product.

- Untouched: the shot ladder — **50 free, then ₱50 / ₱1,000 / ₱3,000 / ₱5,000**, owner-locked.
- Untouched: **PAPIC_ADDON_THANK_YOU (₱2,499)** — the owner's explicit ruling, and consistent with the 2026-06-10 note that the *produced video* is what gets monetised.

A new assertion fails if any of those five ever joins the free set. **That is the guard that stops a future "make Papic free" sweep taking the revenue with it.**

## Three tests broke, and each break was correct

Making a second SKU free in one day walked straight into tests that had been pinned to the first:

1. The missing-SKU test had just been re-pointed at **PABATI** hours earlier (because KWENTO left the list) — and PABATI then left the list too. Re-pointed at a code that is genuinely still required, with a note about picking one that is *not part of the change*.
2. The retired-SKU test flipped **PABATI** to inactive and expected a throw — impossible once Pabati is legitimately inactive and no longer prose-priced. Now uses a SKU that is still both.
3. The Kwento guard used **`'PABATI',`** as a "neighbour proves the slice is real" anchor. Gone from the list; swapped for one outside the change.

🔑 **All three failed loudly rather than passing vacuously**, which is the only reason they were noticed — and each now carries the reason in a comment.

## Verification

5 sabotages, each measured by occurrence count, each RED — including the two that matter most: **the shot ladder swept into the free set**, and **the Thank-You film swept in**.

- Unit suite **9310 pass / 0 fail**. Typecheck, `next lint`, `lint:port-controls` and the migration timestamp guard clean.

SPEC IMPACT: `Pricing.md § 00` — PABATI moves from ₱1,299 to free. Recorded in this session's DECISION_LOG row.
