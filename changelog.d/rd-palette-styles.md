## 2026-09-30 · feat(event-hub): the Dress code's colours in five looks, picked from one "Palette" dropdown

Owner, on `prototypes/palette_styles_2026-09-29.html`: *"palette. yes · Style on toolbar yes"* (DECISION_LOG
"APPROVED — FIVE PALETTE STYLES, PICKED ON THE TOOLBAR"). Built WITHOUT the design's entrances: the owner cut palette
animation on 2026-09-30 (DECISION_LOG "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE").

- **Five looks for "Our colours"** — Tags (today's `.pahina-swatch`, the default) · Fabric swatches · Paint chips ·
  Circles · Ribbon. Stored as `canvas.palette` beside the scene's `canvas.style` on the Dress code row
  (`lib/hub-canvas.ts`, same sanitiser as `style`, not a Pro look key, frames nothing). Absent, `tags` and any id
  this version does not draw all resolve to Tags (`lib/palette-looks.ts` · `resolvePaletteLook`,
  `paletteLookOfRow`), and Tags is the shipped markup byte-for-byte — a page that never picked does not change.
  All five are FREE.
- **Drawn server-side, CSS only, and STILL** (`app/[slug]/_components/dress-code-palette-looks.tsx`, globals.css
  "THE FIVE PALETTE LOOKS"). No animation, transition or keyframes; the page's scroll observer
  (`pahina-motion.tsx`) is untouched. "Our colours", the reader's own "You are…" colours and every role row (at row
  size) follow the pick; "The palette" and "The line" layouts keep drawing colours their own way. The ink on a
  colour (Paint chips' names, Fabric's stitch, the Circles' thread holes) is chosen by WCAG contrast
  (`lib/palette-ink.ts`) — Gold #B8934A takes the dark ink.
- **The Maker: "Palette ▾"** — one PickMenu under the Dress code's "Style ▾" in the scene panel, each of the five
  with a thumbnail in the couple's own first three colours. Saved through the Style row's own `useSceneCanvas`
  (the same draft door, so the two picks never overwrite each other); picking Tags clears the key. Shown only
  where "Our colours" is drawn in the look (Colours and roles, or a stage with no layouts) and the couple has
  colours. Loaded with the Style row in the existing lazy `maker-details` chunk. **Budgets held, none raised.**
- **Guards:** `lib/palette-looks.test.ts` (resolver, sanitiser, free, contrast ink, NOTHING MOVES — no animation,
  transition or keyframes on any palette rule and the observer never told about palettes — the picker is ONE
  PickMenu of five with thumbnails and loads only through `maker-details`, Tags saves as an absence) and
  `app/[slug]/_components/every-palette-look-draws.test.ts` (absent = tags = unknown = the shipped markup; each
  look draws every colour in order at 2 and 7 colours; role rows and the reader's panel follow; the other
  layouts are untouched; no look draws a hook the scroll observer could mark).

SPEC IMPACT: DECISION_LOG.md — "AS BUILT — FIVE PALETTE STYLES" row (what shipped, the stored key, built still per
the owner's 2026-09-30 cut).
