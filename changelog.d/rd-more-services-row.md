## 2026-09-30 · feat(menu): "More Services" — the one sidebar row that opens · the phone's "More" opens a chooser

- **The rail row "Our Services" is now "More Services" and opens to its five** — Setnayan AI · Papic · Live
  Studio · Music Maker · Patiktok (owner 2026-09-30: *"the sidebar will expand and collapse to show these"*;
  *"it cannot be our services since we have the guestlist, your team and event hub maker on the sidebar which is
  also our services"*). Tapping the row only expands/collapses it (no navigation); open/closed is remembered on
  the device (`localStorage`, in try/catch). The five are the SAME `buildOurServices` cards the page draws,
  built server-side in the event layout (`ourServicesMenuChildren`) and passed as plain data — the add-on
  catalogue never enters a client bundle. Same in the ☰ drawer. Menu key stays `studio`.
- **Every other row stays a plain leaf** — this row is the owner's one exception to the 2026-07-15 "no submenus"
  lock (`event-rail-context.tsx` header updated).
- **Phone:** the bottom bar says **"More"** and stays flat — no sub-rows. Tapping it opens a small bottom sheet
  (the shared `<Sheet>`) with the five and their icons; tap outside, ✕, Esc or a swipe down closes it. The sheet
  is lazy-loaded on the first tap (shared bundle has no room). The tab is still a real link to the page for a
  middle-click / no-JS tap (`BottomNavItem.onSelect`, flat bar only).
- **Copy:** page title/masthead, the finished-event card, the event-menu tour and the registry defaults
  (`customer.sidebar.studio` "More Services", `customer.bottom-nav.studio` "More") follow the new name.
- **Guard:** `app/dashboard/[eventId]/more-services-is-the-one-row-that-opens.test.ts` — exactly one row opens
  (`studio`), its children equal `buildOurServices` order, the layout builds them with that builder, the rail's
  row is an `aria-expanded` button, the phone bar has no sub-rows and its More opens the lazily-loaded chooser.
  Sabotaged once (a second row with children) → test 1 red.
- Stacked on #6202 (`claude/serene-planck-shg2bn`, the five-card order).

SPEC IMPACT: DECISION_LOG — the 2026-09-30 "MORE SERVICES EXPANDS TO THE FIVE" row already records items 1–4;
a follow-on row records the phone refinement (the "More" tab opens a chooser sheet with the five rather than the
page). Applied directly in `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`.
