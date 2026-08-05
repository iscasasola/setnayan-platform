## 2026-08-05 · feat(admin): the work list stops spending a whole card on a queue with nothing in it

Step 5 of the act-from-the-list work — the density pass.

**What changed for an admin.** Queues with nothing waiting collapse behind one
quiet line ("12 queues are clear"), so the ones that DO need work are not buried
among them. The line opens to show all of them; nothing is hidden and every
queue is still one click away. Overdue keeps its own section at the top; the
middle section is now "Also waiting" rather than "All queues", which was a lie
the moment anything was collapsed.

**On a phone,** the inline forms from the reviews/payouts slice now take a full
line instead of squeezing the submit button off the right edge at 375px.

🔑 `count === null` MEANS "NOT MEASURED", NOT "ZERO". Those rows stay visible.
Filing an unmeasured queue under "clear" would put it in the one place a reader
has been told they need not look — the silent failure this whole slice could
have shipped.

The split moved out of the component into `lib/admin/queue-partition.ts` with no
imports at all, because the feed pulls in `server-only` through the drawer and a
rule about what an admin is SHOWN deserves a test that can fail cheaply.
Mutation-checked: flipping `count === 0` to `!count` — the natural way to write
this wrong — turns the guard red on the named assertion.

SPEC IMPACT: None.
