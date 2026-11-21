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
