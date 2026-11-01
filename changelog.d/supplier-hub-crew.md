## 2026-10-29 · feat(supplier-hub): Crew QR — crew join the supplier's Event Hub by QR and see only the Event Hub

Owner, 29 Oct, verbatim: *"they can create a qr code and the phone of their crew can scan it to launch the event hub.
since they are just crew, they do not need to see today, customers and shop and the settings of their event hub"*
(DECISION_LOG 2026-10-29 "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE ONLY THE EVENT HUB"; prototype `hubCrew`).
Builder S6, slice 3 of 3 — stacked on the Hub set-up slice.

- **Migration** `…_crew_join_the_suppliers_event_hub_by_qr.sql` (RLS at CREATE TABLE):
  - `vendor_crew_codes` — ONE crew QR per (shop, event); only the shop's admins, only on an event the shop is booked on;
    its end is DERIVED by trigger from the event (the midnight after its last day, Manila) — a client cannot stretch
    it; it cannot be moved to another shop or event.
  - `vendor_crew_passes` — one pass per phone; written only by `crew_pass_request` (SECURITY DEFINER), so a new phone
    always WAITS; the shop's admins Allow / set Member · Helper / remove (who decided is stamped); who / where / when
    never moves (a trigger raises); turning the QR off ends every pass under it.
  - `current_vendor_crew_pass(event)` — the caller's own pass and whether it opens anything now (allowed, before its
    end, the shop still booked). `crew_seat_by_guest_qr(event, token)` — the crew's scanner: the coordinator scanner's
    gates asked of the shop and the QR's issuer, plus an effective pass; one table label, nothing else.
    `moderator_area_level_of` — the shipped hosts' rule asked of a named person (callable by nobody).
  - A crew pass is read by NO existing policy and writes no grant, membership or moderator row: a crew phone reads
    nothing but its own pass.
- **Hub › Crew** (`crew-panel.tsx`, `lib/crew-writes.ts`) — "Crew for the day": each phone with its state and role ▾
  (Member · Helper · Remove), **Allow** on a waiting one, the removed ones with "Let back in"; the crew QR with Share ·
  Save · Show, and More ▾ (Replace the QR · Turn it off). For the shop's owner and admins only. The writes are plain
  table writes on the caller's own session — NO new server action (the route budget sits at its ceiling); the
  database is the whole boundary.
- **The crew phone** — `/join/crew/[token]`, outside the supplier dashboard: the name the shop calls them (a call name
  for one day's crew — not a guest's five-part name), asked in the browser through `crew_pass_request`
  (`lib/crew-join-client.ts` — no server action; the captcha token is minted on the same tap; an anonymous account when
  `NEXT_PUBLIC_CREW_PASS_ANON_ENABLED` is on — OFF by default; else sign in and come back), then "Waiting for the Allow"
  (re-asks every 15 s while looked at), then THE CREW'S EVENT HUB: this event only — the scanner (the shipped
  `SeatScanner` through the shipped `floorSeatByQr(…, 'crew')`), and for a Member the run of show. Read with the admin
  client only after the database said the pass is effective AND the shop's booking-fee gate is open (the shop's gate,
  as for its day-of grantees), each read scoped to that one event.
- RA 10173: the crew member's own passes join the personal-data export (`crew_passes`); erasure classifies the new
  columns (the pass is deleted with its person; the issuer / decider stamps are nulled — the triggers let a stamp go to
  NULL so an account can always be erased, proven in the DB test).
- Lab: `/dev/supplier-lab?s=hub&seg=crew&shell=1` and `/dev/supplier-lab?s=crew-phone&state=name|waiting|member|helper|ended`.

Guards: `tests/db/crew-pass-sees-only-its-event.db.test.ts` (11 — as the crew, the admin, another shop and anon;
sabotage seen red: a crew own-read widened to `true`, a waiting pass counted as effective) ·
`app/join/crew/the-crew-sees-only-the-event-hub.test.ts`.

Also: the two trigger functions are revoked from every role (a trigger needs no EXECUTE); the exposure baseline, the
FK-behaviour map, the data-subject register (crew under "vendors"), the schedule-time and dashboard-root registers
carry the new surface, each line read.

**Review fixes (2026-10-30):**
- 🔒 **Leak closed.** A Member's run of show was read on the admin client with no visibility filter, so a crew phone
  saw the coordinator's unreleased prep (`visibility = 'coordinator_only'`) — more than the shop itself may read. It now
  goes through `onlyWhatABookedShopMaySee` (`lib/schedule.ts`), the app copy of `event_schedule_blocks_booked_vendor_read`
  — exactly that policy and nothing more (it has no branch for a coordinator shop: staged rows are read through the
  coordinator's own moderator seat, a person, so neither does the crew). Pinned row for row against the policy through
  the shop owner's real session (crew db test 10: visibility × is_public × audience), and at the page (unit test 5).
- 🚪 **A door that never opens is not drawn.** The scanner's door refuses every shop that is not the coordinator trade,
  so a non-coordinator shop's crew no longer get a scanner that always answers "Finding seats is for the coordinator's
  crew": the crew phone says what the pass DOES give instead, and the role words follow (Helper · "day and place only",
  Member · "run of show") on the phone, the supplier's crew rows, the role ▾ hints and the ⓘ. The shop's trade is
  `isCoordinatorTrade(vendor_profiles.services)`; a refused shop read keeps the scanner (its door is the boundary).
  Unit test 6; lab `?s=crew-phone&state=helper-shop`.
- The crew row's line wraps instead of truncating ("Wants to join · Helpe…" at 390 px).

SPEC IMPACT: None — builds the approved 2026-10-29 ruling and the controller's five calls recorded with it. Owner
action, surfaced: anonymous crew joining stays OFF until `NEXT_PUBLIC_CREW_PASS_ANON_ENABLED` is set in Vercel AND
anonymous sign-ins are enabled in Supabase Auth.
