## 2026-11-21 · feat(coordinator): the booked coordinator gets the hosts' dashboard, minus Memories and paying

Owner rulings of 21 Nov 2026 (DECISION_LOG "A BOOKED COORDINATOR OPENS EVERYTHING EXCEPT MEDIA FILES AND PAYMENTS" ·
"BOOKED COORDINATOR — WHAT THEY MAY EDIT VS ONLY VIEW" · "BOOKED COORDINATOR ON BUILD: FIND + RECOMMEND + SHORTLIST, NO
BOOKING, NO PAYING" · "COORDINATOR: DUE PAYMENTS VIEWABLE + 'REMIND THE HOSTS', NOT LOGGABLE; ACCESS IS AUTOMATIC"),
built on the approved drawing `prototypes/their_event_door_2026-11-21/their_event_door_fable.html` (coordinator frames).
PR 1 of 2; PR 2 is the "Their event" link list for every other booked supplier.

- **The grant** (`COORDINATOR_AREAS`, `lib/delegate-areas.ts`): Guests · Seats · Schedule (March inside it) · Suppliers ·
  Event Hub · Mood Board at Edit; **Budget** and **Payments** at View; Memories (`photos`) shut. "Budget & payments" splits
  into **Budget** and **Payments** (new area `payments`, View · Off, never Edit).
- **Only a host books or pays** (`lib/coordinator-money-scope.ts`): the rule is now "a `couple` member" — no opt-in
  scope, no default-INACTIVE control in front of it. Every book / pay / log door already asked it (finalize, deposit,
  orders, checkout, `/pay/[reference]`, in-app purchase); `updateVendorStatus` now asks it too before a flip INTO booked,
  which a coordinator's `event_vendors_moderator_write` would otherwise allow. The hosts' consent sheet loses its two
  money opt-ins; `wedding_planner_external`'s template carries `checkout: false`.
- **Payments: view + "Remind the hosts"**: the Budget page shows a non-host whose seat opens Payments a "Payments due"
  list (one row per supplier, `pickDuePayments`) with **Remind the hosts** — a browser call to the new definer
  `remind_the_hosts_of_a_payment` (no server action): in-app notice to every host, once per seat per supplier a day,
  logs nothing, pays nothing. New notification type `coordinator_reminded_payment` (in-app only, Low).
- **Memories shut**: the Memories page returns "The hosts keep this" for a delegate whose seat does not open Photos —
  before a single frame is read; `memoriesManagerRoleOf` no longer admits a coordinator (tagging, pool moderation and
  the Memories rules refuse them on the server). The hosts can never raise Photos, or Budget / Payments past View, on a
  coordinator's seat (`coordinatorSeatRefusal` in `setDelegateArea`).
- **Suppliers**: the coordinator's cards draw no Book / Pay / Cancel ("Book this build" too); the page opens with
  "Help the hosts choose. They book and pay." — Find · Recommend a partner · Add to the shortlist · Booking and paying:
  "The hosts keep this".
- **Automatic on booking; Limited · Full retires**: a booked coordinator SHOP's owner gets an ACCEPTED seat with the
  ruled grant (a pending invite for them is activated; a live seat is never rewritten); a coordinator not on Setnayan
  still gets the emailed invite. Home's Limited · Full ask and People with access' level pick are removed; the hosts keep
  ONE switch (Off = lowest level of every part, On = the ruled grant).
- **Events you run**: each row has three buttons — Dashboard · Chats · Hub.
- **Migrations (need controller GO, never applied by hand)**: `20271356585725_coordinator_reminded_payment_enum.sql`
  (enum value) · `20271357113669_the_booked_coordinator_is_automatic.sql` (retires answered Limited/Full seats — Full →
  the ruled grant on the coordinator's own seat, Limited → Off; upgrades a booked coordinator's untouched old-default
  seat to the ruled grant; adds `remind_the_hosts_of_a_payment`; re-creates `ask_hosts_for_more_access` with the split
  part names). DATA-CHANGING on prod: it rewrites `event_moderators` rows carrying `access_level`.
- Guards: `lib/only-a-host-books-or-pays.test.ts` · `lib/the-booked-coordinator-has-the-hosts-dashboard.test.ts` ·
  `tests/db/the-coordinator-reminds-and-never-pays.db.test.ts` (each sabotage-checked).
- Lab: `/dev/booked-coordinator-lab`.

⚠ **NOT IN THIS PR — said, not hidden:** Event Hub and Event Details are in the ruled Edit list, but their writes are
still host-only (the `events` UPDATE policy `couple_can_update_event`, `event_site_drafts_host_all`, and the couple
checks in the `website/*` actions). Before this PR a coordinator reached them only through the retired FULL (co-host)
seat — which also opened Memories and paying. So a coordinator now opens Hub and Event Details and their saves are
refused by the database, as they already were for every coordinator who never got "Full". Admitting the booked
coordinator to those writes is its own change (a policy on `events`). Also not built: the due-payment CARD inside the
coordinator's chat (frame 2) — the due list lives on Budget; and "Recommend a partner" is a row of words (the partner
flow is its own drawing).

