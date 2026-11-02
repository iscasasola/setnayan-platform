## 2026-07-03 · feat(seating-3d): render placed venue objects, booths, signs & cocktail room across all 3D surfaces

The couple places rich floor-plan fixtures in the 2D editor, but the 3D surfaces
only ever drew guest tables + the stage/dance floor. Now all three 3D surfaces
render the WHOLE placed venue (owner 2026-06-26 "make full use of this so our
edit is not just a seat plan"), and the walk-in crowd / roam avatar steers around
the new fixtures too.

- New shared, read-only module `apps/web/app/_components/plan3d/venue-objects.tsx`
  — R3F renderers for the 10 `VENUE_OBJECT_CATALOG` kinds (arch / buffet / bar /
  cake · gift · registration tables / photo booth / lounge / LED wall / greenery),
  vendor booths, wayfinding signs (post + arrow panel, rotated to heading), and a
  cocktail-room shell (floor + low translucent walls + accent trim). Tasteful
  low-poly primitives consistent with the shared `TableMesh`; accepts a
  `Lab3DPalette` so a Wave-2 mood-board recolour picks the fixtures up
  automatically. No troika text → nothing fetches a font at runtime (keeps the
  homepage overlay + phone guest walk fast). One `<VenueFixtures>` entry point.
- Pure obstacle helpers added to `lib/seating-3d.ts`: `boothObstacles`,
  `signObstacles`, `cocktailObstacles` (+ `BOOTH_FOOTPRINT_M`, `Lab3DBooth` /
  `Lab3DSign` / `Lab3DCocktail` types), unit-tested. Every 3D surface merges these
  (plus the existing `sceneObjectObstacles`) into its walk/roam obstacle sets so
  the avatar rounds the buffet / booth / cocktail room the same way it rounds a
  table.
- Couple lab: `seating/lab/page.tsx` now fetches `event_scene_objects` (new
  `fetchSceneObjects` in `lib/seating.ts`), `event_floor_booths` + `event_floor_signs`
  (existing `fetchBooths`/`fetchSigns`), derives the cocktail room from the
  round-tripped floor extras, and passes them through the loader to
  `seating-lab-3d.tsx`, which renders them read-only (no drag/add in this slice —
  edits stay in the 2D editor + the lab's own table tooling).
- Homepage 3D-Plan demo: `loadPlan3DDemoScene` + `Plan3DScene`/loader/overlay/guest-view
  extended to carry + render the sample event's fixtures (kept low-poly-fast).
- Public guest venue explorer: `public_venue_scene` already returned scene objects
  in its payload (just never rendered) — now rendered. Booths, signs and the
  cocktail room were NOT in the RPC, so a new migration
  `20270505930682_public_venue_scene_v2.sql` `CREATE OR REPLACE`s the function
  additively (three new top-level keys `booths`/`signs`/`cocktail`), preserving the
  exact privacy posture (published-gate, anonymised occupancy, names only via a
  valid per-guest token for that guest's own table — all three additions are
  non-PII room fixtures). Applied to prod.

SPEC IMPACT: None. Renders already-modelled seat-plan data (iteration 0008 tables
`event_scene_objects` / `event_floor_booths` / `event_floor_signs` +
`event_floor_plan.cocktail_*`) in 3D; the RPC change is additive + preserves the
locked guest-privacy posture. No SKU, schema-rename, or pricing change; seat plan
stays free.
