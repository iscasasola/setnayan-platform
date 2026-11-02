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
- The chat's locked notice: this branch first wrote its own sentence; #5393 then landed
  `lockFreezeLine`, which reads the booking's own handshake state and says "Deal locked"
  only from a real booking. That is the true one, so the card takes it whole and the
  guard now pins the card to it (see the 2026-09-11 block below).

⚠ NOT symmetric, deliberately: an UNFLAGGED line still REPLACES the headline. All 12
suppliers carrying line items in production sum to their headline exactly, so making
breakdowns ride on top doubles every one of them.

Safe by arithmetic at the merge (read out of prod): 0 change orders ever · 18 line items,
all defaulting to BREAKDOWN · 0 package anchors. No number on any screen moves the day
this lands; it changes what the next accepted change order does.

SPEC IMPACT: DECISION_LOG.md — the 2026-09-09 "Both, shown separately" ruling is recorded
with what it cost and what it deliberately left asymmetric.

## 2026-09-11 · feat(budget): a new deal after the lock is a change too — and the fee still follows the price

B2 rework of this PR, after it went CONFLICTING and red.

**The branch this PR did not cover.** Since #5355 (2026-09-09) a Deal the couple locks
on an ALREADY-BOOKED supplier overwrote `total_cost_php` — the ₱100,000 they locked at
was simply gone, the exact REPLACE the owner ruled against. It now calls the
service-role `record_agreed_price_change`, which leaves the agreed total alone and writes
(new total − the agreed total as it stands after earlier changes) as a change line. A
second press of the same Deal writes nothing; a Deal after a Deal or after a change order
lands exactly on the new number. A booking with no agreed total yet is priced instead.

**What else the migration now carries.**
- A line already settled by a change order is stamped as a change (taken from the
  never-committed `an_adjustment_never_erases_the_price` draft; 0 rows in prod).
- A guard: a browser session cannot create, re-flag, edit or delete a change line — the
  heading "Changes you both agreed" claims the supplier's consent, and the supplier can
  read that table. The couple's own lines are untouched; removing a supplier still
  removes its lines.
- The booking fee reads the agreed total INCLUDING changes, both when first charged and
  when re-derived, and a change line fires the same re-derive a price move always did —
  so the 2026-09-09 ruling "the fee base moves with the price" survives the price column
  no longer moving. ⚠ New: an accepted change order now moves the fee too.

**On screen.** The couple's card prints the agreed price before changes, each change
signed, and the agreed total now — ₱100,000 · −₱15,000 · ₱85,000. "Ask them for
pricing" (N2 item 2) opens that supplier's conversation instead of the Messages list.
The T1 watcher reads change lines, so a Deal change is no longer reported as "nothing".

**The lock sentence.** Main's `lockFreezeLine` is the true one; the test that failed CI
("the couple's voice is gone") asserted the branch's retired sentence and now pins the
card to `lockFreezeLine` plus its behaviour (no "Deal locked" without a booking, a
different sentence for each side of an ask).

~~⚠ Known and NOT changed here: several screens still read the booked total alone.~~
Superseded by the next block — the owner looked on 2026-09-11 and ruled "Show the total
now"; every such screen was changed.

Re-measured in production 2026-09-11 (read-only): 0 change orders · 18 line items over 12
suppliers, all summing to their headline · 0 package anchors · 0 locked deals · 0 locked
threads. No number that exists today moves.

SPEC IMPACT: DECISION_LOG.md — new row: the post-lock Deal records a change beside the
agreed total; the fee base is the agreed total including changes (change orders now move
the fee); the lock sentence is main's `lockFreezeLine`. `Test_Script_Live_Two_Sided_2026-09-10.md`
step 11 names the exact tap and the three numbers to expect.

## 2026-09-11 · feat(budget): one price everywhere — every screen shows the agreed total now

**Owner looked at this PR on 2026-09-11 and ruled two things before merge.** (1) *"Show
the total now"* — every screen other than the budget and the per-supplier page shows the
AGREED TOTAL NOW (₱85,000 in his worked example), derived by the one helper the budget
uses; only those two show the breakdown. (2) *"Yes, fee follows every change"* — already
built by the fee functions in `20271218458148`; untouched here and still pinned (the
guard below checks both fee bodies carry the change lines).

**What now shows ₱85,000 instead of the lock-time ₱100,000** (each through
`agreedTotalNow` = `resolveAgreedTotal`'s own `agreed` on the headline branch — not a
second sum): the event home's Committed figure · the couple's supplier list, plan-budget
roll-up, "remaining budget" and build guard · the date picker's shortlist range · the
per-supplier page's hero price and Costing total (which also draws the change as its own
row, so the sum on screen adds up) · the Decisions "₱X of ₱Y" line on both sides of the
thread · the checklist's committed-per-group · build-from-quotes ranking · the lock-time
downpayment and payment-plan amounts · the flag-OFF budget strip (now routed through the
same helper instead of its own headline+changes sum) · the supplier's My Performance
revenue (monthly + daily), revenue by source and deal size (migration `20271221806689`
re-signs those four functions from the LIVE bodies, one expression each — the fee
functions' change-line subquery; ACL and comments untouched, exposure baseline unmoved).

**How the lines arrive.** In the same query, through the named-FK embed
`CHANGE_LINES_EMBED` (probed against production: resolves; a bare embed can die with
PGRST201), or — where the rows come from a helper another session owns
(`fetchEventVendors`) — one per-page `fetchChangeLinesByVendor` read. Every read checks
`{ error }`; a refusal is logged and the screen falls back to the headline it showed
before.

**The guard** (`lib/agreed-total-and-its-changes.test.ts` § 7): the set of files that
read `total_cost_php` is DERIVED from the code (comments stripped), and each must sit on
exactly one roster — shows the total now (needles and the column counted exactly),
hands the row to a caller that folds first (callers enumerated), or is named as not a
price shown to a person, with the reason. A new reader fails until someone decides. The
latest SQL body of the four supplier figures and the two fee functions must carry the
one change-line form.

⚠ Left in another session's file (routed, not edited): `lib/vendors.ts` (HONEST SHOP) —
`fetchEventVendors` returns the raw headline (both callers that show a price now fold
it), and `computeVendorStats` sums raw headlines but has no caller (the guard fails if
one appears).

SPEC IMPACT: None new — implements the 2026-09-11 DECISION_LOG row "OWNER LOOKED AT
'BOTH NUMBERS AFTER A LOCK' (#5390)", ruling (1); ruling (2) was already built.
