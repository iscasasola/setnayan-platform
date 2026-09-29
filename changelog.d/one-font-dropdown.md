## 2026-09-29 · feat(maker): one font dropdown across the Event Hub editor

Owner, verbatim: *"the font across all event hub editor. can be one style. A
dropdown with the following: 5 recently used · 5 most used fonts on the website ·
all the rest of the fonts. * all fonts that are being used in the website must
have and (actively used) label?"*

Every font picker in the Maker is now one component, `FontPick`
(`app/dashboard/[eventId]/website/editor/_components/font-pick.tsx`, on the
shipped `PickMenu`): a part's Font row (scene parts, hero parts in Details, a
letter run), the Logo text layer's Typeface, and the Colours row's Typeface
(`site_font_key` — was a two-column radio grid; it now posts the same field from
a hidden input). Its shelves come from `lib/hub-font-shelves.ts`:

- **Recently used** — the couple's last 5 distinct picks from any of those
  pickers, kept on this device per event (`sn-maker-fonts:<event>`, beside the
  colour well's saved colours). No new column.
- **Most used** — `HUB_FONTS_MOST_USED` (the measured five, pinned to
  `mostUsedHubFontKeys` by its test), less any already shown above.
- **All fonts** — the rest, Serif · Script · Sans · Display.

Every face appears once. **"In use"** marks each face the Event Hub renders now,
computed by the editor page from the same draft-over-live data the canvas draws
(the theme's faces, `site_font_key`, every part and letter run, the logo's text
layers) and registered for the whole Maker through `MakerLookPages.fontsInUse`.
Shelf headings are sticky (`PickMenu stickyGroups`); a font row is
`content-visibility: auto`, so its face downloads only when it scrolls into the
open list. Pro fonts keep ◆ on the row label. `hubFontsForPicker` and
`HUB_ELEMENT_FONTS` are retired.

Guarded by `apps/web/lib/hub-font-shelves.test.ts` — shelf order + no
duplicates (property), recent = last 5 distinct (property), "In use" equals what
`hubElementDeclarations` / `hubRunDeclarations` / `hubFontVars` render
(property), the page → work area → dropdown wiring, and a sweep: no file in the
editor offers a list of faces except `font-pick.tsx`.

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-29 "ONE FONT DROPDOWN ACROSS THE
WHOLE EVENT HUB EDITOR" (recorded in the corpus).
