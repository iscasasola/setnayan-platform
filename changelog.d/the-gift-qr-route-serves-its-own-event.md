## 2026-09-17 · fix(pabuya): the gift-QR route serves its own event's object, or nothing

`/api/pabuya/qr/[publicId]` streamed bytes with ADMIN credentials from whatever
bucket and key `event_egift_methods.qr_r2_key` named, resolved by
`parseStoredAsset` — which validates neither against the event.

🔴 `event_egift_methods_host_all` lets a host write their own row and the column
is plain text, so a signed-up stranger could point their own gift method at
`r2://setnayan-vendor-verification/<somebody's ID scan>` and read it back through
a route that had already decided they were a host. The only thing preventing it
was that the legitimate value HAPPENED to be the public bucket — a coincidence,
not a check, and one that disappears the moment a private bucket becomes a
legitimate home for this column.

🔴 It also answered a `legacy_url` with `NextResponse.redirect(…, 307)` — an open
redirect on setnayan.com reachable by writing a URL into your own row. No such
row has ever existed: the column was born `r2://` (20270725802892) and every
writer goes through `parseClientRef`. A branch for a case that never occurred,
costing an open redirect to keep.

The read side now asks the WRITE side's question of the same column, via the new
pure `lib/pabuya-qr-ref.ts`. A refused ref is LOGGED as a refusal and answered
404 — deliberately not conflated with "this couple never uploaded one".

The accepted-policy LIST is the whole bucket-transition surface in one place:
add the private policy when the move lands, delete the public one when the
migration count reads zero.

Guarded by `lib/pabuya-qr-ref.test.ts` — 17 EXECUTED cases (the resolver is
pure), count printed. Two corrections while writing it, both recorded in the
file: the source assertion matched `parseStoredAsset` inside the route's own
explanatory comment (third comment-vs-code trap today, now stripped); and a
percent-encoded `..` was asserted as a traversal when it is not one — an R2 key
is an opaque string, `%2F` is not a separator, and the literal `..` segment is
refused. That test now pins WHY rather than asserting a path grammar that does
not exist.

SPEC IMPACT: None.
