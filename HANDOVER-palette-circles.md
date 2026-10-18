# HANDOVER — rd/palette-wears-attire-circles (2026-10-19)

Owner: "i like the circles on the attire. but they look different on the palette ... no need for code. just name if it
has name. and just the circle like attire".

## Done
- `_components/colour-dot.tsx`: `RoleColourDot` moved unchanged (attire call sites identical) + `NamedColourDot` (same
  circle, colour name under it via `nearestColorName`, `DOT_WORD` = attire word type).
- Palette five / room / flowers: circle, no hex, no chevron. Follow-only parts open the main colour they follow
  (sheet "Stage — follows Dominant"); supplier-agreed part shown only. Supplier-change notice: names not codes.
- Guard `lib/colour-circles-are-one.test.ts`, sabotage 4/4 red (script in scratchpad palette-circles/sabotage.sh).
- Re-aimed: studio-mood-board-are-the-templates (button count 3→1, Stage tappable), studio-screens-follow-the-prototype.

## Decisions (mine, flag in PR)
- Follow-only parts become tappable (owner: "all colors can be edited on palette") → edit the followed main colour.
- Older non-Maker Mood Board (`palette-section.tsx` + `swatch-popover.tsx`) is a different shipped design — NOT changed.

## ON HOLD (controller 2026-10-19): Inspiration-into-Palette one list — wait for the approved prototype.
WIP patch parked at scratchpad palette-circles/one-list-wip.patch (not on the branch).

## State
- [x] code + guard · [ ] shots 375 light/dark · [ ] PR draft · [ ] CI green
