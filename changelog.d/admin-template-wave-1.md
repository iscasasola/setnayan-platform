## 2026-11-14 · style(admin): template wave — 18 admin screens follow the design template

Admin lane of the 14 Nov template wave (`design_template_sheet_2026-11-14_fable.html`). Style only: same words, same data, same actions.

Screens: mood-board library · budget planner · disputes (+ its three dispute sections) · reviews · repost watch · force majeure · supplier recommendations · website media · concierge abuse · background videos · payment options · integrity watch · discount codes · supplier partnerships · user reports · account deletions · chat flags · event deletions.

- Typewriter capital captions → the sheet's section label (12 px, semibold, grey capitals); mono status pills → chip type; mono IDs/money → body face with even digits.
- Read-only boxes lose their card border and become plain rows on a hairline; "couldn't read" alerts become an amber edge (rule 6).
- Hand-made buttons → `ActionButton` (verdict buttons, the mood-board editor, event deletions); status filters → the shared `PillTrack`/`PillLink`.
- Native `<select>` → the ▾ picker via a new `FieldPick` (`app/admin/_components/field-pick.tsx`): the value posts through a hidden input under the same name, so every GET filter and server action reads what the select posted; `required` is kept.
- Page and section explainers (110+ characters) → one line with the rest behind ⓘ — every word kept. "Couldn't read" warnings and live status lines stay on screen.
- Typed colour codes → tokens (background videos, website media). No 9–11 px words.
- `port-control-baseline.json` regenerated: the deliberate swaps (Link → PillLink on Reviews) plus ~85 routes main had already deleted.

SPEC IMPACT: None — implements the approved design template; no decision changed.
