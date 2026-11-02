## 2026-08-24 · refactor(admin): fifteen money-and-records desks start at their content (3/4)

Bill `34 → 18`. Receipts · Subscriptions · Budget Planner · Founder seats · Payment methods ·
Verification documents · Website media · Homepage background videos · Live Studio channel pool ·
Pakanta queue · Demand Radar · Vendor recommendations · Help inbox · Integrations · Secrets.

🔒 **Two things were held inside these headers and are not the page name.** The Subscriptions
desk's live *"N pending"* count — the number of vendors waiting on somebody — moves into
`actions`. The Back-to-settings and Back-to-admin links on Payment methods, Integrations and
Secrets sat *outside* the header and are untouched; on a phone they are the only way up a level.

🖨 **`/admin/compliance/data-sheet` leaves the bill as an EXEMPTION, not a conversion.** It is the
one admin screen that is a document rather than a screen — its own copy tells the operator to
*"copy or print this to file with the National Privacy Commission"*, and `sr-only` is
`position:absolute` + `clip`, which does not print. Converting it would have handed the owner an
NPC filing with no heading on it. The exemption is proof-carrying: it voids the moment that
sentence stops being in the file.

⚠ **One stale claim was found and deliberately NOT fixed here.** The Subscriptions lede still
promises that confirming a payment *"grants the bundled tokens"*, and the desk still reads
`addon_token_count` and renders an *"incl. N tokens"* pill — the token currency was retired on
2026-08-07. Its wording is kept **verbatim**: changing what a screen claims about money is a
change, not a refactor, and it needs the confirm action read out of production first. Flagged
separately.

SPEC IMPACT: None.
