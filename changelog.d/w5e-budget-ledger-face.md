## 2026-08-25 · fix(budget): the supplier money figures wear the ledger face

Each supplier card on the budget screen printed **Budget / Paid / Remaining**
with the label in Space Mono and the figure in the body face, while the two
other money stat blocks on the same screen set both in mono. The visible
consequence: the word *Paid* appeared twice on one screen in two different
typefaces — "Paid so far" over a mono figure in payment progress, "Paid" over a
body-face figure on every supplier card below it.

The binding Ledger archetype (`prototypes/archetype_data_roster_ledger_
comparison_2026-08-01.html`, route chip `/dashboard/[event]/budget`) states the
rule in its own words: *"every numeral right-aligned in Space Mono like a bank
book… Magnitude scans down one edge."*

Found by the adversarial audit of W4-A, which corrected that stream's own claim
that "budget already speaks the Ledger register" — the sweep behind that claim
matched a colour's NAME and could not see a typeface at all.

New guard `app/dashboard/[eventId]/budget/money-wears-the-ledger-face.test.ts`:
the file set is RESOLVED from the budget tree's own imports (the defect lived in
a shared component one directory up — the file a hand-written list omits), the
stat components are found by SHAPE (a component taking both `label` and
`value`), and a floor asserts the shape still matches so an empty sweep cannot
pass silently. Prose money is deliberately out of scope — the archetype governs
the column of amounts, not sentences.

SPEC IMPACT: None — this closes a delta against an already-approved archetype;
no decision changes.
