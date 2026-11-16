## 2026-11-16 · feat(design): the clean warm look in the shared layer — step 1 of the rollout

The owner approved the clean warm look on 16 Nov ("yes the template looks good", asking that the buttons and the
background carry to the whole site), then set the page colour the same day ("netural background color f7f5f4 / so
framed can be white. ffffff"). This PR changes only the shared layer, so every screen that already wears it changes
at once. Stacks on the token layer (PR 7733).

- **Tokens (`app/globals.css`).** Page `--sn-page-bg` → `#F7F5F4`, except the guest Event Hub, which keeps white.
  Frame: white with `--m-shadow-md` and no line (`--sn-frame-shadow`, `--sn-frame-line: transparent`, and the tile
  shadow now follows the frame's). Band: `#FAE0D1` → white, top to bottom, ink words. Section and row dividers are off
  (`--sn-divider: transparent`). Secondary button: soft grey fill, no outline (`--sn-btn-secondary-*`). A 30 px screen
  title (`--sn-fs-title`, `text-sn-title`, `.sn-screen-title`). New shared classes: `.sn-frame`, `.sn-band`, and the
  Tailwind keys `bg-frame` and `shadow-sn-frame`.
- **Shared pieces.** `.sn-tile`, `.sn-row` and `.home-card` read the frame tokens. `ActionButton`'s neutral (and
  `.button-secondary`, including the dashboards' pill form) is the grey fill; the primary stays terracotta. The
  `Sheet` loses its 1 px line and header rules and reads the sheet-shadow tokens; its close chip floats. The bottom bar
  is a floating white pill 14 px off the edge, and its active item is a filled terracotta pill (same tabs, same words).
  `TemplateRows` and `TemplateNums` sit in one lifted frame with no line between rows. The door shell's page reads
  `bg-page` and its card is the frame. The collapsing top paints the page colour. The Home plain cover is the band, and
  the countdown is set in the app font.
- **Admin › Colours (`lib/app-colours.ts`).** The "Current" set is now these values. The band gate picks ink words on
  a pale band and white on a dark one, measuring each where it is hardest to read. "Medium" lift is `--m-shadow-md`.
  The guest islands get the old values back (`GUEST_ISLAND_COLOURS`, and the same values declared on the islands in
  globals.css).
- **Guards rewritten to the ruling, not weakened.** `lint-no-card.mjs` now counts hand-typed frames: a container
  radius with its own border or a hand-typed shadow. The baseline was regenerated once for the wider rule: 1,299
  lines. The old baseline said 1,669, but the old rule counted only 1,167 in this tree. `lint-bottom-nav.mjs` pins the
  new bar tokens. `the-phone-bar-is-anchored` asserts the floating pill. Guard tests that read the old values
  (neutral button transparent, look-sample secondary, dashboards' button-rule count, dock classes) now read the new
  rule.

SPEC IMPACT: None new. This implements DECISION_LOG 2026-11-16 "THE CLEAN WARM LOOK IS APPROVED" and "PAGE BACKGROUND
= NEUTRAL #F7F5F4". Design template rule 2 ("bands, not boxes") is undone by that row; the template sheet in the corpus
should be marked superseded on rule 2 (owner/corpus action, not done here).
