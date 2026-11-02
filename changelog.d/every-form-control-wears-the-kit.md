## 2026-08-24 · change(vendor): every supplier form control wears the kit recipe

W4-B, PR 2. The input-recipe half of the convergence is finished: the 26
remaining hand-typed copies of the form-control class string (calendar
surface + day page, proposals surface + reuse inbox, the caterer's production
sheet) now import `shopInputClass` from the tree kit. Prefixed variants
(`w-24 …`, `min-w-40 flex-1 …`) become template literals over the same
constant. Zero visual change — the constant IS the string they carried.

`kit-convergence.baseline.json` regenerated: the `input` recipe now has ZERO
hand-rolled copies anywhere in the supplier tree; any new one fails the
guard. Typecheck ✅ · reads-are-honest ✅ (calendar/surface is on its pinned
list) · kit-convergence ✅.

SPEC IMPACT: None.
