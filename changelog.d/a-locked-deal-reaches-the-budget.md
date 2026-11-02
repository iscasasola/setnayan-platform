## 2026-09-09 · fix(chat): a locked Deal reaches the couple's budget — and a price that did not land can no longer read as "frozen"

**The defect, and it was the common case.** A couple renegotiates with a supplier they have **already booked** — the likeliest reason to strike a Deal at all — and locks it. `planChatLockBooking` returns `refresh_fee_only` for every `CONFIRMED_LOCK_STATUSES` row (`contracted` included), and that branch **wrote nothing**, on the rule *"an already-booked row's price is frozen"*. But `lockDeal` still stamped `locked_at`, still froze `chat_threads.agreed_price_centavos` at the **new** total, and the card still said **"🔒 Deal locked — price frozen."**

So the payment step held ₱85,000 while `/budget` — which reads `event_vendors.total_cost_php` — held ₱100,000. **Two live numbers disagreeing, with the reassuring one on screen.** Nothing errored and nothing logged: the write simply matched zero rows, which PostgREST reports as success.

**The rule was right, for a different question.** "Don't rewrite a booked price" protects a *generic re-lock* from clobbering an agreed figure. It was never meant to cover the case where the couple and the supplier have **just agreed a new number in the thread**.

### The fix

1. **The already-booked branch now reprices.** A price-only `UPDATE` of `total_cost_php` — no status flip, no `selection_match_rank`, no `linked_vendor_profile_id`, no fee call. Exactly two columns move; the test asserts the payload's key set, not just the value.
2. **Every write that claims to record a price now reports whether the row MATCHED** (`priceLanded` on `booked` · `requested` · `already_booked`), because a zero-row `UPDATE` is success-shaped and was previously invisible.
3. **`lockDeal` refuses to stamp the Deal when the price did not land**, and says so, above the freeze. 🔑 *A screen may not say "frozen" about a number that never landed* — repricing alone would have fixed the common case and left the silent one.

**Why the price and not a budget line.** `total_cost_php` is an **absolute** write, so locking twice cannot double count, and it is the column the budget already reads for an ordinary supplier. Settling a delta into `event_vendor_line_items` was measured and refused in the same sitting — it *deletes* a headline-billed supplier's price (−₱15,000, not ₱85,000; `a-settled-delta-must-not-erase-the-headline.test.ts`).

⚠ **The fee base moves with the price — owner decision 2026-09-09, not an oversight.** `collectBookingFeeAtLock` reads `total_cost_php` when the **vendor acknowledges the payment**: before that moment the fee is charged on the renegotiated price (what they actually booked at); after it the order is already minted and idempotent, so nothing moves. Recorded here because the comment that forbade repricing named this as its reason.

🔢 Nobody is affected retroactively: **zero amendments have ever existed in production.** But the feature is switched on.

🧹 Also deleted a comment that had become false in the same edit — the note calling the `refresh_fee_only` branch *"consequently inert"*. It is now the only path by which a mid-plan deal reaches the budget.

### The guard — `apps/web/lib/a-locked-deal-reaches-the-budget.test.ts` (5 tests)

Behaviour is driven through the **real** `bookVendorAtChatLock` against a stubbed PostgREST client (`server-only` shimmed the way `booking-fee-anchor.test.ts` does), so the `UPDATE` payload is **captured and asserted**, never inferred from source: an already-booked supplier is repriced · the reprice touches exactly `total_cost_php` + `updated_at` · a zero-row match reports `priceLanded:false` · a first lock still books · `lockDeal` carries the refusal **above** the freeze (ordering asserted, since a refusal after the stamp refuses nothing).

`NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` is pinned inside the test — the plan branches on it, and an env-dependent expectation is a test that passes for a reason nobody chose.

🛡 **5 mutations, each measured before → after, all RED, all restored.** Counts in the PR body.

SPEC IMPACT: `DECISION_LOG.md` + `SESSIONS_Chat_Bench_Exclusive_2026-09-09.md` — the open defect recorded on 2026-09-09 is now CLOSED, with the fee-base consequence written down as the owner's ruling. The second option considered (making a delta line safe on a headline-billed supplier, which would also repair `accept_change_order`) stays open and unbuilt.
