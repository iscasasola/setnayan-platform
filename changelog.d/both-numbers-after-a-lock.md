## 2026-09-10 · feat(budget): after a lock, a price change shows BOTH numbers

Owner ruling 2026-09-09, asked directly whether a price change after a lock should
replace the agreed total or sit beside it: **"Both, shown separately."** The agreed
total UPDATES and the change stays visible as its own line. He was told plainly that
this is the most work and that two numbers to keep in step is exactly how the current
defect happened, and chose it anyway — so the guard is as much the deliverable as the
feature.

**What was wrong.** `accept_change_order` settles an agreed delta as a signed row in
`event_vendor_line_items`, which is right — but that table carried ONE meaning: the
couple's itemised BREAKDOWN of a supplier's price, which every money reader implements
as "once any line exists, bill the lines and DROP the headline." So accepting a −₱15,000
reduction on a ₱100,000 supplier did not report ₱85,000: it deleted the ₱100,000 and
reported −₱15,000. The one branch where the write behaved (a package anchor) is used by
nobody — production holds zero anchors — so the broken branch was the only branch.

**What ships.**
- `event_vendor_line_items.is_change_delta` (migration `20271218458148`) tells a settled
  CHANGE from an ITEMISATION. `accept_change_order` re-signed to stamp it; nothing in
  application code may.
- `lib/agreed-total-and-its-changes.ts` — ONE cascade, replacing three hand-copied ones
  (`budget-truth.ts` and `budget.ts` ×2; two of the three had never inherited R12).
  `agreed` is returned as `pricePart + breakdownPart + changesPart` in one expression, so
  the total on screen and the rows under it are the same arithmetic — there is no second
  number to keep in step.
- Change lines are drawn in EVERY branch, under their own `vendor_change_delta` source,
  and get their own "Changes you both agreed" section on the couple's card — with no
  delete control, because one side may not erase what both sides agreed.
- The budget strip's committed figure (flag-OFF path, which is what the owner will see)
  moved out of the page into `legacyCommittedVendorsPhp` and learned change deltas; it
  had been summing headlines alone while each supplier's card showed the new total.
- The chat's locked notice stopped claiming a booking it does not have and gained a role
  test: it said "🔒 Deal locked — price frozen." to BOTH parties, while with the lock
  handshake ON (it is on in production) the supplier may hold an unanswered 48-hour
  request. `lockedAt` records a frozen PRICE; the copy now says exactly that.

⚠ NOT symmetric, deliberately: an UNFLAGGED line still REPLACES the headline. All 12
suppliers carrying line items in production sum to their headline exactly, so making
breakdowns ride on top doubles every one of them.

⏭ NAMED, NOT BUILT: the chat card still cannot say whether the supplier is BOOKED or
merely ASKED — that needs the booking state threaded into a card built client-side from
`proposal_amendments` alone. `SupplierStanding` already derives `booked` on the server.

Safe by arithmetic at the merge (read out of prod): 0 change orders ever · 18 line items,
all defaulting to BREAKDOWN · 0 package anchors. No number on any screen moves the day
this lands; it changes what the next accepted change order does.

SPEC IMPACT: DECISION_LOG.md — the 2026-09-09 "Both, shown separately" ruling is recorded
with what it cost and what it deliberately left asymmetric.
