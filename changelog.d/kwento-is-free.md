## 2026-08-21 · feat(papic): Kwento is free

**Owner decision, 2026-08-21, verbatim: "kwento is free."**

Kwento — the words a guest writes on a photo they were tagged in — was **₱299** and had **never been bought by anyone** (0 orders, ever). It is now free for every event.

## The obvious fix is the exact opposite of the instruction

🪤 Every gate on Kwento asks whether the event **OWNS** the SKU — the route that accepts the message, the guest's prompt, and the couple's review queue. Setting `is_active = false`, the way a genuinely retired product is taken off sale, means nobody can buy it ⇒ nobody owns it ⇒ **the feature goes DARK for everyone.**

**Free and retired are identical in that table and opposite in the product.**

So this ships in two halves that only work together:

- the **migration** deactivates the row, so nothing quotes a price;
- **`FREE_FOR_ALL_SKUS`** gains `KWENTO`, which short-circuits all three ownership predicates and is what actually keeps the feature switched on.

This is the LIVE_WALL change of 2026-08-11 applied to a second SKU, deliberately step for step — including its warning that both halves ship together or not at all.

## The paywall is deleted, not hidden

🪤 The buy drawer priced itself `kwentoSku?.price_php ?? 500`. Deactivating the row makes that lookup return null — so a branch left standing would have quoted a **₱500 fallback for something that is free**, and ₱500 is not even a price this SKU ever charged. The hardcoded-fallback trap: the cure is removing the branch, not trusting it never renders.

The `Set up Papic` prerequisite stays — Kwento writes words onto Papic photos, so Papic still has to exist first. That is now the *only* reason the queue is ever withheld.

## llms.txt: both halves, or the document dies

Removing the code from `REQUIRED_RETAIL` **and** rewriting its prose line to "free" is mandatory. Leaving the entry throws `RetiredSkuError`; leaving the price call throws `MissingSkuError`; either drops the whole AI/GEO document to its 603-byte stub. That is not theoretical — it happened in production with `PAPIC_ADDON_STORIES`. The hand-written test fixture is updated too, because CI reads it, not the database.

## Verification

9 sabotages, each measured by occurrence count, each RED — including **the harmful one**: deactivating the row while *not* adding the free switch, which is the change that takes Kwento away from everybody. Also covered: losing LIVE_WALL in the same edit, zeroing the price instead of deactivating, dropping the idempotence guard, re-adding the code to `REQUIRED_RETAIL`, printing a price again, restoring the drawer, restoring the ₱500 fallback, and ripping out the entitlement check.

🪤 **Three of my own guards were wrong on their first run, and each is now recorded in the test that caught it:**
- `REQUIRED_RETAIL` is **module-private**, so importing it returned `undefined` and every assertion on it passed vacuously — it threw, loudly, which is the only reason it was caught. The list is read out of the source instead.
- The prose-price assertion matched the string inside **the comment explaining its own removal**. Raw 1, stripped 0.
- **A mutation found a hole no review would have:** removing the migration's real `IS DISTINCT FROM false` guard left the phrase standing in the migration's prose, so the assertion went green on a comment while the statement had lost its idempotence. Comments stripped, and the count pinned at exactly one — in the statement, not the prose.

🛡 `lint:port-controls` caught the deliberate removal of the buy drawer and required the baseline regenerated in this same PR. **Verified the regeneration absorbs no other removal**: across the whole baseline exactly two lines changed — `InlineCheckoutDrawer` on this route (mine) and one trailing comma.

- Unit suite **9308 pass / 0 fail**. Typecheck, `next lint` and the lint guards clean; migration timestamp guard clean.

SPEC IMPACT: `Pricing.md § 00` — KWENTO moves from ₱299 to free. Applied to the corpus in this session's DECISION_LOG row.
