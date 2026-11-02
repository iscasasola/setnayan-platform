## 2026-09-22 · fix(nav): the bottom bar stops disappearing on every mobile tab press

Owner: *"on mobile mode, when i am at the shop and press the bottom nav,
everything reloads. i want the bottom and top nav to persist. the top nav
already seems to persists"*

**Nothing was remounting.** Both navs live in the doorway LAYOUT, above the
segment that swaps, and `<Link>` navigation never re-runs them. The defect was
PAINT ORDER inside the view transition `NavSlideController` starts on every
mobile tab press:

- The `::view-transition` pseudo tree paints above the live document, and its
  groups paint in capture order — `root` **first**, every named group after it.
  `sn-page` is named, so the sliding page paints **over** everything left in
  `root`.
- The element it names is the layout's `<main>`, whose box carries the
  `pb-[calc(env(safe-area-inset-bottom)+92px)]` clearance — exactly the strip
  the floating pill and its FAB occupy. So the bar spent all 320 ms *underneath*
  the page and reappeared after.
- The top bar sits above that box at scroll-top, is never covered, and so
  "already seems to persist". 🔑 **The asymmetry the owner reported is geometry,
  not lifecycle** — which is why looking for a remount finds nothing to fix.

And the freeze itself was washing the chrome out: the UA sheet puts
`mix-blend-mode: plus-lighter` on every `::view-transition-old/new` so the
default cross-fade sums correctly. `animation: none` alone leaves **both**
snapshots at opacity 1, so plus-lighter ADDS two near-identical opaque images
and the whole frozen chrome brightens for the length of the slide — on this
cream palette, a full-screen flash that reads as "the page reloaded".

Changes, all scoped to the 320 ms transition:

- `app/globals.css` — `mix-blend-mode: normal` alongside every `animation: none`
  freeze; `nav[aria-label='Primary navigation']` → `view-transition-name:
  sn-bottomnav` and `.sn-vt-fab` → `sn-navfab`, each frozen the same way.
- `app/_components/nav/nav-fab.tsx` — carries the `sn-vt-fab` marker class.
- `app/_components/nav/the-bar-outlives-the-slide.test.ts` — 5 guards, each
  verified red under its own sabotage (freeze without `normal`; either name
  dropped; the marker class dropped; a duplicated name; `.shell-topbar` named).

⚠ `.shell-topbar` is deliberately **not** named. `view-transition-name` makes an
element a containing block for `position: fixed` descendants — the trap
`panood/program/program-surface.tsx` and `lib/live-studio-control.ts` already
record — and that bar hosts the account panel and the command palette. It also
does not need one: it is never covered.

SPEC IMPACT: None — the owner-locked bottom-nav template, its four `--bn-*`
tuning knobs and the slide's direction/duration are untouched.
