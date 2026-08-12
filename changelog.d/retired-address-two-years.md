## 2026-08-12 · change(routing): a retired address is out of circulation for TWO years, not one

Owner, 2026-08-12: *"make it 2 years."*

**This supersedes the owner lock of 2026-08-10** (*"slug will be available again
after 1 year from date of deletion"*). That quote is kept at its source as the
origin of the rule — the number in it is no longer current, and the file now
says so rather than leaving two readings alive.

🔑 **ONE NUMBER, DERIVED.** `RETIRED_SLUG_HOLD_MONTHS = SLUG_FORWARDING_MONTHS`.
A retired address is now out of circulation for exactly as long as a renamed one
keeps forwarding. Two separate constants for *"how long is an address
unavailable"* is how a correction at one site becomes a contradiction at the
other — a shape this repo has paid for more than once.

Applies to every retirement: a closed shop, a deleted wedding, a corrected shop
address.

**Month arithmetic, not a day count.** "Two years" has to mean the same calendar
date; 730 days drifts through a leap year and releases an address a day early,
silently. A date that does not exist in the target month (29 Feb + 24 months)
rolls **forward** — holding it a day longer, never releasing it early. Both
pinned in tests.

📣 **A user-facing string was about to lie.** *"It becomes free again a year
after it closed"* is shown to whoever tries to take a closed shop's address —
and would have gone on saying "a year" while the real answer was two, sending
them back twelve months early. Now derived from the constant.

🛡 **A guard fired, and was honoured rather than deleted.** The db test asserting
the hold and the forwarding window differ carried its own instruction: *"if
these ever coincide, re-verify by hand that the hold still sets its own
expiry."* They now coincide by owner decision, so it was re-verified and
**replaced with the property it was only ever a proxy for** — that each
retirement path sets `redirect_until` **explicitly** rather than inheriting the
column default. That is the real risk once the numbers match: a path could start
inheriting, invisibly, and every held address would move with any future change
to the forwarding window without anyone deciding it.

Mutation-proved: deleting the explicit expiry from the deleted-wedding path
turns it red and names the file; restored, green.

SPEC IMPACT: DECISION_LOG.md — retired-address hold raised 1 year → 2 years,
superseding the 2026-08-10 lock.
