## 2026-08-28 · fix(vendor): the laptop gets its two columns — S4

Named as a gap by `cad86bc02`'s own commit message: the guided question already became a column
beside the card, but the card itself still shrank inside the page's centred `max-w-2xl` wrapper —
so a 1400px window drew one small card with the question floating over it, not beside it at full
size.

**What changed, laptop only, and only during the two-question guided pass.** The card is now
`position: fixed`, pinned beside the shared app rail (reading its own `--fd-rail` custom property,
so it clears either rail width — 240px full or the 72px icon strip — rather than a hand-typed
number), at the size couples will actually see it. The content that used to sit below the card
during the pass (recap, publish, "make it richer") is hidden at the same breakpoint — the card has
nothing left in the page's flow to push it down cleanly once it is pinned — but stays mounted, so
every field inside keeps posting.

**What did NOT change.** Both rules live inside one `@media (min-width: 1024px)` block; a phone
renders byte-identically to before. An ordinary edit — outside the guided pass — is still a bottom
sheet at every width, because nothing is being built behind those. No second maker component, no
new fields, no change to field names or the submit.

SPEC IMPACT: None.
