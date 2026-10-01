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
  is lazy-loaded on the first tap (shared bundle has no room) and portalled to `<body>` — inside the bottom dock
  a fixed sheet is clipped to the bar. The tab is still a real link to the page for a
  middle-click / no-JS tap (`BottomNavItem.onSelect`, flat bar only).
- **The bar is Home · Guests · Suppliers · Hub · More** (owner 2026-10-01, DECISION_LOG "THE BOTTOM BAR IS
  HOME · GUESTS · SUPPLIERS · HUB · MORE"). Same words on the rail and ☰ (the one phone-only word is "More" for
  the rail's "More Services"). "Your Team" → **Suppliers** (menu, registry, the vendors page masthead/title, the
  finished-event card); "Event Hub Maker" → **Hub** as the menu word (the Maker page keeps its title). The
  couple's floating round "Add guest" button is deleted — nothing floats over the bar; port-control baseline
  regenerated for that deliberate removal.
- **Copy:** the More Services page title, the event-menu tour and the registry defaults follow the new names.
- **Guard:** `app/dashboard/[eventId]/more-services-is-the-one-row-that-opens.test.ts` — exactly one row opens
  (`studio`), its children equal `buildOurServices` order, the layout builds them with that builder, the rail's
  row is an `aria-expanded` button, the phone bar has no sub-rows and its More opens the lazily-loaded chooser.
  Sabotaged once (a second row with children) → test 1 red.
- **Measured (before the rebase onto #6211):** shared 202.0 / 202 KB, Maker 2.2 KB headroom. ⚠ NOT yet
  re-measured on the rebased head — see the PR.
- Stacked on #6202 (`claude/serene-planck-shg2bn`, the five-card order).

SPEC IMPACT: DECISION_LOG — the 2026-09-30 "MORE SERVICES EXPANDS TO THE FIVE" row already records items 1–4;
a follow-on row records the phone refinement (the "More" tab opens a chooser sheet with the five rather than the
page). Applied directly in `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`.
