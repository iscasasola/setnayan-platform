## 2026-09-18 · feat(budget): export the budget as a CSV or a printable page (SUP-64)

Re-measured: the budget app had no CSV or print export anywhere (only the
`.ics` of upcoming payment dates).

`/budget`'s masthead now offers **Budget (.csv)** and **Print budget**, both
served by `app/api/budget/[eventId]/export/route.ts` (printable HTML by
default, `?format=csv` for a spreadsheet — the caterer report's shape).

- **Same books as the page:** summary from `resolveEventMoney`, per-category
  Planned · Agreed · Paid · Owed from `buildBudgetLedger` fed by the saved plan
  and `suggestedPlanByBucket` (SUP-65), item lines from the resolver's ledger.
  Nothing is recomputed.
- **Agreed money only** — BA2's "no quotes here" holds on paper: estimated lines
  are left out.
- **Same doors as the page, before any money is read:** signed in → the event
  type has a Budget surface → `resolveBudgetVisibility().mayRead` (403 for a
  delegate without budget access).
- **No resolver, no file:** a 503 with a plain "try again" — never a CSV of ₱0s —
  and the page only offers the two buttons when the resolver answered.
- A label typed by a couple or supplier can never run as a spreadsheet formula
  (`=`/`+`/`-`/`@` prefixed with `'`); the print page escapes all typed text.

Guard: `lib/budget-export.test.ts` (executes the rules; sabotaging the formula
prefix turns it red; pins the route's access-before-money order and its 503).

SPEC IMPACT: None.
