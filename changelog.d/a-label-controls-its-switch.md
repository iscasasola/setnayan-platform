## 2026-09-29 · fix(maker): a tap on a Details print-set row flips its switch

Live bug (owner: "why can't i toggle them?"). Every Details include row with an
ⓘ was `<label><InfoTip/><input role="switch"/></label>`. A `<label>` with no
`for` controls its FIRST labelable descendant, and InfoTip's ⓘ is a `<button>`
that comes first — so a tap on the row opened the tip and the switch never
moved. Rows without an ⓘ worked.

Fixed with `htmlFor` + `id` on every label that holds a button and a form
control: `Toggle` in `launch/_components/maker-details.tsx` (server component,
id derived from the field name), the RSVP-ask `Switch` in
`maker-rsvp-ask.tsx` (same bug — its InfoTip arrived through the `label` prop),
and two labels whose field came before their button and so worked by position
only (`admin/secrets/_components/secret-value-input.tsx`, Patiktok
`tag-sheet.tsx`). The ⓘ keeps working as its own button.

Guards: `apps/web/lib/a-label-controls-its-switch.test.ts` (TypeScript AST; a
label without `htmlFor` holding a button and a control, directly or through a
prop) and `launch/_components/a-tap-on-the-row-flips-the-switch.test.ts`
(renders `Toggle` and resolves the label's control by the HTML rule).

SPEC IMPACT: None.
