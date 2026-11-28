## 2026-11-27 · feat(gown-maker): the cutting-block engine (port step B6)

Gown maker port, step B6 (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5; prototype v180–v181). Pure code, no screen yet: the designer's "Cutting blocks" (step B7) and the 1:1 export (B12) draw from it.

- `lib/gown-pattern/inputs.ts`: every number a block reads, by the designer's order of trust: her tape at the fitting → what the bride typed → the 3D estimate. Each number is tagged with its source.
- `lib/gown-pattern/skirt.ts`: starting blocks for the sheath, A-line (also the Filipiniana saya), mermaid and ball gown, each with its check table.
- `lib/gown-pattern/bodice.ts`: the close-fitting bodice block after Aldrich, **from memory**. Every book constant lives in one table, `draft-constants.ts` `GOWN_DRAFT`; the code reads it and every sheet prints it marked "check against the book", until step B19.
- `lib/gown-pattern/svg.ts`: the blocks as one SVG sheet at 1 unit = 1 mm, drawn in one ink. No prices on any sheet.
- A draft from any estimate is marked, so the sheet prints "ESTIMATE: measure before cutting". Impossible input says why ("Can't draft: check waist to hip.").
- **Guard:** `lib/gown-pattern/pattern.test.ts` (9). The port's 28 skirt drafts (7 bodies × 4 silhouettes) and 7 bodice drafts equal the prototype's own outputs to the micron, and every check is within 2.5 mm. The reference outputs come from running the prototype's own `draftSkirt` / `draftBodice` (`scripts/gown-pattern-golden.mjs` → `prototype-v189.golden.json`). The bodice measurements in that file are fixed stand-ins shaped like Aldrich's size chart, because the prototype took them from the 3D body (step A3). Sabotage-checked: a constant changed, the mermaid flare changed and the estimate mark dropped each turn it red.

SPEC IMPACT: None. The constants stay "from memory, check against the book" until B19 (owner Q11: a pattern-maker checks them).
