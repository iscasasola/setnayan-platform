## 2026-10-21 · fix(suppliers): Find's category rows are the app's flat rows — no shadow, no pill

Owner, on desktop Suppliers › Find: "why do i see shadows? the rows do not follow our design template for the app."

- The shadow was a cascade bug: every folder in the one-screen shape is `.fold.flat` AND `.open`, and the boxed shape's
  `.slcat .fold.open{box-shadow:var(--edge-lift-open)}` sat later at the same weight, so it beat `.fold.flat`'s
  `box-shadow:none` — a soft drop shadow under each folder of rows (light mode; dark neutralised it via the var).
  `.slcat .fold.flat.open` now wins.
- The row wears the TEMPLATE's line and second line: `FORM_ROW_RULE` / `FORM_ROW_SUBLINE`, moved into the pure
  `lib/form-row.ts` so FormRow and the bench draw from the same two strings (the bench no longer draws its own line,
  and the 🔒 supplier line is no longer gold mono 9.5 px). Name 16 → 15 px (the template's).
- "IN YOUR PLAN" (mono uppercase pill on a non-pressable label) → the row's plain state word, like "Booked ✓".
- A closed row no longer carries its hidden body's 14 px padding (the empty lip under every row).
- Lab: `/dev/suppliers-lab?planned=1&covers=1` draws an "In your plan" row and the venue-covers-Cake/Catering case.
- Guard `supplier-rows-are-flat.test.ts` RESOLVES the stylesheet's cascade (specificity, then order) onto the row; 5 sabotages red.

SPEC IMPACT: None.
