## 2026-09-03 · refactor(mood-board, seating): relocate the Reception Designer into Seat Plan; add 3 Filipino decor zones

- **One editor, not two.** `events.reception_design` is really the Seat Plan's
  own venue-decor settings, not a separate Mood Board concern — the seating
  lab (`seating/lab/page.tsx` + `seating-lab-3d.tsx`) already READ it to drive
  the 3D room but had no editing UI of its own. The editor (`reception-designer.tsx`,
  including its in-flight AI decor-image layer pilot) moved verbatim into
  `app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx`
  as `ReceptionDesignEditor` — now a controlled component (`design`/`onChange`)
  so it shares state with the 3D `VenueDecor` layer and updates the room live.
  It renders as a collapsible section in the Build sidebar, next to
  "Floor & stage".
- `saveReceptionDesign` and `getReceptionDecorLayerCatalog` moved from
  `studio/mood-board/actions.ts` to `seating/actions.ts` alongside the
  component that calls them.
- The Mood Board's "Design your reception" section is now a compact,
  read-only summary ("Ceiling: Fairy lights · Backdrop: Floral wall · …")
  with an "Edit in Seat Plan →" link. The `#reception` anchor / nav entry is
  unchanged, so existing deep-links still resolve.
- "In your colors" (the recolor-preview gallery) moved lower on the Mood
  Board page — now after Palette, Inspiration, and Reception, right before
  Share & export — and renders through a new `compact` mode on
  `MoodboardBoard` (denser grid, quieter heading). Underlying data/behavior
  (still reads `moodboard_library_assets` + the couple's palette, still feeds
  the vendor RPC / concept PDF) is unchanged.
- Added 3 new Filipino-relevant reception decor zones to `RECEPTION_PARTS` in
  `lib/reception-scene.ts`: **Walls & surroundings** (fabric drape / floral
  garland / greenery wall / uplighting only / bare — with a code-comment note
  that PH venues, hotels especially, often restrict wall treatments),
  **Photo wall** (floral wall / step & repeat / greenery wall / balloon
  garland / neon sign / none — distinct from the stage backdrop), and
  **Welcome & signage** (easel sign / framed seating chart / floral guestbook
  table / minimal). All three follow the existing `Part`/`Attribute`/`Option`
  shape and are picked up generically everywhere `RECEPTION_PARTS` already
  drives UI (part-selector pills, `buildPrompt`, `sanitizeReceptionDesign`,
  the Mood Board read-only summary). SVG rendering for the 3 new zones is
  simplified/fallback-grade compared to the original 7 parts' stylist-grade
  intricacy; the 3D `VenueDecor` renderer does not yet render any of the 3
  new zones (explicit fallback — a large lift out of scope here).

SPEC IMPACT: None (UI/code reorganization + additive option vocabulary; no
schema change, no new locked decision).
