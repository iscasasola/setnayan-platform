## 2026-08-20 · fix(dashboard): four defects an adversarial pass found in #4603 — all mine

An adversarial review of my own merged diff (5 independent lenses, 18 candidates,
2 skeptics per finding, 4 survived). Every one is verified by hand against the
real file and the live database before acting.

**1 · 🚨 THE REMOVAL DIALOG COUNTED PEOPLE THE COUPLE HAS NEVER SEEN.** Guests are
**soft**-deleted: removing one writes `deleted_at` and leaves the row. Every guest
read in the app filters it out, and so does the RLS SELECT policy itself — but
this count uses the ADMIN client, which applies no RLS at all, and it was the one
guest read in the repo without the clause.

Measured in prod: **"Cale & Ice" holds 6 guest rows of which the couple can see 2.**
The confirmation said *"6 guests go with it"* — and because zero-valued lines are
hidden, that wrong number was the **only** figure on the screen, read immediately
before an irreversible press, on the owner's own event. 🔑 *A correction at one
site is not a correction* — inverted: one NEW site written without the filter the
other ~24 carry.

**2 · 🚨 THE PILL PRINTED TWO NUMBERS IN A ROW.** `summarizeEventDecisions` returns a
label that is **already count-led** — "3 payments to settle" — so rendering the
total straight before it produced **"9 3 payments to settle"**, and **"3 3 payments
to settle"** whenever one kind was the only kind waiting. On the pill the owner
asked for by name. The total now carries its own noun ("9 need you · 3 payments to
settle"), and `· N more` is suppressed once a total is shown, because the total
already counts the remainder.

**3 · 🚨 HALF THE PHONE MENUS OPENED OFF THE SIDE OF THE SCREEN.** The popover is a
fixed 280px; a two-up chip is ~160px. The root cause was subtler than the width:
the button and the popover shared an `absolute` wrapper ~32px wide, so `right-0`
measured from the **button's** edge, not the card's — and `left-0` would have hung
it off the right instead. **Anchoring a 280px panel to a 32px box can never place
it.** Both are now positioned against the card's own box, and the two-up grids
alternate the anchor by column, so each panel opens into the space that exists.

**4 · 🛡 NO GUARD PROVED THE MENU WAS MOUNTED.** The suite proved the wrapper was
*defined* and that cards were told a menu would be laid over them — neither of
which renders anything. **Deleting all five wrappers left the launcher suite
green** while the control vanished. The imported-but-not-mounted decoration, in
the guard file written to prevent exactly that.

**Guards:** 4 new assertions (15 total in the file). All six mutation-checked with
occurrence counts printed before → after, all RED.

🪤 **AND THE FIRST RUN OF THE GUEST MUTATION REPORTED GREEN.** The docblock I had
just written quotes `.is('deleted_at', null)` verbatim, so the sabotage replaced
the **comment's** copy and left the query untouched — a mutation that landed on
the wrong occurrence and looked exactly like a decorative guard. Re-run against the
query itself: RED. 🔑 **When a comment quotes the code it protects, an
occurrence-count mutation can hit the prose.** Target the expression.

SPEC IMPACT: None — no decision changed; these are defects in the 2026-08-20 build.
