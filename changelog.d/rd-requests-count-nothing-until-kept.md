## 2026-09-27 · fix(guests): a request counts for nothing until Keep or Link

Owner, 2026-09-27, verbatim: *"no. only count when accepted."* A guest row
with `entry_source = 'self_added_unlisted'` (somebody who asked to join, or who
added themselves before 2026-09-27) now waits in Guest List → Requests and is
left out of everything that COUNTS, SEATS or PRINTS until the couple presses
Keep (→ `host_seeded`) or Link. Nothing is deleted — a read-side exclusion.

- **One rule, one name:** `REQUEST_ENTRY_SOURCE` / `countsTowardEvent` in
  `apps/web/lib/guests.ts`. `fetchGuestsByEvent(Measured)` now reads the
  ACCEPTED list by default — which covers the seat reconcile (no provisional
  seat), the seating planners, the caterer export, prints, the dashboards and
  the launch page in one place; only the guest roster opts in to draw requests
  as their own rows. `computeGuestStats` and `countGuestsByEvent` skip them.
- **Direct readers:** the live headcount behind final pax and every supplier
  price (`lib/pax.ts`), Papic Limited's per-guest price and camera hand-out,
  printed passes, the door list, the souvenir table, the 3D plan counts, the
  after-summary, the recap, the story's guest counts, the Papic magazine, the
  roadmap/checklist "you have guests" signals, and the reach probe's truth.
- **SQL readers** (migration `20271249183421`, bodies copied verbatim from
  their latest definitions with one predicate added to each of 9 guest reads):
  `get_vendor_catering_metrics`, `get_vendor_event_brief`,
  `get_vendor_seat_plan`, `papic_event_guest_headcount`.
- **Deliberately unchanged:** FaceBlock / photo-consent counts (a request's
  privacy wish is still honoured), soft-delete counts, admin analytics, the
  sponsor-weight sum in `papic_guest_spend_ceiling` (a request's weight adds 0).

**What changes on live data (read from prod 2026-09-27):** one event has
requests — cale-ice, 2 rows, both attending, no seat, no linked account.
Attending 4 → 2 · pending 77 → 77 · on the list 81 → 79. Headcount basis is
`attending` against an estimate of 230, so the live pax stays 230 (the estimate
is the larger number); no final pax is locked.

**Also — "Only my Guest List" has no ask-to-join anywhere (owner ruling
2026-09-27).** The couple's poster QR (`/join/{eventId}?token=…`) no longer
opens the request form just because its token is valid: on such an event the
page redirects to the event (`/{slug}`, whose door is Sign in or Upload your
QR), and both join actions refuse with `GUEST_LIST_ONLY`, which
`selfJoinRefusalPath` sends to the same page. Only "Anyone, I approve" shows the
request form. `lib/join-throttle-adoption.test.ts` now anchors its "door before
throttle" ordering on that check, since the token no longer gates anything.

Held by `apps/web/lib/a-request-counts-for-nothing.test.ts`,
`app/join/[eventId]/the-signed-in-guest-lands-on-the-event.test.ts` (§3) and
`apps/web/tests/db/a-request-counts-for-nothing.db.test.ts`. Server actions: +0.

SPEC IMPACT: None — implements the owner's 2026-09-27 answer as given.
