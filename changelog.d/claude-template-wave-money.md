## 2026-11-14 · style(couple): template wave — date finder, orders, paperwork, documents, disputes, contracts, budget, clearance + the kill-switch budget accordion

Template wave, second PR of my folders (owner 14 Nov: every page on the approved design template, Setnayan-specs
`prototypes/design_template_sheet_2026-11-14_fable.html`). Style only — same words, same data, same actions.

- **Type** — no word under 12 px, no typewriter captions, no serif-italic headings (the date finder's), no ink under 70 % on words (rules 1 · 13).
- **Cards → plain** — order notices, the order/contract/paperwork sections, the date finder's boxes, the budget share toggle and the clearance confirmation lose their frames; warnings keep a left edge in the warn token, not a box (rule 2).
- **Buttons** — 20 hand-made buttons/links on these pages wear the shared pill (`ab` classes; one main per flow step) (rule 3).
- **Picks** — the date finder's "Kind" and the dispute's "Affects which supplier?" are ▾ pickers (`PickMenu` / `PostedPick`), same values posted (rule 4).
- **Motion** — no spinners in the date finder; the words already say "Locking the date…" (rule 15).
- **`plan-budget-accordion`** (the `BUDGET_BUILD_ENABLED=false` kill-switch path) gets the same type/colour sweep; colours swapped only where a token is the same colour, dark-mode literals and shadows kept.
- `label-contrast-dark.baseline.json` records two dark pairs fixed (the ratchet only goes down).

SPEC IMPACT: None — implements the approved design template; no decision changed.
