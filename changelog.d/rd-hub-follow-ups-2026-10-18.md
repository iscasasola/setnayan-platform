## 2026-10-18 · fix(event-hub): four Event Hub follow-ups — fonts handed back on the canvas, the short phone's door, the prints' dress code, the colour search

- **Text and Labels & buttons handed back show on the canvas** (`app/globals.css`, "THE COUPLE'S FOUR FONTS"). The Names
  fix of 2026-10-17 (#6610) named these two as the same gap. Measured on the real guest markup in the canvas's two
  scopes (Chromium + WebKit): a draft that handed either back over a live pick kept the live face on the buttons
  (Classic and a theme), on a theme's eyebrows, and on Classic's text, until Apply. The nearest worn scope now decides
  for the eyebrow and button rules, and a worn Classic scope without the Text mark inside one with it takes back the
  page's own text face (`--hub-page-text-face`, captured on `body`). A guest's page is unchanged. Guard:
  `app/[slug]/_components/a-font-handed-back-shows-on-the-canvas.test.ts`.
- **A short phone's text cover makes room for its door** (`first-screen-door.tsx` `foot`, `first-screen-fit-dom.ts`).
  The stranger's "Confirm your Booking" in the cover's foot landed at y 644–700 on a 375 × 667 screen (under the
  first-visit notice too). The foot is fitted by the shipped first-screen rule — air, then the mark, then whole parts
  below the whole foot — with the door's bottom 16 px clear of the edge (8 px above the notice). 375 × 812 / 390 × 844
  with no notice and desktop (≥ 1280 px) are drawn as before. E2E re-aimed: door on the first screen at every size.
- **Prints say the guest page's dress code** (`lib/print-set.server.ts` → `dressCodeLines`, `lib/dress-code-for-everyone.ts`).
  Paper read the old `groups` / `roles` stores; it now reads the Studio's rows (`dressCodeForEveryone`), both picks of a
  row of two, the couple's note. Guard: `lib/the-print-says-the-pages-dress-code.test.ts`.
- **The Mood Board's colour search lists a colour once** (`lib/color-search.ts` `listedOnce`): "Coral", "Gold", "Navy",
  "Plum", "Forest Green" were each listed twice (the curated swatch and the CSS one). Deduped by swatch and by name,
  curated first, order kept.

SPEC IMPACT: None — each change makes a surface follow a ruling already recorded (the four fonts 2026-10-08, the
nearest scope 2026-10-17, the door in the foot 2026-10-17, "ONE FACT" dress code 2026-10-17).
