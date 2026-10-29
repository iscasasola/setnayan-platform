## 2026-10-29 · feat(guests): top row Guests ▾ · Seats ▾ · March; Map / 2D / 3D auto-pin full screen; 2D edge to edge; group ✎

Owner 2026-10-29 (~18:15 · ~18:35 · ~18:42 · ~21:55; Guests prototype v14 / v16). Built on #7052 (the shared Sheet
portal) — merge after #7052.

- **Top row** (`guests-screen.tsx`, `lib/guests-views.ts`): ONE segmented row — Guests ▾ (List · Map) · Seats ▾ (List ·
  2D · 3D) · March — replaces "List 32 · Map · Seats · March" and Seats' "Seat plan · 2D ▾" sub-row. The selected
  segment's ▾ is the shared PickMenu; the others stay links, so every old address (`?gview=map|walk|seats`, `seat=list|3d|map`)
  still lands. Seats' mode keeps ONE state — the seat plan's — and reports it to the row through the Guests lens
  (`registerSeats`); Seats' Edit · ⋯ ride the row as 40-px rounds left of the ⚙ (`SeatPlanToolRounds`, a portal into
  `lens.toolsSlot`). Scrolled, every view shows the slim pinned row: ONE menu ("Guests · List ▾") + rounds (+ the List's
  ✓ ✕ ? doors).
- **Auto-pinned full screen**: Guests › Map, Seats › 2D, Seats › 3D (`isFullScreenView`) — entering one glides (full row
  rises + fades −12 px · 0.98, slim row rises from +12 px, 0.3 s, cubic-bezier(.2,.8,.2,1); the count row folds in the
  same glide; the page scrolls smoothly to its top; reduced motion = none) and the map fills the rest of the screen.
- **2D edge to edge** (`seating-editor.tsx`): in Guests the room-aspect canvas no longer clips; its floor (`::before`:
  the grid + the press area) fills the whole cell, so the side strips are floor and take a drag. The room box — and every
  percent → pixel step — is unchanged. Fit fills the cell.
- **Group ✎** (`section-head-toolbar.tsx` `SectionRenameInPlace`): a List group header tap folds/unfolds only (the slice-4
  select + toolbar is gone from the List); a ✎ on the row renames IN PLACE through the shipped doors (`renameRole` /
  `renameSection` / `editGuestGroupInPlace`); "＋ Add guest here" removed. March's toolbar unchanged.
- Lab: `/dev/guests-lab` passes `seat` and draws a 3D-room stand-in so Seats › 3D's full screen can be walked on fixtures.
- Not drawn: 📤 — it waits for the per-view "Share or print" sheet (slice 8). Not in this PR: moving the 3D panels off the room.
- Guards: new `lib/guests-top-row-and-full-screen.test.ts` (sabotaged red 3×); `lib/guest-section-head.test.ts` (2) rewritten
  for the ✎ ruling (sabotaged red); updated to the new shape (no assertion dropped without a replacement):
  `the-pinned-row-is-one-row`, `r4-seats-march-forwards` 6/7, `pills-are-everywhere` (the pinned List | Map pill retired —
  it is one dropdown now), `seats-in-guests-are-frameless`, `guests-read-is-honest`, `section-names-reach-every-surface`,
  `a-pair-walks-as-one-line`. Port baseline regenerated (Ugat screens / design-rules / root map unchanged).

SPEC IMPACT: DECISION_LOG.md row 2026-10-29 "GUESTS TOP ROW = Guests ▾ … · MAP / 2D / 3D AUTO-PIN FULL SCREEN · A LIST
GROUP RENAMES BY ✎ ON ITS ROW" (corpus b947f262) — records the owner's 29 Oct rulings this PR builds.
