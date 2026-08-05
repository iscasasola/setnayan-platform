## 2026-08-05 · fix(admin): three guards that could never fire, and a refusal nobody saw

A verification pass over the same day's work found three defects with one shape:
**a mechanism built and never proven reachable.** All three were green in CI.

**1 · 🚨 THE DUPLICATE-REFERENCE CHECK WAS INERT FROM THE HOUR IT MERGED.** It
queried `status IN ('matched','paid')`. **There is no `'paid'`** — the enum is
`pending / matched / rejected`. Postgres rejected the whole query, `data` came
back null, the loop saw zero priors, and the guard concluded *"no duplicates"*
on every payment. Its seven tests passed because they read source and exercised
the pure comparison; **neither runs the query.**

🔑 **THE HOUSE RULE APPLIED ONE LEVEL TOO SHALLOW.** "A Supabase call naming
something the schema does not have returns an ERROR, not a crash" — I had
internalised that for COLUMN names and missed it for ENUM VALUES, which fail
identically and just as silently.

Fixed, and the lookup now **refuses when it cannot read** rather than falling
through to "clear". Swallowing that error is exactly what made this invisible:
*found nothing* and *could not look* produced identical, reassuring behaviour.

**2 · `unreadable` COULD NEVER BE SET.** It lived only inside a `catch` —
but **Supabase does not throw**, it resolves with `{ error }`. So a renamed
column or a permission change still rendered *"Nothing waiting here"* with a
green tick over work that was genuinely sitting there. All five peek reads now
check their error.

**3 · EVERY REFUSAL FROM THE WORK LIST WAS INVISIBLE.** The actions write
`settle=` and `why=` into the URL on a shortfall or a refusal — and **nothing
read them.** Worse: the payment row flips to `matched` *before* the shortfall is
detected, so the row drops out of the list and the count ticks down. Every
signal on screen read as success while the order sat unpaid, no receipt sent,
nothing switched on. A docblock I wrote asserted the opposite.

🔑 **A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT PASSED.**
The work list now shows the reason, and a shortfall and a duplicate are worded
**differently** — one means "wait for the rest of the money", the other means
"someone may be claiming a transfer twice".

**The guard against the whole class**: every payment status used in a query is
checked against the real enum in the migrations; every peek read must check its
error; every `settle=` outcome the actions write must have somewhere to be
shown. All three mutation-checked. ⚠ The status scan is scoped to the QUERY
CHAIN, not the file — a first cut reported ten ORDER statuses as violations, and
a guard that cries wolf teaches you to skim past the one time it is right.

SPEC IMPACT: None.
