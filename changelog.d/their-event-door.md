## 2026-11-21 · feat(suppliers): the "Their event" door — every other booked supplier gets a list of links to their parts

Owner rulings of 21 Nov 2026 (DECISION_LOG "'THEIR EVENT' DOOR SHAPE + SCHEDULE RULE" — *"Coordinators see the
dashboard · Suppliers see lists of links for different parts of the dashboard."* — "WHAT EACH BOOKED SUPPLIER OPENS BY
DEFAULT", "THE EVENT'S MONOGRAM IS AN EASY DOWNLOAD FOR EVERY BOOKED SUPPLIER", "NO 'ASK FOR ACCESS' TILE ON THE CHAT ＋",
"'YES TO ALL'" (1) and (5), controller calls (3) cap and (6) names), built on the approved drawing
`prototypes/their_event_door_2026-11-21/their_event_door_fable.html`. PR 2 of 2, stacked on PR 1 (booked coordinator).

- **The list** (`lib/their-event.ts` · `TheirEventList`): a booked supplier who is not the coordinator sees "Their event"
  on the customer page (overview) and above the chat with the hosts — Schedule ("See all · edit your items") · Logo (a
  plain download of the event's monogram, no switch) · Numbers · then the trade's own parts; last row **Ask for access
  to more** (the shipped Ask the host for access, now anchored `#ask-access`). Defaults per trade exactly as the owner's
  table (caterer: Guests one group + Seats · venue: + Mood Board · stylist: Mood Board + Guests + Seats · hair & makeup:
  Guests · florist / decor / lights & sound: Mood Board + Seats · photo & video: Mood Board + Guests · emcee / band / DJ
  and cake / transport: nothing extra · invitations: Guests + Hub). A part the hosts add through the supplier's seat
  joins the list; Edit reads "Propose" (a supplier never writes). A part the server would refuse (Seats off the
  seat-plan floor list) is never drawn.
- **One part, alone**: a tap opens that part with "Their event · names · ✕ Close" on top and no tab bar — new route
  `/vendor-dashboard/clients/[eventId]/their-event/[part]` (Schedule · Numbers · Guests · Hub), and the shipped
  `/seat-plan` and `/mood-board` pages with `?door=their-event`. The route checks the brief, BOOKED, not the coordinator
  (→ the hosts' dashboard), and that the part is on this supplier's list — else it says so and offers Ask for more.
- **Booking groups** (migration): a per-head booking (`event_vendor_counts_per_head`) that becomes booked makes its own
  guest group named for the supplier (`guest_groups.event_vendor_id`, one per booking, never taking over a group the hosts
  named the same) — by trigger, so every booking path does it. The supplier reads ONLY that group through
  `supplier_booking_group` (names, reply, dietary note — no other group, no contact details); its live count shows in
  Numbers beside the booked count (`pax_quote_base`) with the drift said, never re-priced.
- **The cap** (migration + `seatAreaLevel`): a supplier's seat never opens Payments or Memories, whatever its map says;
  Budget at most View.
- **Schedule — their own items apply at once**: a supplier's change to a moment attributed to their booking
  (`responsible_vendor_ids`, kind `adjust`) applies straight away through the one accept path, whatever the event's
  Auto-agree switch; the hosts are told (the shipped notice). Anything else still waits.
- **Ask for access left the chat ＋** (`supplierPlusRows`).
- **One set of names**: `DELEGATE_AREA_LABEL` now reads the hosts' tab names — Guests · Seats · Schedule · Suppliers ·
  Hub · Mood Board · Budget · Payments · Memories; the ask door's words follow (re-created in the migration).
- **Migration (needs controller GO, never applied by hand)**: `20271357741892_the_their_event_door.sql` — re-creates
  `moderator_area_level` / `_of` with the cap; `guest_groups.event_vendor_id` + unique index; trigger
  `booking_makes_its_guest_group` on `event_vendors` (`lock_timeout 5s`); `supplier_booking_group`; re-creates
  `ask_hosts_for_more_access`. No data rewritten; groups are made only on the next booking-status write.
- Guards: `lib/their-event.test.ts` · `tests/db/a-booking-group-is-the-suppliers-one-group.db.test.ts` (sabotage-checked).
- Lab: `/dev/their-event-lab`.

⚠ **NOT IN THIS PR — said, not hidden:** the hosts' per-supplier screen ("Suppliers · access": switch a link off, Add a
part, Share a PDF) and so **Files from the hosts**; picking a group for a supplier whose booking is not per head
(photo & video's family/VIP group shows "the hosts have not filled it yet" until then); the **Undo** on the hosts'
notice for a supplier's own-item schedule edit (the notice opens the Schedule, where the host changes it back);
**"Closed by the hosts"** on waiting changes when a part is shut (Take it back is the shipped withdraw); emcee / band /
DJ editing the script & songs (their Schedule items are covered by the own-item rule).

SPEC IMPACT: None new — implements the 2026-11-21 DECISION_LOG rows above; the not-built list above is open work.
