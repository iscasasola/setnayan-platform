## 2026-07-30 · feat(marketplace): the mobile team summary chip — the one thing the removed dock was actually for

PR-3 removed the takeover's 4-chip mobile dock. Three of those chips needed no
replacement; **Build** did — it was the only one carrying live state. This is
that replacement, and it is strictly better than the tab it replaces because it
is itself information. `Explore_Integration_BUILD_SPEC_2026-07-29.md` §5 (PR-4,
owner-approved 2026-07-29). Kept a separate PR from the removal so the removal
stays cleanly revertible.

    🔒 2 locked · 🔨 3 in build · ₱82,000 to spare      → tap = Your team

- **New `_components/team-summary-chip.tsx`** (client leaf, mounted by the server
  `build-locked.tsx` — the same split `team-controls.tsx` documents). Borrows
  `<SubNav>`'s geometry (inset 14px, frosted paper, `--sn-bottomnav-h` + 20px,
  `z-20` under the nav's `z-30`) and **deliberately none of its coordination**:
  `<SubNav>` increments a docked-count store that collapses the bottom nav to
  icons-only, which would put back the two-stacked-bars crowding PR-3 just
  removed. A test forbids the import.
- **Portals to `<body>`** — `position: fixed` resolves against the nearest
  transformed/filtered ancestor and the takeover's glass surfaces carry
  `backdrop-filter`; same reason `category-search-overlay.tsx` portals.
- **Copy comes from the shipped tiles, not the prototype.** The spec mock says
  "₱82,000 buffer"; the live Buffer tile says "to spare"/"over"/"No budget set".
  The chip reuses `bufferTile()` and its exact tone classes, so one number can
  never be worded — or coloured — two ways on one screen. Lucide icons, never
  the prototype's ●/◕ glyphs.
- **Suppressed when there is nothing to report** (0 locked and 0 candidates) —
  the section is one scroll away regardless.
- **Clearance:** flags `html.teamchip-docked` and joins the existing
  `.subnav-docked` clearance rule in `globals.css` (both the mobile padding and
  its ≥1024px cancel) rather than inventing a second magic number. Its **own**
  class on purpose: two components sharing one class means whichever unmounts
  first strips the clearance the other still needs.
- Tests: new `lib/team-summary-chip.test.ts` — 9 cases pinning the buffer
  derivation against `teamMoney`/`bufferTile`, that the parent passes row counts
  rather than hand-rolled numbers, the empty-team suppression, that the mount sits
  **after** the flag-OFF early return, mobile-only, not-a-SubNav, the `teamchip-docked`
  class + both CSS rules, the measured-height docking, and the portal + `goToBuildTab('build')`
  tap. Full unit suite green (5390).

SPEC IMPACT: None. Implements the owner-approved build spec §5; no SKU, pricing,
schema or policy change.
