## 2026-10-19 · fix(claim): a supplier who joins from the couple's link gets a shop with a name and a category

The owner's coordinator flow — Suppliers → Add your own → Invite → share link → the coordinator signs up —
walked end to end in SQL for the first time (`apps/web/tests/db/a-supplier-joins-from-the-couples-link.db.test.ts`).

- **Bug found and fixed:** `/signup?as=vendor` makes the account a vendor, and the `handle_new_vendor_user`
  trigger opens an EMPTY shop the same instant. The finalize page then found "a shop", took its
  already-has-a-shop branch, and wrote nothing — every supplier who joined from a couple's link arrived with
  no shop name and no service. New `claim_ready_the_shop(user, token)` (migration 20271280303462, service
  role only) finds or opens the shop, fills ONLY its blank name/service from the couple's record, and makes
  sure it has its admin seat. The finalize page calls it for couple-made links.
- **Second person on a used link:** finalize used to drop them on `/vendor-dashboard` with an empty shop;
  it now says "This link was already used." (the claimant themselves still goes to their dashboard).
- Test pins: the host's own RLS can add the supplier and make the link; the link is claimed once; a second
  person is refused (finalize + `claim_link_record_to_shop`); the supplier sees THIS event among customers
  (accepted, unlocked) and not another couple's; a booked non-coordinator supplier cannot edit or delete the
  couple's schedule items; with the coordinator grant the coordinator adds/edits/deletes any item.
- **Bug found and fixed — the coordinator trade has three names, one answer.** Every day-of coordinator gate
  asked `vendor_profiles.services` for the tile key `'coordinator'`, which no shop writer puts there (shops
  carry `'planner_coordinator'` + a canonical leaf). So the day-of requests inbox, "only the coordinator
  advances", find-my-seat, the floor command, the clients-page coordinator view and the day-of console kind
  were closed to every real coordinator. One list — `COORDINATOR_TRADE_SERVICES` / `isCoordinatorTrade`
  (`lib/coordinator-trade.ts`) and its SQL copy `services_make_a_coordinator()` (same migration), now used by
  `current_coordinator_booked_event_ids()` and `coordinator_seat_by_guest_qr()`. Guard
  `lib/coordinator-trade-is-one-list.test.ts` (TS = taxonomy = SQL; no gate tests the bare tile).
- **Not changed (owner call, in the PR body):** joining from the link does not by itself give the coordinator
  schedule edit or colour lanes — those are the delegate grant (Event access / coordinator invite, or the
  auto-invite when a booked coordinator's downpayment is marked; booking needs the shop verified). The
  mood-board library/suggestion shelves match canonical LEAVES only, so a claimed shop holding just its
  couple category (any trade) is outside them until it picks a leaf.

SPEC IMPACT: None (bug fix to shipped behaviour; no ruling changed).
