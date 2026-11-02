## 2026-08-19 · fix(guests): a refused read no longer tells a couple they have no guests

The couple's half of the rule the supplier's side adopted on 2026-08-18
(`vendor-dashboard/reads-are-honest.test.ts`).

`fetchGuestsByEvent` carries a five-pass hotfix header ending in "empty page >
error page": any refused read — RLS denial, auth expiry, a statement timeout on
the wide 40-column select, schema drift — is logged and turned into `[]`. That
much is right. It stopped one step short: the page then STATES the absence.

    masthead ......... "0 guests"
    roster ........... "No guests yet. Start by adding the couple's first invite."
    confirmations .... "0 of 0 responded · 0%"

…to a couple with 180 names and 120 replies, three weeks out, in output
BYTE-IDENTICAL to a genuinely new event — so they cannot tell which they are
looking at. On a phone it is worse: the desktop header is deliberately hidden
because "the carousel's Summary panel carries the count", so the zeroed summary
is the only count there is.

🔑 A LOG LINE NEVER CHANGED A PIXEL. The error was already bound and already
sent to Sentry, and the couple was still told their wedding was empty. The
measurement has to reach the RENDER.

`fetchGuestsByEventMeasured` returns `{ rows, measured }`. The ~30 callers that
never state an absence — seating actions, print routes, CSV exports, the caterer
sheet — keep the array-only `fetchGuestsByEvent`, which now DELEGATES rather
than repeating the query, so the two cannot drift. The three surfaces that make
a claim gate it: the zero-state becomes "We couldn't load your guest list —
nothing has been lost", the masthead drops the headcount, and the RSVP meter
reads "not loaded" instead of inventing 0 of 0.

SPEC IMPACT: None.

FOUND BY a 16-agent sweep over 52 couple-facing files, each candidate attacked
by a second agent trying to refute it; 12 confirmed. This PR fixes the worst
one. The other 11 are listed in the PR body, NOT fixed here — several are money
figures ("Paid ₱0", "₱0 committed") that deserve their own change.

⚠ The sweep was pointed at a worktree of `origin/main`, NOT at `~`, which is 749
commits stale. An earlier sweep aimed at `~` returned a confidently-argued wrong
finding with real-looking line numbers.
