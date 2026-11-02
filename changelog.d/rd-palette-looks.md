## 2026-10-15 · feat(palette): Arch tabs · Watercolour dots · Paint strokes, Fabric redrawn as silk, a third ink step

Owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (2); contract `prototypes/palette_styles_2026-10-15_fable.html`
(styles 2, 3, 4 → `fabric`, 5, "Delta to build", "Legibility").

- `lib/palette-looks.ts`: three new ids appended — `arch` ("Arch tabs"), `watercolour` ("Watercolour dots"),
  `strokes` ("Paint strokes", "best up to six colours"). `fabric` keeps its id and is now named "Silk swatches".
  Script circles is not built. An unknown id still reads as Tags.
- `dress-code-palette-looks.tsx` + globals.css "THE FIVE PALETTE LOOKS": the one `<li style="--c;--k;--i">` markup
  draws the three new looks and the silk redraw (full size, row size beside the attire figures, and the reader's
  own "You are…" panel). Arch tabs carry the sprig and NO hex; every new look and Silk say a colour by name only.
  Watercolour's rough edge is one SVG filter drawn beside its list. Still: no animation, no transition.
- `lib/palette-ink.ts`: the third step — when neither fixed ink reaches 4.5 : 1 the ink falls to #111111 / #ffffff
  (Taupe #8B7E74 → #111, 4.80 : 1), and the swatch is marked `data-ink="fallback"`.
- Maker: the "Palette" dropdown, the toolbar's palette row and the empty-scene sample shapes draw the new looks
  from the registry. `/dev/maker-lab/guest?board=cale` feeds the lab the prototype's real eleven colours.

SPEC IMPACT: None — the ruling is already in DECISION_LOG ("SIX OWNER ANSWERS", 2026-10-15) and the prototype is
the contract; no corpus edit needed.
