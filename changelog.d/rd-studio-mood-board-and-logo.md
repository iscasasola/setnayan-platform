## 2026-10-07 · feat(maker): Studio › Mood Board & Dress Code, and the Logo's three additions (plan PR 5)

Behind `makerStagesStudioEnabled()` (the new Maker only — every couple today keeps
the shipped board and the shipped Logo editor, byte for byte).

**Mood Board & Dress Code** (`studio/mood-board/_components/mood-board-studio.tsx`,
lazy in the `maker-mood-board` chunk, drawn by `MoodBoardMakerBody` when the launch
page hands it `studio`): full screen under Tool ▾, Saved · ✨ Auto above one
`ISegmented` — Colours · Attire · Inspiration · Do's & Don'ts.

- **Colours** — the five main colours, each with its job; then *The room — for your
  stylist* (Stage · Ceiling · Walls · Tunnel · Table linens · Chairs · Ribbons &
  candles · Lights · warmth) and *Flowers — for your florist* (Bridal bouquet ·
  Entourage bouquets · Centrepieces · Accents), each "Follows <main colour>" or "Set
  by you" (`lib/colour-access.ts` `ROOM_LANE_PARTS` / `FLORIST_LANE_PARTS` /
  `lanePartColour`). A booked supplier's change shows as Keep / Undo it (the shipped
  MB16 `rejectColourChange`).
- **The picker** (`colour-picker-sheet.tsx`): now · From your photos · 16 swatches ·
  Custom (wheel + code). One tap sets one colour and says what it changes; undoable.
- **✨ Auto** (`auto-palette-sheet.tsx`): the photos' own palette (best match) and the
  shipped themes' own five colours; ✨ Make more. Fills the five only — a part or role
  set by hand keeps its colour (`lib/mood-board-studio.ts` `withAutoPalette`).
- **Attire** — one row per role (bride, groom, the event's groups, guests): figure in
  the role's colour, Wear ▾ (shipped attire styles, "Not said yet", no default),
  colour chips + add, the shipped call time. Wear drafts into `dress_code_config`.
- **Inspiration** — Upload your own photos (compressed on the phone), Your main
  palette (`lib/color-space.ts`) with Use as my five main colours + Compare, then ten
  parts on the shipped slots (`lib/inspiration-slots.ts`), each with +, tagged photos
  (Yours · Florist · Stylist), its own palette + one apply button, and **Search ideas ›**
  = the shipped `gallery-picker.tsx` with a search box · From ▾ · Near ▾ · Matches my
  colours · Save to <part> · Shop ›. `normalizeGalleryQuery` still caps every page.
- **Do's & Don'ts** — the shipped `DressCodeListsForm`.

**Logo** (`launch/_components/maker-logo.tsx`, `lib/logo-layers.ts`,
`app/_components/layered-logo-player.tsx`): the shipped editor plus only Colour =
the five main colours (+ Its own), a Rotate slider in Size and place, and Out
(None · Fade · Sink) in Motion — saved and played.

New guards: `the-two-lanes-list-every-part`, `a-part-follows-its-main-colour-until-set`,
`auto-never-locks-a-colour`, `the-picker-sets-one-colour-and-drafts-it`,
`the-gallery-picker-still-caps-the-query`, `every-slot-maps-to-a-taxonomy-category`,
`the-logo-adds-three-things-only` (all `apps/web/lib/*.test.ts`, each seen red once).

No migration. +0 server actions.

SPEC IMPACT: None — builds the 2026-10-06 DECISION_LOG rows as written. Deviations
(the palette is written live by the Mood Board's own writer because the hub draft
holds only a theme seed; Bridal bouquet and Centrepieces have no inspiration slot
without a migration; parts other than linens/chairs/florals/lights can only follow
their main colour; Auto's named suggestions are the shipped themes) are reported for
owner sign-off in the PR, not silently decided.
