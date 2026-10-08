## 2026-10-08 · feat(maker): the Invitation's looks are pictures — palette cards, sample shapes for empty scenes, Do's & Don'ts in the hub's own type

Owner's preview checks, 08 Oct (Stages panel), built in the order A · E · D · B · C · F, one commit each.

- **A · The palette's looks are picture cards** (*"palette should show the actual previews like the other styles"*).
  On the Dress code part, the "Palette ▾" dropdown is replaced by the shared look-card carousel (`StyleCards`):
  one card per look (Tags · Fabric swatches · Paint chips · Circles · Ribbon), each the couple's own page asked
  for the Dress code scene with its colours in that look (`?style=dress_code_palette:<id>` → `canvas.palette`,
  host canvas only, nothing written), fitted on "Our colours" and sized by its shape. The stored value, its
  default (Tags = absent) and the guest page are unchanged. Studio › Look › Colours keeps the dropdown (the page
  under it may be a stage that draws no Dress code to picture).

SPEC IMPACT: `STAGES_PANEL_BUILD_STATUS_2026-10-08.md` gains "Round 5 — looks as pictures" (status only; no
decision changed).
