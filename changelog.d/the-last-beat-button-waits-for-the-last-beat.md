## 2026-08-24 · fix(a11y): the film's finale button waits for the finale

The save-the-date film's terminal beat renders an accent **"Add to calendar"**
button. It was gated on the calendar link existing and nothing else — not on the
beat being active.

**Measured on the live production build, before any veil lift:** that anchor sits
inside an `aria-hidden="true"` beat, has non-zero size and `tabIndex >= 0`. It is
**keyboard-reachable from frame one** — while the veil still covers the screen,
before the music, the clip or the gallery have played.

🔑 **The file already knew, and said so eight lines below.** The rule is written
out in full for the "See our page" exit button, which *was* gated correctly:
*"aria-hidden and pointer-events-none NEITHER remove an element from the tab
order."* **The comment sat between the two blocks, attached to the one that
obeyed it** — so a reader met the unprotected control first and the rule second.
It now sits above both, because the rule is about the beat, not about either
button.

⚠ The **persistent** chip in the film's chrome is a different control and is
deliberately left on `started`, so a guest who leaves early can still take the
date. A test fails if someone "consistency-fixes" it onto the beat gate.

Extends the existing guard rather than adding a second one. The new coverage is
**derived, not hand-listed**: it bounds the closing beat and requires every
interactive element in it to sit behind an `idx === closeIdx` conditional — 2
controls, 2 gates. A hand-enumerated list is a list of the controls you thought
of, which is exactly how this one survived.

🪤 Two measurement faults caught while proving it, both mine: the first cut of
the derived scan fell through to an arbitrary 4000-character window and counted
`active={idx === closeIdx}` (a prop, not a gate) as a gate — 3 gates for 2
controls, so it would have passed with one control ungated. And a mutation
printed `DID NOT LAND` because the counting script had **crashed**, not because
the sabotage failed.

4 mutations, all measured, all red.

SPEC IMPACT: None — no copy, price, SKU, schema or locked decision. The finale
button is unchanged in appearance and still the film's closing call to action.
