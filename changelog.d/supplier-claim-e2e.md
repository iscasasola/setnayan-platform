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
- **Not changed (owner call, in the PR body):** joining from the link does not by itself give the coordinator
  schedule edit — that is the delegate grant (Event access / coordinator invite, or the auto-invite when a
  booked coordinator's downpayment is marked). Also found: every coordinator gate in SQL/TS keys on the tile
  `'coordinator'` in `vendor_profiles.services`, but shops carry `'planner_coordinator'` (+ a leaf).

SPEC IMPACT: None (bug fix to shipped behaviour; no ruling changed).
