## 2026-09-25 · fix(nav): the phone bar is anchored, never leaves a gap, and the moment strip docks to it

Owner, testing the iOS app: *"the bottom nav is not fixed."* Reproduced in the
simulator (store shell, a couple's event, 390–440pt): four problems, plus five
more from the same tour.

- **Blank slot in the bar** (`Overview · [ ] · Your Team …`). Root cause: the
  Papic tab opens `/studio/papic`, which `lib/store-shell.ts` refuses. The menu
  still built the tab; `StoreShellLinkGuard` hid its `<a>` after paint and left
  its `<li>` holding a grid column. Now ONE roster filter —
  `storeShellRefusesMenuRow` in `lib/customer-menu.ts`, reading the same
  `isStoreShellWebOnlyPath` middleware uses — drops every refused row from the
  one tree the rail, ☰ drawer, moment strip and bar all read. The layout asks
  `isStoreShellRequest()` once, server-side, so the first paint is right; the
  remaining tabs re-spread. `barItemsForShell` in `<BottomNav>` is the net for a
  doorway that forgets (vendor/admin). The same cause put "Setnayan AI" in the
  Suite's strip, landing on "Not available in the app" — gone too.
- **Papic stays hidden in the app.** Its page sells Papic credits, and a
  web-bought Pool working in the app is guideline 3.1.3(b) — the June
  rejection. The refused list is unchanged.
- **Two floating pills** (strip over bar, content between them). New
  `<BottomDock>`: the strip renders INSIDE it, directly above the tabs, one unit.
- **Not anchored.** The dock sits flush on the bottom edge, edge to edge, and
  pads `env(safe-area-inset-bottom)` itself. A bar mounted without a dock docks
  itself, so vendor and admin bars are anchored too. The event page pads its
  bottom by the dock's measured height (`--sn-bottomdock-h`), replacing a flat
  `pb-20` that never counted the safe area. The view-transition name
  `sn-bottomnav` moved from the `<nav>` to the dock, so the strip does not
  vanish under the page slide.
- **"Event Hub …" truncated.** Bar and strip labels wrap onto a second centred
  line instead of an ellipsis. The label stays "Event Hub Controller": the
  2026-09-03 ruling (and `the-hub-and-its-controller-are-two-words.test.ts`)
  forbids the bare guest word on a dashboard row.
- **☰ drawer stayed open after navigating.** It now closes when the path
  changes (animated, like the scrim).
- **Big space on top** of every event page on phones: the layout's wrapper top
  padding drops from 24px to 12px below `sm` (pages already carry their own).
- **(i) not round.** The base `button { min-height: 44px }` rule stretched every
  small circle into a capsule. `.sn-dot-btn` opts out (square, no floor, an
  8px invisible halo keeps the target); applied to `<InfoTip>`, the Your Team
  category/folder ⓘ and the bench ⓘ. The Your Team head rows gain
  `min-width:0` so the ⓘ is no longer pushed off a phone's right edge.
- **Overview repeated** in the spine strip over the bar: dropped (the binding
  drawing never drew it). Your Team in the Book strip stays — the drawing keeps it.

Guards (each probed both ways): `lib/the-store-shell-menu-offers-no-refused-door.test.ts`,
`app/_components/nav/the-phone-bar-is-anchored.test.ts`,
`app/dashboard/[eventId]/the-page-clears-the-dock.test.ts`,
`app/_components/frontdoor/arriving-closes-the-drawer.test.ts`,
`app/_components/the-info-dot-is-round.test.ts`,
`lib/the-strip-does-not-repeat-overview.test.ts`. The existing
`lib/the-phone-forwards-every-gate.test.ts` now also demands `storeShell` of
every bar/strip caller, because the builder reads `ctx.storeShell`.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-25 row — the phone bar's GEOMETRY lock of
2026-06-13 (floating pill) is superseded by an anchored dock; the interaction
lock is unchanged. The binding drawing `event_menu_by_moment_2026-09-24.html`
still draws a floating strip over a floating bar and is stale on that point.
Flagged for owner sign-off.
