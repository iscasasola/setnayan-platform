## 2026-09-29 · feat(event-hub): the Dress code's colours in five looks, picked from one "Palette" dropdown

Owner, on `prototypes/palette_styles_2026-09-29.html`: *"palette. yes · Style on toolbar yes"* (DECISION_LOG
"APPROVED — FIVE PALETTE STYLES, PICKED ON THE TOOLBAR").

- **Five looks for "Our colours"** — Tags (today's `.pahina-swatch`, the default) · Fabric swatches · Paint chips ·
  Circles · Ribbon. Stored as `canvas.palette` beside the scene's `canvas.style` on the Dress code row
  (`lib/hub-canvas.ts`, same sanitiser as `style`, not a Pro look key, frames nothing). Absent, `tags` and any id
  this version does not draw all resolve to Tags (`lib/palette-looks.ts` · `resolvePaletteLook`,
  `paletteLookOfRow`), and Tags is the shipped markup unchanged — a page that never picked looks the same.
  All five are FREE.
- **Drawn server-side, CSS only** (`app/[slug]/_components/dress-code-palette-looks.tsx`, globals.css "THE FIVE
  PALETTE LOOKS"). One markup for the four new looks; "Our colours", the reader's own "You are…" colours and every
  role row (at row size) follow the pick. "The palette" and "The line" layouts keep drawing colours their own way.
  The ink on a colour (Paint chips' names, Fabric's stitch, the Circles' thread holes) is chosen by WCAG contrast
  (`lib/palette-ink.ts`) — Gold #B8934A takes the dark ink.
- **Each look has its entrance** — tags swing on the pin · cloth unfolds · chips fan · buttons roll and pop ·
  ribbon unrolls then splits; 100 ms apart, capped at the seventh colour, every one done by 1.15 s. It plays once,
  when the palette nears the screen: the page's ONE observer (`PahinaMotionObserver`) now also marks
  `[data-pal-look]` `.pahina-in` — one selector added to `hsel`, no new script. Reduced motion, no script and the
  2s self-heal all leave the colours resting in place. ⚠ Tags is the default, so its swing-in now plays on live
  pages that never picked (the resting look is unchanged).
- **The Maker: "Palette ▾"** — one PickMenu under the Dress code's "Style ▾" in the scene panel, each of the five
  with a thumbnail in the couple's own first three colours. Saved through the Style row's own `useSceneCanvas`
  (the same draft door, so the two picks never overwrite each other); picking Tags clears the key. Shown only
  where "Our colours" is drawn in the look (Colours and roles, or a stage with no layouts) and the couple has
  colours. Loaded with the Style row in the existing lazy `maker-details` chunk — nothing added to the Maker's
  first load but one prop.
- **Guards:** `lib/palette-looks.test.ts` (resolver, sanitiser, free, contrast ink, every entrance gated on
  `.pahina-js` + `.pahina-in`, the reduced-motion stop, the slowest entrance < 1.2 s, the picker is ONE PickMenu of
  five with thumbnails, the picker loads only through `maker-details`) and
  `app/[slug]/_components/every-palette-look-draws.test.ts` (absent = tags = unknown = the shipped markup; each
  look draws every colour in order at 2 and 7 colours; role rows and the reader's panel follow; the other
  layouts are untouched). `the-motion-reaches-the-guest.test.ts` pins the widened observer selector.

SPEC IMPACT: DECISION_LOG.md — "AS BUILT — FIVE PALETTE STYLES" row (what shipped, the stored key, the entrance's
mechanism, and that Tags' swing-in now plays on live pages).
