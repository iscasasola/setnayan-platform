## 2026-08-05 · fix(admin): the work-list actions audit — one button that stranded orders, five dead taps, two that could never work

A five-lens audit of the shipped act-from-the-list work, each finding handed to
a skeptic who tried to refute it. Seventeen survived. This fixes the ones that
change what a person experiences.

**1 · "Confirm payment" did not finish the sale.** 🚨 The worst of them, and mine.
`approvePaymentFromWorkList` passed `promoteOrder: false`, reasoning that
promotion "belongs on the payments page". **It cannot happen there** — that page
only offers Approve while a payment is `pending`, and the call has already moved
it to `matched`. So: the row vanished, the action reported success, the order
never became paid, no receipt went out, the SKU never switched on, and **no
admin screen was left that could rescue it.** Now `true`. The shortfall guard
inside the core is what makes that safe — a transfer that does not cover the
gross returns `{ ok: false, shortfall }`, provisions nothing, and bounces the
admin back to the list with the reason.
🔑 **One click is only honest if it finishes the thing it claims to.**

**2 · Five rows were dead taps.** Token sales, Subscriptions, Payment options,
Help, Partnerships. Every row was handed an `?open=` link, but only some queues
have a peek — so the URL changed, nothing rendered, the page redrew identically,
and on a phone it jumped to the top. Those rows used to open their queue page,
so the work made them **worse**. Expansion is now opt-in per queue via
`EXPANDABLE_QUEUES`.
🔑 **A control that cannot succeed must not be offered.**

**3 · The badge and the list disagreed about payouts** — found while fixing #2,
not by the audit. The row counted `paid_at IS NULL AND NOT on_hold` (V2 payout
model); the drawer listed `released_at IS NULL` (V1). **Both columns exist**, so
nothing errored and the two would have disagreed forever, silently. Every peek
branch now builds through `getQueueSource()` — the same table and filter the
count used. Four hand-copied predicates removed.
🔑 **The number and the list must come from one predicate.**

**4 · "I agree" appeared on your own request and always failed.** Four-eyes: the
database refuses `decided_by = initiated_by` and the approvals page says so
kindly. The drawer did not know who was looking. It now does, and shows the
sentence instead.

**5 · "Publish" appeared on the two appeals the system refuses outright.**
`owner_self` / `team_member` — a shop reviewing itself — is refused by the
trigger even with bypass. The drawer copied the rows but not the rule.

**6 · A failed read claimed the queue was clear**, with a green tick. That is a
positive claim, not a blank. `unreadable` is now distinct from empty.
🔑 **If you cannot prove you saw the rows, do not report that there are none.**

**7 · The reviews form jumped you to another page**, losing the lane and the
open row. It now stays put. Only a `NEXT_REDIRECT` is swallowed — a real refusal
is a plain Error and is rethrown, so it can never be mistaken for success.

Two guards added, **both mutation-checked**: dropping a queue from the declared
list, and letting a branch name its own table, each turn the suite red on the
named assertion. The coverage guard parses the real source rather than comparing
two hand-typed arrays.

SPEC IMPACT: None.
