## 2026-09-09 · fix(chat): the obvious way to make an accepted Deal reach the budget CORRUPTS it — measured, pinned, and the real hole named

**The task was "make accepting a Deal move the money." It should not be built the obvious way, and this is the arithmetic that proves it.**

### The naive fix deletes the supplier's price

Copying `accept_change_order` — settle the net delta into `event_vendor_line_items` — reads as the right move: same tables, shipped pattern, proven RPC. Measured on `computeEventMoney`, it is worse than the bug it fixes.

`computeEventMoney` treats `event_vendor_line_items` as the couple's **itemised breakdown**, with `event_vendors.total_cost_php` as the **fallback when no breakdown exists**. Its branch is explicit: once any manual line exists, `priceC` stays `0` and only the lines are billed.

| supplier billed by | before | after a −₱15,000 settlement line |
|---|---|---|
| headline (`total_cost_php`) | ₱100,000 | **−₱15,000** — the ₱100,000 is *deleted*, not reduced |
| package anchor | ₱100,000 | ₱85,000 ✅ (that branch rides lines *on top*) |

🔴 **The shipped change order already carries this.** `accept_change_order` writes exactly such a line with no package-anchor condition. Latent, not theoretical — unobserved only because production holds zero change orders. **Named, not fixed:** repairing it changes what a real couple's budget reports, so it is the owner's call.

### What actually happens to an accepted Deal — my earlier account was incomplete

Accepting is an **agreement**, not a settlement, and that is the design. The card then shows the couple a **"🔒 Lock this deal — ₱85,000"** button, and `lockDeal` writes the agreed total to `event_vendors.total_cost_php` via the shared `bookVendorAtChatLock`. That is an **absolute** write, so locking twice cannot double count. **For a not-yet-booked supplier the money lands correctly**, and the couple is prompted with the exact figure. The earlier framing — "accepted, and nobody is told" — overstated it.

### ⚠ The real hole, and it is the default path

`planChatLockBooking` returns `refresh_fee_only` for every `CONFIRMED_LOCK_STATUSES` row — **`contracted` included** — so an already-booked supplier's price is deliberately never rewritten (*"a rewrite would diverge the displayed total from the charged base"*). But `lockDeal` still stamps `locked_at`, still freezes `chat_threads.agreed_price_centavos` at the **new** total, and the card still says **"🔒 Deal locked — price frozen."**

So the payment session holds ₱85,000 while the budget holds ₱100,000 — **two live numbers disagreeing, with the reassuring one on screen.** A mid-plan change on a booked supplier is the likeliest use of a Deal, so this is the common case, not an edge.

Closing it means either rewriting a booked total (which moves the base the booking fee was charged on) or making a delta line safe on a headline-billed supplier (which changes every couple's budget). **Both are money decisions — raised to the owner, not taken here.**

### The guard — `apps/web/lib/a-settled-delta-must-not-erase-the-headline.test.ts` (4 tests)

1. The corruption, as live arithmetic on `computeEventMoney` — not prose. If the branch ever changes so a delta rides a headline, the test says so and tells the reader this file needs revisiting.
2. The package-anchor case is correct — included so the asymmetry is visible and "then just always use a line item" is not the takeaway.
3. `negotiation-actions.ts` writes no ledger line, anchored on `respondAmendmentFromChat` existing first so a rename cannot pass it vacuously.
4. A booked supplier is never repriced by a chat lock, and an unbooked one still is — the route by which an accepted Deal reaches the budget at all.

🛡 **5 mutations, each measured before → after, all RED, all restored.** Counts in the PR body.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-09 — the settlement clause is corrected: accepting is an agreement by design and the money lands at LOCK; the open defect is the already-booked lock claiming a frozen price the budget never receives. Two owner decisions recorded (reprice a booked total vs. make a delta line safe), neither taken.
