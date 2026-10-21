## 2026-10-21 · fix(suppliers): a covered row says why — "Seda Vertis North · with Reception"

Owner, verbatim: *"Put '· with Reception' on the covered rows"*. A supplier drawn under a category
through their "Also covers" (`event_vendors.covers_plan_groups`, the 2026-09-21 auto-populate ruling)
showed a bare 🔒 name under Cake / Catering / Bridal Car, which read as a bug. One formatter,
`lib/covered-row-name.ts` (`coveredRowName` + `lockedNamesOf`), now names it on every surface that
draws a covered row: the Find row's collapsed line, the Build line and its dropdown, and the
"This build" / saved-build card rows. A covered Build line no longer repeats the supplier's price
(one booking, one price — the price stays on their own row), and "Book this build" no longer lists a
covered copy twice. A build card keeps its own pick for a covered category before falling back to
the covering supplier. Lab: `/dev/suppliers-lab?covers=1` (Find) and `&tab=build` (Build).
Guard: `lib/a-covered-row-says-why.test.ts` (executed over every wedding row; sabotage x5 red).

SPEC IMPACT: None — implements the owner's 2026-10-21 wording on the shipped "Also covers" rows.
