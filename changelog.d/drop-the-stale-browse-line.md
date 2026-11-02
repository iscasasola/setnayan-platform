## 2026-09-08 · fix(explore): the marketplace stops typing its own size

Owner, looking at a filtered marketplace: *"we also do not need the browse line
since we are already browsing the whole taxonomy"* — and, separately, asking
whether "192" was still right.

Both halves were wrong, and only one of them was the wording.

**The link pointed at the page you were already on.** The context strip sat
outside every conditional above it, so it rendered on EVERY grid page. Unfiltered,
"Browse all 192 categories" linked to `/explore?match=0` from `/explore`.

**And 192 stopped being true.** It was typed by hand when `TAXONOMY_MAP` held 192
entries. The map now holds 288 (measured, not recalled: 263 marketplace-visible,
76 public tiles, 16 folders). The marketplace was advertising a third fewer
categories than it has, on a public page, with nothing able to notice.

Removing it strands nobody — checked before deleting, not assumed:
`filter-drawer.tsx` has a pinned Clear whose visibility is driven by whether any
filter is active, reachable from the sticky header's Filters button, and the
zero-results EmptyState carries its own "Clear all filters". The filter SUMMARY
stays (it says what you are narrowed by, which nothing else on the grid tells
you) and now renders only when there is something to say.

🔎 **The guard added here immediately found a second one.** The scoped-folder
banner told couples *"the other 11 folders are hidden"* — 12 minus 1, from when
there were 12 folders. There are 16. That one is user-facing copy, and it had
been wrong for longer than the link. The count is dropped rather than re-typed
or derived: the set the sentence means could not be verified from the component,
and inventing a number I cannot check is the same defect wearing a newer digit.

The guard strips comments first (the repo's one stripper) — a raw scan would
fail on its own docblock, the trap `studio-buy-hero.tsx` records tripping. Its
first version also shared one `/g` regex across assertions and so skipped
matches via `lastIndex`, reporting a file clean it had not finished reading;
the pattern is now built fresh per use, and a test asserts the guard can fire.

SPEC IMPACT: None. No capability, price or locked decision changed — a stale
number and a no-op link removed from one surface.