SPEC IMPACT: None new — implements the 2026-11-21 DECISION_LOG rows above. Open for the owner/controller: Hub + Event
Details write access for the booked coordinator (see ⚠ above).

## 2026-11-22 · fix(coordinator): ship-review fixes for #8094

- **Only a host books, at the database.** A new trigger on `event_vendors` refuses a browser writer who is not a host moving a supplier into booked, by UPDATE or INSERT (`ONLY_A_HOST_BOOKS`). Moving a booked row along stays allowed.
- **A cancelled coordinator booking closes its seat.** The seat a booking opens now carries the booking (`event_moderators.opened_by_event_vendor_id`). When that booking leaves booked or is deleted, the database closes that seat and only that one; a seat a host added by hand stays. Booking again brings the closed seat back with the ruled grant.
- **One rule for "a coordinator".** The automatic grant asks `bookingIsACoordinators`, which reads the shop's services exactly as the database does, not the couple's category alone.
- **Maya is a pay door.** "Pay with card or Maya" refuses a non-host in the same words as the proof form (`ONLY_A_HOST_PAYS`).
- The two migrations with `SET LOCAL lock_timeout` now run inside `BEGIN; … COMMIT;`.

SPEC IMPACT: None. These enforce the 21 Nov rulings "BOOKED COORDINATOR — WHAT THEY MAY EDIT VS ONLY VIEW" and "BOOKED COORDINATOR ON BUILD: FIND + RECOMMEND + SHORTLIST, NO BOOKING, NO PAYING".

## 2026-11-22 · fix(coordinator): ship-review fix pass for #8094 (who reads a booking's guest group · every booking door opens the seat)

- **Who reads a booking's guest group.** `supplier_booking_group` (migration `20271357741892`, edited in place — not applied in production) let every team member of the booked shop read the group, a paused seat included. Owner 2026-08-27: "the staff who handles the event will handle the event fully but the vendor owner also has access to oversight all their business". The readers are now only: the shop's owner; a live Shop Manager (the repo's own helper `current_vendor_duty_ids('shop_manager')`); and the live seat that handles this client, by #8114's routing (`chat_threads.covering_member_id` while the handler is paused, else `handled_by_member_id`, the same rule as `currentHandlerOf`). Live means `vendor_team_members.deactivated_at IS NULL`. Anybody else on the team is answered `not_your_client` and told so on the "Their event" list and the Guests page, never "the hosts have not filled it yet". The rule is written once in the function. The same live-seat check is added to the team-member test in section 2 of `20271357113669`.
- **Access is automatic on booking, at every door.** The coordinator's seat was opened from one action (`updateVendorStatus`, on the move into downpaid), so a coordinator booked any other way got none. One shared server function, `openTheCoordinatorsSeatForBooking` (`lib/coordinator-grant.ts`), now reads the booking fresh, does nothing unless it is booked (contracted, deposit paid, delivered, complete) and a coordinator's, and opens the seat stamped with the booking. It is idempotent and never throws into the booking write. One line calls it from every path that books: `updateVendorStatus`, `finalizeVendor`, `recordDeposit`, the supplier's yes (`vendorAgreeToLock`), the booked-QR claim, `lockPackage`, the wizard's two picks, the chat's Book (`lockDeal`) and the couple's approval of a supplier from their link. `autoInviteCoordinator` is no longer exported, so it cannot gain a second call site. No new server action.
- Guards: `tests/db/a-booking-group-is-the-suppliers-one-group.db.test.ts` test 4 (seven sabotages run, each red) · `lib/the-coordinators-seat-follows-the-booking.test.ts` tests 2 to 5 (a door that stops calling the function, a second call site, and a new file that books without being a door each turn it red) · `lib/their-event.test.ts` test 3 · `lib/only-a-host-books-or-pays.test.ts` now lists main's pay-page code box.
- Merge of `main`: the chat ＋ keeps main's final tray; "Ask for access" stays off it (DECISION_LOG 21 Nov, the row after "CHAT ＋ FINAL").

SPEC IMPACT: None. Enforces the owner's 2026-08-27 staff/owner ruling and the 2026-11-21 "ACCESS IS AUTOMATIC" row, per the controller's rulings of 22 Nov.

- **Controller rulings, 22 Nov 2026.** (a) The seat opens at the supplier's yes even while the booking fee is unpaid; no new fee gate (unchanged code). (b) A seat made when the hosts approve a supplier's claim (`answer_claim_access_request`) is their own answer: hand-added, no `opened_by_event_vendor_id` stamp, so cancelling that booking never closes it (`hostsOwnAnswer` on `openTheCoordinatorsSeatForBooking`, guarded in `the-coordinators-seat-follows-the-booking.test.ts`). No migration changed.

**Ship controller (22 Nov, controller-approved):** migration `20271359080029_a_suppliers_own_item_goes_in_at_once.sql` — #8080's record guard (`schedule_request_auto_accept_guard`) now also allows a shop's `adjust` of a moment whose `responsible_vendor_ids` hold that shop's own booking on the event (`editsOwnItem` exactly), so the own-item edit is no longer refused by the database while Auto-agree is off. Held by `tests/db/a-suppliers-own-item-goes-in-at-once.db.test.ts` (both ways; sabotage-checked).
