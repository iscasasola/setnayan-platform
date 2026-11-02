## 2026-10-19 · feat(mood-board): Palette and Inspiration are one list — every part an Attire block, every circle settable

Owner 2026-10-19, on Studio › Mood Board & Dress Code: *"i like the circles on the attire. but they look different on
the palette ... no need for code. just name if it has name. and just the circle like attire"* · *"the inspirations here
and the palette can be integrated together properly"* → *"make it look like attire"*; to the prototype's open points:
*"1. yes all circles  2. yes  3. yes"* (DECISION_LOG "APPROVED — PALETTE + INSPIRATION AS ONE LIST", prototype
`prototypes/palette_inspiration_one_list_2026-10-19.html`).

- ONE circle: `RoleColourDot` (the Attire dot) moves unchanged to `_components/colour-dot.tsx`; `NamedColourDot` is the
  same circle with the colour's name (`nearestColorName`) under it — no hex, no chevron, anywhere on Palette.
- ONE list: the upload bar, YOUR MAIN PALETTE (the five as circles, slot word + name; Venue & decor's photos under them
  offer "Use as my five main colours"), then one Attire-shaped block per part — The room · Flowers · Cake — each with its
  "Follows <slot>" / "Set by you" line, its circle and its photos line (＋ · Search ideas · "Use for <part>").
  The Inspiration section is gone; every board sits on its part (no data moves: each keeps its `slot_key`).
- EVERY circle settable: `room_dressing` grows (stage, ceiling, walls, tunnel, ribbons_candles, bridal_bouquet,
  entourage_bouquets, flower_accents, cake — same jsonb, no column); each follows its main colour until set.
- Five new inspiration slots (chairs, ribbons_candles, lights, entourage_bouquets, flower_accents) — migration
  `20271278232574_palette_parts_five_more_slots.sql` widens both slot gates (pipeline only).
- 3D Plan: the couple's Stage, Walls, Ceiling, Tunnel, Ribbons & candles and Cake overrides reach the stage slab, the
  shell + drapes + wall treatments, the hung lights, the tunnel, the candles and the cake — only when set.
- Guards: `lib/colour-circles-are-one.test.ts`, `lib/the-palette-holds-the-boards.test.ts`,
  `the-room-reads-the-resolved-board.test.ts` (extended); sabotaged red ×10.

SPEC IMPACT: DECISION_LOG rows already written by the controller (2026-10-19, cbf20df1 + cd0d5834). Supplier side
(suppliers add photos/colours by category) is PR B — not in this change.
