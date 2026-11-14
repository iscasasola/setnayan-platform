## 2026-11-14 · style(website): W1 — the Event Hub settings pages, the Maker inspector's presses, the crew QR and Recent activity follow the design template

Template wave W1 (controller, 14 Nov: "let's launch them all to cloud now"). Pages: the 15 `website/*` pages,
`event-qr` and `activity` — 17 pages, 238 → 139 points (paragraphs×2 + cards + hand buttons×2 + hex + mono + empty
cards×2 + selects×2). Style only: same words (one label renamed to the current name, below), same data, same actions,
shared pieces only (`ActionButton`/`ab` classes, `InfoTip`, `Badge`, `PickMenu`).

- **No cards** — privacy, widgets, hero photo, site chrome, stories, the living hero, camera cues, the crew QR and
  the Pro lock are grey-capital sections over plain hairline rows. The one framed thing per page is the next step, on
  the warm surface (`--m-paper-2`).
- **Buttons** — every hand-painted mulberry/ink/burgundy pill is the shared pill (one terracotta main per screen; red
  removes; grey everything else).
- **Picks** — Camera cues' native mode `<select>` is the ▾ `PickMenu`.
- **Captions** — 19 typewriter caption captions are the sheet's section label. Money and times are in the words' font
  with even digits.
- **ⓘ** — explaining paragraphs move behind `InfoTip` (camera cues, guest preview, background music, video hero, the
  hero tip, the crew QR check, the Maker's best-size tip).
- **Type** — no words under 12 px and no ink under 70 % across these pages. Raw `amber-*`, `red-*`, `green-*` and
  `burgundy` are the house tokens.
- The camera-cues ⓘ label uses the current name **"Camera cues"** ("Photo moments" is retired, held by
  `the-four-photo-names.test.ts`).
- **Kept on purpose, listed in the PR:**
  - the RA 10173 consent and disclosure paragraphs on the privacy page;
  - error and consequence lines;
  - the Maker inspector's `aria-pressed` pick chips and its shared inspector-kit button;
  - colour-picker art and swatch data (hex);
  - the love-story studio's themed `--ls-*` surface;
  - the widgets page's form-only Auto/Shown/Hidden segment.

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
