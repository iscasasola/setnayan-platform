## 2026-10-19 · feat(mood-board): the Palette's colours are the Attire circle — its name under it, no code, no arrow

Owner 2026-10-19, on Studio › Mood Board & Dress Code: *"i like the circles on the attire. but they look different on
the palette. palette has a dropdown but attire does not. all colors can be edited on palette. no need for code. just
name if it has name. and just the circle like attire"*.

- `RoleColourDot` (the Attire dot) moves unchanged to `_components/colour-dot.tsx`; `NamedColourDot` is the same circle
  with the colour's name under it (`nearestColorName`, nothing when it has none), in the Attire words' own type.
- Palette's five, the room's parts and the flowers draw it: no hex, no chevron, no pill. A tap opens the same colour
  sheet. A part that only follows a main colour now opens THAT main colour's sheet (titled "Stage — follows Dominant");
  a part a supplier agreed stays shown-only. The supplier-change notice says names, not codes.
- Guard `apps/web/lib/colour-circles-are-one.test.ts` (sabotaged red ×4).

SPEC IMPACT: None (owner ruling applied as given; the older non-Maker Mood Board page — `palette-section.tsx` — keeps its
own swatches and is named in the PR as not changed).
