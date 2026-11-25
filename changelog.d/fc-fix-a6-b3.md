## 2026-11-25 · fix(supplier): final check area 6, batch 3: Clients, the chat list and the client's sub-pages say a failed read

Lane A fixes from the 25 Nov final check (area 6). No look change, no amount, fee or rule changed.

- **Clients › Money (A6-31).** An incomplete bookings read makes Log a payment say "We couldn't load your booked customers right now.", never "No booked customer yet".
- **Clients › Events (A6-35).** When the month's read falls short (the tile already says couldn't load), the list says "We couldn't load this month's bookings right now." instead of "No events booked this month."; a refused branches read is logged and named on the row, never every client grouped under "Main".
- **Clients › Dates, one day (A6-36).** The day sheet reads the honest twins (`fetchVendorPoolsOrNull`, `fetchVendorPoolBookingsDetailed`, `fetchVendorWaitlistRead`): a refused or short read answers "Couldn't read" (`DAY_UNREAD_ANSWER`) and says the waiting list did not load, never an open day with 0 waiting.
- **The chat list (A6-13).** When the archive state does not load, the list is reported incomplete (the Chats page then says part of it could not load), never archived chats quietly back among the active ones.
- **Editorial media (A6-54).** A refused eligibility read says "We couldn't read whether you can add to their story right now.", never "Not available for this event yet". `getEditorialEligibility` carries `unread`; the submit gate still refuses on it.
- **Mood board and Their event (A6-55, A6-56).** Only the RPCs' own refusals (42501, P0002) leave the page; any other error says the page could not load. A refused Hub address read is said, never "The hosts have not published their Hub yet." (A6-56's wording half, "Hub" → "Event Hub", is not done: the owner ruled on 5 Nov that suppliers never read "Event Hub", held by `suppliers-read-hub-not-event-hub.test.ts`.)
- **Second pass (Add 11).** The supplier Schedule tab, the locks section and the chat's "what is agreed" no longer tell a person to "pull to refresh": the app turns that gesture off (`overscroll-behavior: none`). They say "Nothing is lost — try again in a moment."
- **Guard:** `app/vendor-dashboard/area-6-hub-reads-say-when-they-fail.test.ts`. Existing pins kept. Server actions: no new export. No migration.

SPEC IMPACT: None. Honest-state and word fixes against CLAUDE.md §5 rule 4 and docs/brand.md; no product decision changed.
