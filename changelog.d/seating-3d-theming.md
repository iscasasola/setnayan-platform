## 2026-07-03 · feat(seating-3d): mood-board treatments + venue-archetype shells — reception_design and venue_setting finally reach 3D

Wave 2b of the 3D seat-plan program. Two long-untapped `events` columns now drive
the 3D room on all three surfaces (couple lab · homepage 3D-Plan demo · guest venue walk):

- **New shared module `apps/web/app/_components/plan3d/venue-decor.tsx`.**
  - `VenueDecor` — palette-tinted, instanced-or-cheap R3F components consuming
    `events.reception_design` (the vocabulary in `lib/reception-scene.ts`, until
    now a 2D-SVG-only field): ceiling chandeliers / string lights / lanterns /
    hanging florals; stage backdrops draped / floral-wall / LED; a floral or
    draped entrance arch; and per-table centrepieces (tall/low florals, candles,
    candelabra, greenery, lanterns) instanced ACROSS all tables. Empty `{}`
    (the default) renders the DEFAULT_DESIGN treatments; 'none'/'bare' → nothing.
  - `VenueShell` — swaps the room shell per `events.venue_setting`: banquet_hall
    (walls + ceiling), garden (no walls · instanced perimeter shrubs/trees · sky),
    beach (sand floor · water horizon), chapel/church (taller shell · warm window
    glow), barn (wood walls + A-frame trusses), rooftop (parapet · dusk). Unknown
    values → banquet_hall. Walls/ceilings render single-sided (architectural
    cutaway) so the orbit/overview camera sees in while a guest inside sees a
    solid enclosure. `archetypeFloorColor` / `archetypeBackground` helpers tint
    the floor + sky per archetype; the palette still tints within each archetype.
- **New `lib/reception-scene.ts#sanitizeReceptionDesign`** — the single trust
  boundary that coerces an arbitrary JSONB blob to a clean `ReceptionDesign`
  (keeps only known part → attr → valid-option-id triples; total, never throws).
  Covered by `lib/reception-scene.test.ts`.
- **Wiring.** Lab (`page.tsx` events select + loader + `SeatingLab3D`), demo
  (`sample-event.ts` select + `loadPlan3DDemoScene` + `Plan3DScene` + loader +
  overlay — the existing "Apply mood board" toggle now flips decor + palette
  together, off = neutral shell), and guest venue (RPC v4 additively returns
  `receptionDesign` + `venueSetting` · `guest-venue-3d.tsx` renders them at 'low').
- **Perf.** All decor is instanced (chandeliers/bulbs/blossoms/candles/shrubs =
  one/two draws per set) or a handful of meshes; the phone walk + guest venue
  render a reduced set ('low' quality drops emissive halos/flames + centrepiece
  density). No new npm deps, no runtime CDN/HDRI fetches.

Migration `20270508699158_public_venue_scene_v4.sql` — additive `CREATE OR REPLACE`
of `public_venue_scene`, two new non-PII keys; privacy posture unchanged.

SPEC IMPACT: None (LOOK-only 3D theming — no schema-of-record change beyond an
additive read-only RPC field; seat plan stays free; no behavior change to
walk/swap/photos). Sample event `maria-and-jose` got a representative
`reception_design` set in prod (chandeliers · draped backdrop · sweetheart stage
w/ floral arch · tall floral centrepieces · floral entrance) so the homepage demo
shows treatments — reported to owner.
