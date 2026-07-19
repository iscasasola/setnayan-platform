## 2026-07-11 · feat(seating): stage/dance wall-snap + room presets & scale bar + 2D booth footprint/facing/upright labels

Three cohesive floor-plan authoring rules for the shipped 2D seat-plan editor
(`apps/web/app/dashboard/[eventId]/seating/_components/seating-editor.tsx`),
plus a shared facing helper in `apps/web/lib/seating-3d.ts`:

- **Stage + dance-floor wall-snap.** Dragging a stage or dance-floor rect now
  snaps its nearest edge flush to a room wall (0 / 100 %) once within a small
  percent tolerance — mirroring the booth perimeter clamp's wall-hug
  convention. Axis-independent, sized-room only (a free board has no walls);
  away from a wall the rect still follows the cursor. Resize grips untouched.
- **Room presets + adaptive scale bar.** Six one-tap footprint presets
  (Intimate 14×10 · Standard 20×30 · Grand 30×20 · Garden 60×40 · Estate 120×90
  · Field 200×200) beside the Width/Length inputs (range unchanged, min 1 / max
  500 m). A canvas scale bar picks a "nice" metre length so it reads ~80–110px
  at the current px-per-metre, and the dot grid is now metre-aware (coarsens as
  the room grows) so big rooms stay legible.
- **2D booth footprint + facing + upright label.** Booths in a sized room now
  render at their true `BOOTH_FOOTPRINT_M` (reused/imported from
  `lib/seating-3d.ts`, no inline magic numbers) at px-per-metre, with an inward
  facing arrow (toward room centre / back to the nearest wall) and a
  counter-rotated label that stays upright while the body + arrow orient to the
  wall. Facing is derived from the SAME inward bearing as the 3D `boothFacingY`
  via a new shared `boothInward` helper (+ `boothFacingDeg2D`), so 2D and 3D
  never disagree. Position-derived facing only — no new DB column, no migration.
  Booths stay drag-only (no resize/rotate-size). `boothFacingY` is refactored to
  call `boothInward` and remains byte-identical (all 108 seating unit tests pass).

Verified statically (app can't boot locally — no `.env.local`):
`node --import tsx --test lib/seating-3d.test.ts lib/seating.test.ts
lib/seating.reconcile.test.ts` → 108/108 pass · `tsc --noEmit` → clean ·
`next lint` (scoped + full `pnpm --filter web lint`) → 0 errors.

SPEC IMPACT: None to the product corpus schema or the 2D→3D data contract —
these are owner-decided floor-plan *authoring* rules on the shipped Smart
Seat-Plan editor (0008 seating chart editor), consistent with the Guests
"Living Roster" seat-plan-editor direction
(`~/Documents/Claude/Projects/Setnayan/` memory
`project_setnayan_guests_living_roster.md`, which keeps the seat plan as the one
surface that opens its own screen). Booth facing/footprint remain
POSITION-DERIVED (no `event_floor_booths` column added), so the corpus data
model is unchanged; nothing to apply in `DECISION_LOG.md` beyond this note.
