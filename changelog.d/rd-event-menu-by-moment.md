## 2026-09-24 · feat(nav): the event menu, by moment — one tree for the rail, ☰ and the phone

Owner: *"realign what the sidebar of an event is and the bottom nav and hamburger menu on mobile mode
so everything is easier to access by its flow. like finding the logo maker at the bottom feels so
far."* Binding drawing: `build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`.

**Acceptance, measured on the built tree (wedding · planning · desktop rail): Logo Maker moved from
row 26 of 27 (+11 behind "Show more") to row 9 of 21, directly under Mood Board.** Pinned by
`lib/the-event-menu-is-one-tree.test.ts`.

### One tree, not three

`lib/customer-menu.ts` `buildEventMenuSections` is now THE event menu. `buildCustomerNavGroups`
(rail + ☰) is its projection, `buildCustomerMenuTree` (phone bar) picks its five tabs out of it by
key, and the phone's new moment strip is one of its sections. The shell no longer draws
"Browse by category" (removed) or a Studio group inside an event (dissolved — products are rows).

```
(name row) Details
           Overview · Papic ✦ · Galleries (· Editorial after)
BOOK       Your Team · Budget
LOOK       Mood Board ✦ · Logo Maker ✦ · Pakanta ✦
INVITE     Guests · Hosts · Event Hub Controller
THE DAY    Schedule · Check-in (day-of) · Seat plan · 3D Plan ✦ · Live Studio ✦ · Patiktok ✦
           Setnayan AI ✦ · Suite · Refer a couple
phone      plan  Overview · Papic · Your Team · Guests · Event Hub Controller
           dayof Overview · Papic · Check-in · Event Hub Controller · Schedule
           after Overview · Papic · Galleries · Your Team · Event Hub Controller
```

- Product rows arrive as PLAIN DATA (`key · href · name`) from `railToolsSignedIn({eventId, count: 1,
  profile})` in `layout.tsx`; icons are resolved on the client side from a name map. No component
  crosses the server→client boundary (the 2026-09-23 outage shape).
- Every key kept. New `customer.bottom-nav.papic` slot; retired `customer.bottom-nav.seats`,
  `customer.bottom-nav.studio` and the five `customer.studio-subnav.*` slots (their surfaces are
  gone). `now` → "Overview", `review` → "Your Team".
- Seat plan is gated on `seatingEnabled` on the rail too (it only gated the day-of tab before).
- ⚠ Behaviour change surfaced: the day-of/after bars' Event Hub Controller tab is now gated on the
  website surface like the rail's always was (every code profile enables `website`).
- Moment strip: phone only (`<SubNav>` is `lg:hidden`), stands aside on the Your Team root where
  `team-summary-chip.tsx` already docks in that slot.
- House style (DESIGN-LANGUAGE-AMENDMENT): event-menu rows and strip chips get a transition +
  press scale-down; the dock drops its hairline border (glass + shadow). No new containers.
- Zero new `"use server"` exports.

Guards updated to the rulings (none weakened): `customer-menu`, `studio-follows-you-in`,
`studio-rows-are-lit`, `front-door-invariants`, `the-rail-moves`, `rail-icons-are-icons`,
`one-shell-event-rail`, `two-levels-and-the-board`, `a-finished-event-shows-its-summary`,
`seat-rooms-need-seating`, `env-flag`.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — new 2026-09-24 row recording the
six owner rulings (Browse by category removed in-event · Papic is the spine · Studio heading dissolved,
superseding the FORM of the 2026-08-21 ruling · Papic replaces Suite/Seats tabs · Personalization →
Details + one word per page · one structure for every event type). Appended, not committed (corpus is a
separate repo).
