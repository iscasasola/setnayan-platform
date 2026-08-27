## 2026-08-27 · fix(admin): a found record opens the record, not a diagram of its type

The Entity map's cross-record search has always found real things — typing
`setnaprod` returns the owner's own shop — and every hit carried an `href`.
**Nothing read it.** Each hit rendered as a button that highlighted the generic
TYPE node, so searching a shop by name opened the word *"Vendors"*. All five
kinds behaved that way, and the same dead field on `UgatRow` meant the table
browser rendered each record's id and threw it away on the very next line.
The **seventh** "gate with no handle" recorded in this repo.

**Treated as unwritten, not half-working.** Never once exercised, four of the
five hrefs had drifted to a LIST page, so wiring them verbatim would have
"opened" a page with every record on it. Each destination was re-derived by
reading the page it names:

| kind | destination |
|---|---|
| shop | `/admin/vendors/[vendorProfileId]/edit` (already right) |
| person | `/admin/users/[userId]` (was the list) |
| celebration | `/admin/accounts?tab=events&q=<public_id>` |
| category leaf | `/admin/taxonomy?open=<tile_id>` |
| order | `/admin/money` |

**Order is deliberately not the precise-looking answer.** `/admin/payments?q=`
filters, but it queries PAYMENTS scoped to matching orders, so an order with no
payment row returns nothing — the state of the only order production has ever
held. *A queue is not a ledger*: `/admin/money` lists every order in every
status, so it always contains the record you found. Focusing one row there is a
named follow-up, not something faked here with a link that lands empty.

**The structural fix is the type.** `ugatRecordHref` returns `string`, never
`string | undefined`, and switches exhaustively over the kind, so a sixth kind
cannot compile until somebody decides where it opens. `UgatSearchHit.href` is
now REQUIRED for the same reason — the compiler refuses a dead link, not a
reviewer. `typeNodeId` and its lookup map are DELETED rather than left behind:
with hits carrying a real destination they had no reader, and keeping them
would have replaced one dead field with another.

Rows on the three tables that genuinely have no admin page (services, threads,
samahan) still fall back to the type card instead of inventing a link.

SPEC IMPACT: None.
