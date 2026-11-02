## 2026-10-16 · fix(colour-picker): Custom takes a colour NAME, and the wheel is its own tap target

Owner, live: *"color picker still not working"* — the one colour picker's Custom field
(`colour-picker-sheet.tsx`, opened by every colour control: `StudioColourField`, `ColourWell`,
`SwatchPopover`, the Mood Board) held "burgund" and ✓ Use stayed grey: it took only a hex code and
said so nowhere.

- **A name works.** New `apps/web/lib/colour-name-search.ts`: as he types, up to six of OUR colours
  are listed under the field (swatch dot · name · code), matched case/space/accent-insensitively by
  whole word → start → start of a word → anywhere. Sources: `WEDDING_NAMES` + `CSS_NAMES`,
  `COLOR_NAME_ALIASES`, and 26 typed trade words neither table holds (`TYPED_COLOUR_WORDS` — "rose
  gold", "hunter green", "sea foam"…), each pointing at the colour the namer itself places the word's
  reference colour on (re-checked by the guard). No hex is invented for a word.
- **Retired "Burgundy"** stays retired as a NAME (MB5: ΔE 4.1 from Garnet). It may still be TYPED:
  "burgund" → **Garnet · for burgundy**, the redirect said on the row.
- **✓ Use / Enter** set a valid code, else the top name match; nonsense → off, with a quiet "No colour
  by that name" line. Placeholder: "Colour name or code" (the brief's longer "A colour name or code (#7A1F2B)" clipped at 375 on iPhone Safari — measured 184 px of text in 174 px of room even shortened to "Colour name or #7A1F2B"); the 7-character cap is gone.
- **The matches scroll into view** as they appear (they open at the sheet's foot; at 375 none showed without it).
- **The wheel** is now the `type="color"` input ITSELF (44 px, conic ring, the picked colour as the
  dot in it), not an `opacity-0` input inside a `<label>` — so the tap lands on the input on iPhone.

Walked: lab Mood Board at 375 (Playwright WebKit iPhone 13 + Chromium), Chromium desktop 1000, and real iOS 26.5 Safari in the iPhone 17 simulator — the wheel opens iOS's native Colors sheet and the pick enables ✓ Use; "burgund" lists Garnet; the keyboard's ✓ applies it.

Guard: `apps/web/lib/the-colour-field-takes-a-name.test.ts` (sabotaged three ways, each red).
`the-stages-panel-wears-the-accent.test.ts` re-pinned from `disabled={!typed}` to
`disabled={!custom.use}` (it pinned the defect's own spelling).

SPEC IMPACT: None — extends the approved Custom shelf (BACKGROUND_RESTUDY_2026-10-08 § 2.2) with name
entry; no shelf order, SKU or schema change.
