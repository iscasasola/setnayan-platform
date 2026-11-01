## 2026-10-30 · fix(guests): Map, Seats › 2D and Seats › 3D are always full screen — the ⤢ is gone

Owner, iPhone app (Seats · 3D: top nav, a gap, the pinned row, then the plan in a box with a ⤢): *"The 3d plan is still
shutting down the app when i try to press the full screen button. And we can remove that button … The menu should be
pushed up to there and the whole background will be the 3d plan or the 2d plan or the map. They are all full screen. So
we only keep the bottom nav thumb row and the icons of the top nav. The whole screen will be used by the actual screen"*.
Builds on #7079 (one pinned row on every view) and #7062 (3D view-only).

- **No full-screen control anywhere, no Fullscreen API.** The 3D room loses its ⤢, its in-page full screen
  (`inPageFull`), its desktop `requestFullscreen` path, the `fullscreenchange` listeners, the double-tap-outside toggle and
  the `html[data-room-fullscreen]` CSS that hid the shell. Its tool row is ▶ · ✨ Accents · 👁 Show ▾ · View only ⓘ, on
  the room's bottom edge (the thumb zone). The 2D plan's Fit wears corner brackets (`Scan`) instead of the ⤢-shaped
  `Maximize2`; the ⤢-shaped icon is left only on the plan's resize grips (stage, dance floor, cocktail area, room corner).
- **The plan is the whole screen.** On Guests › Map, Seats › 2D and Seats › 3D the view sits in one full surface
  (`.fullSurface` / `data-guests-full-surface` in `guests-screen.tsx`) that runs from the shell bar's bottom (`--gs-top`)
  to the bottom nav (`--sn-bottomdock-h`), edge to edge on a phone (`--gs-left`/`--gs-right`). It is lifted from where the
  screen starts (`--gs-root-top`, measured) and the row's holder gives its height back, so the ONE pinned row now floats
  over the plan directly under the top nav — no gap. It stays in the flow (a fixed box would be a stacking context the
  plan's own sheets sink into). The row is frosted paper over the plan (a `::before` layer, never its own
  `backdrop-filter`) and sits above the 3D layer (z 50 over the room's z 45, under the plan's z 60 dialogs). The event
  column and its wrapper drop their foot padding while a full view shows (`globals.css`), so the page has nothing to
  scroll and the top nav never slides away.
- **The parts fill it.** `SeatPlanInGuests` fills the surface (no height or bleed of its own there); the guest map fills
  it and starts its first fit under the row (measured off the row); the 2D zoom stack moves to the lower third, just
  above the floating thumb row (`--sn-thumb-room`); on a desk the place and guest columns start under the row.
- Measured in the lab (WebKit 390×844, touch): row 61→121 right under the 61-px bar, surface 61→780 down to the 64-px
  dock, page height = viewport (no scroll) on all three views; same at 1280×800. ▾ · ⋯ · ⚙ and ▶ · ✨ · 👁 · View only
  each take their own tap; zero `requestFullscreen` calls after pressing ▶/■ and double-tapping the room.

Guards: new `lib/maps-are-always-full-screen.test.ts` (no control / no API on the three views, the surface, the row's
z, nothing to scroll, the parts fill it — each sabotaged red). `lib/phone-gpu-budget.test.ts` test 5 now pins "no full
screen at all" (was the in-page path); `room-is-view-only.test.ts` pins no double-tap on the floor;
`map-is-the-screen.test.ts` pins the map inside the full surface.

SPEC IMPACT: Implements the existing DECISION_LOG row 2026-10-30 "SEATS 2D · SEATS 3D · THE MAP ARE ALWAYS FULL SCREEN —
NO FULL-SCREEN BUTTON" (amends "3D VIEW-ONLY"'s ⤢ and #7055's auto-pinned full-screen maps). No further corpus edit.
