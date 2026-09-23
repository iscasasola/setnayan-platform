## 2026-09-23 · fix(people): Alaga answers its own empty state and carries its own way in

Owner, pointing at the live heading on `/dashboard/people`: *"Alaga should be
together meaning Alaga will have a button to create an alaga under it same to
samahan."*

### A heading with nothing under it

`dependents-section.tsx` rendered its list **or `null`**. Null is not an empty
state — with no alaga yet the page drew the word **Alaga**, then the word
**Samahan** directly beneath it, with nothing in between and no way in. Samahan's
section in the same column has always answered its own empty state (*"No samahan
yet. Create one…"*), so one page held two different ideas of what an empty list
looks like, and only one of them told you what the thing was.

The empty branch now says what an alaga is and what happens to it, and the
section carries `<AddAlagaButton />` — the same button, opening the same drawer,
nothing about the form changed.

### ⚠ The duplication is the ruling, not a leftover

`Add an alaga` now appears **twice**: in the page's top action row and inside the
Alaga section. Both are owner rulings and neither is a cleanup target —

- the top row is **2026-08-22** (*"where the buttons live add an alaga, new group
  (samahan)"*), already pinned by `the-buttons-live-together.test.ts`;
- the in-section door is the ruling above.

Samahan offers **both** too — "New samahan" at the top and "Create one" in its
section — which is precisely what *"same to samahan"* asks for. The obvious
tidy-up (notice the repeat, delete one) would silently revert one of the two, so
`alaga-has-its-own-door.test.ts` asserts **both ends** and goes red either way.

🔑 That guard **strips comments before matching**, because the fix's own
explanatory comment names `<AddAlagaButton>` in prose — an unstripped source
match would have been satisfied by the paragraph explaining the button even if
the button itself were deleted. Probed in both directions: removing the button
and restoring `: null` were each confirmed to turn it red before the tree was
restored.

SPEC IMPACT: `DECISION_LOG.md` — row added 2026-09-23 recording the in-section
door and why the pair with the top action row is deliberate.
