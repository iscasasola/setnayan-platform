## 2026-09-29 · feat(discover): your people's public events, then the world, then people to follow

Implements the four 2026-09-29 Discover rows ("PUBLIC EVENTS CAN BE DISCOVERED",
"DISCOVER IS THE DOOR TO THE WHOLE SETNAYAN UNIVERSE", "DISCOVER — UNPARKED",
"DISCOVER BUILD — TWO LAST ANSWERS") on the `/` feed, built to
`prototypes/discover_upcoming_2026-09-29.html`.

Discover now reads, top to bottom:

1. **Upcoming from people you follow** (signed in only). Upcoming public events
   hosted (`event_members.member_type = 'couple'`) by someone the viewer follows
   (`user_follows`, read under their own session, scoped to them) or is
   connected to (`confirmedConnectionUserIds`, now exported from
   `lib/your-people.ts`). Soonest first.
2. **Upcoming on Setnayan** — every other upcoming public event. Signed-out
   visitors see it too. Soonest first, the viewer's region first (the region of
   their most recent event membership; no region or signed out → soonest only).
3. Shops (unchanged).
4. **People to follow** — public profiles, most followed first, never the viewer,
   never someone they follow or deliberately unfollowed. Follow uses the People
   page's shipped `setFollowByPublicId` (public handle only, no user id in the
   browser).
5. New uploads + Trending (unchanged).

The allow-list (both event shelves) lives in the pure
`lib/discover-events-core.ts`: `listablePublicly(resolveEffectiveVisibility(e))`
(only `public`), not archived, has a slug, has a date, not finished by the
Manila day (`isFinishedEvent` + `manilaTodayISO`), not an event the viewer is
already in — after the shared `filterPubliclyVisibleEvents` gate. The I/O is in
`lib/discover-events.ts`. A card opens `/{slug}`; its one action is **Ask to
join** (`/join/{eventId}`) only when the host chose "Anyone, I approve",
otherwise "Guest list only". Only a host with a public profile is ever named.

A failed read renders "couldn't load", never "no events" (the reads-are-honest
pattern). First-visit tour `discover_upcoming_v1` through the shipped MiniTour.
Tests: `lib/discover-events.test.ts` (25), sabotage-probed.

Not built here: the "Requested" card state (needs the viewer's own pending
request read) and the approved-count line — named for a follow-up.

SPEC IMPACT: `DECISION_LOG.md` — one AS BUILT row for the Discover build
(dateless public events are not listed on an "Upcoming" shelf; the tour drops
the prototype's "you'll hear by email", retired by the same day's NO EMAIL TO
GUESTS ruling).
