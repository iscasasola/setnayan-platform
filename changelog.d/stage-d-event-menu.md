## 2026-09-29 · feat(menu): Stage D — the event menu is five rows; the phone has one bottom bar

Owner, 2026-09-29: *"so basically. this is what an event needs. Guestlist ·
Your Team · Event Hub Maker · Our Services"* · *"include Setnayan AI (SAI) to our
services"* · *"on mobile mode. we do not want that sub bottom nav anymore. we
want it to be simple and easy to manage"*.

- **One tree, five rows** (`lib/customer-menu.ts` `buildEventMenuSections`):
  Home · Guest list · Your Team · Event Hub Maker · Our Services, on the desktop
  rail, the ☰ drawer and the phone's bottom bar, the same in every phase and
  every event type. The event's name row (Event settings) is unchanged. Seat
  plan stays as ONE interim row until its Details home (evening batch) is on
  main — removing it then is one line (`INTERIM_ROWS`).
- **Where the old rows went — every page still lights its home:** Hosts ·
  Check-in → Guest list (its parts); Budget → Your Team (its part); Schedule ·
  Mood Board · Logo → the Event Hub Maker (Details); Editorial → the Maker's Post
  Event; Papic · Galleries · Live Studio · Patiktok · Music Maker · Setnayan AI →
  Our Services cards; Refer a couple → the account menu (top bar), behind the
  referral programme toggle. Rows claim the pages they hold (`alsoMatch`), so
  the one rail resolver lights the right pillar on `/budget`, `/hosts`,
  `/studio/papic`, `/schedule`, `/galleries`, …
- **The phone has ONE bar.** The section sub-nav / moment strip that docked
  above it is retired (`customer-section-subnav.tsx` deleted); the bar no
  longer swaps tabs by phase (Papic / Check-in / Schedule / Galleries / Review
  tabs retired with their registry slots; `customer.bottom-nav.studio` re-added
  as "Our Services"). Words: Overview → **Home**, Guests → **Guest list** (code
  and registry defaults; keys unchanged).
- **Old URL:** `/dashboard/[id]/monogram` now lands the couple of an Event Hub
  event on Details › Logo (same `detailsIsTheDoor` rule as Schedule and Mood
  Board); a coordinator or a kind with no Event Hub keeps the page.
- **First-visit tour** `customer_event_menu_v1` (shipped MiniTour/TOURS) on the
  event's Home, after the couple welcome.
- **Our Services' tool homes** re-pointed: Budget → Your Team's part; Schedule
  and Mood Board → the Maker's Details (stay on Our Services where there is no
  Maker).
- **Guards:** new `the-phone-has-one-bottom-bar.test.ts` (dock holds only the
  bar; no page in the event tree mounts a second bar; the retired sub-nav stays
  deleted; same five in every phase and on the rail). Rewritten for the five
  rows: `the-event-menu-is-one-tree`, `customer-menu`,
  `the-store-shell-menu-offers-no-refused-door`, `studio-rows-are-lit`,
  `studio-follows-you-in`, `two-levels-and-the-board`, `the-maker-is-one-row`,
  `seat-rooms-need-seating`, `the-phone-forwards-every-gate`,
  `the-phone-bar-is-anchored`, `a-finished-event-tells-the-truth`,
  `one-menu-word-in-all-three-phases`, `the-hub-and-its-controller-are-two-words`,
  `our-services`; `the-strip-does-not-repeat-overview` deleted with the strip;
  `lib/customer-menu.ts` left the Explore-replan flag chokepoint list (the dock
  it gated is retired for every flag value).

SPEC IMPACT: DECISION_LOG.md — "AS BUILT — STAGE D: THE EVENT MENU IS FIVE ROWS;
THE PHONE HAS ONE BOTTOM BAR" row (implements "WHAT AN EVENT NEEDS" and "ON
PHONES, NO SUB BOTTOM NAV").
