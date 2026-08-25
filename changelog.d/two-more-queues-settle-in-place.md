## 2026-08-26 · feat(admin): help tickets and chat flags settle without leaving the list

Two more of the 19 act-now queues gain a drawer, taking settle-in-place from **5 to 7**.

**Both are FORMS, not buttons — decided by what the code refuses to run without**
(owner's rule, 2026-08-05): `setHelpMessageStatus` throws *"Invalid status"* without one,
and `resolveChatFlag` throws *"Pick an action"*. Neither is a one-click fact.

**Why these two and not the other six.** Of the eight queues without a panel:
`booking-fees` deliberately has no action at all (money is confirmed on Payments, where the
proof is) and `completions` is a **judgement** — force-complete vs uphold non-delivery rules
on whether a supplier delivered. Of the remaining six, **help and chat-flags are the only
two whose actions do not `redirect()`**, so they need no swallow-the-redirect wrapper. The
other four (corrections 5 · subscriptions 8 · payment-options 1 · partnerships 6) each need
that wrapper first — real plumbing, not panel work.

⚠ **THE CHAT-FLAG DRAWER DELIBERATELY DOES NOT SHOW THE MESSAGE.** It shows the categories
matched and the hit count. The page's own pinned sentence — *"This queue shows only the…"* —
exists so a reviewer does not think they are about to read somebody's private conversation,
and a drawer that leaked the body would break that promise in the one place nobody would
look for it.

🚨 **A GUARD REFUSED TO LET THIS SHIP AND WAS RIGHT.** Both wrappers write `settle=saved`,
and **nothing rendered that outcome** — so a successful settle would have redrawn the page
identically to doing nothing. `guards-can-actually-fire` caught it before the branch left
my machine: *"these outcomes are written but never displayed: saved."* `SETTLE_NOTICES`
gains it.

🪤 **And a second guard caught a self-inflicted parse break.** `queue-peek-coverage` reads
`PEEK_QUEUES` **by regex**, so the explanatory comment I put INSIDE the brackets was parsed
as a queue name and reported as a missing branch. The array is a plain list of string
literals again, with the annotation above it and a note saying why it must stay that way.

Verification: `tsc --noEmit` **exit 0**; full unit suite **10,056 pass / 0 fail, exit 0**.

SPEC IMPACT: None — no rule, price or behaviour changes; two queues gain an inline form.
