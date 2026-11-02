## 2026-08-21 · feat(frontdoor): the group chat, and the ones who couldn't fly home

Finishes the front-door concept the opening began. Owner chose to complete it
rather than stop at the headline.

**Two blocks, above the feed.** *"You have this group chat."* — four beats with
widening gaps: `PICS PLS` on day 1, `sino may video ng vows?` on day 4, a
`Seen` on week 3, and on month 11 **Tita left the group.** Then the caption
(*nobody deleted anything, nobody decided anything — forty phones went home with
forty albums and none of them was yours*) and the turn: *it was never a storage
problem, it's a gathering problem, so we built the gathering.* Then one short
block for the family abroad: three o'clock in Bulacan, ten in the morning in
Riyadh, watching live.

🔑 **THE HUMOUR IS LOAD-BEARING.** Without it this is an advertisement about
regret aimed at people planning the most expensive day of their lives. The joke
is what makes it an arm around the shoulder instead. Keep it.

🔑 **IT MUST NEVER LOOK LIKE A REAL SCREENSHOT, AND A TEST ENFORCES THAT.** No
avatars, no sender names, no app chrome — monospace timestamps and plain
bubbles. We have near-zero customers, so a vignette mistakable for a real
person's messages is a **fabricated testimonial**, the one thing the whole brief
forbids. Mutation-proved: adding an avatar turns the test red.

🔑 **AND NO GUILT.** The family-abroad block offers something you can SEND; it
never says *"don't let lola miss it."* Asserted on the vocabulary, because tone
erodes one edit at a time. Mutation-proved: that phrasing turns it red.

**It renders on the feed branch only.** Somebody who typed a query wants their
answer, not the marketing argument pushed above it — `/?q=` is byte-identical to
before.

**Neutral grey, not beige.** `--fd-wash` is `#f3ecdf`; the owner asked for the
page to stop being beige, so the vignette gets its own `--fd-panel: #f4f4f5`.
Measured: timestamps and caption `--fd-m1` **4.90:1** on that panel, bubble text
ink **14.28:1**, story body **5.38:1** on the page. `--fd-m2` was rejected —
**3.34:1**, it would fail.

Semantics: a `<figure>` with a real `<figcaption>`, beats as an `<ol>`, so a
screen reader gets the same four in the same order rather than a decorative blob.

🪤 **MY OWN BRANCH CHECK WAS PROXIMITY-BASED AND CRIED WOLF.** It looked for the
story within 200 characters of `<FrontDoorResults>` — but the two halves of the
ternary sit that close together, so it matched ACROSS the boundary and reported
a defect that did not exist. Rewritten to split on the ternary's own `) : (`.
**Bound a check by structure, not by characters.**

🛡 `the-group-chat-went-quiet.test.ts` — 5 tests, 13 assertions, mutation-proved
outside the toolchain.

Not verified locally: no `node_modules`, `npm run build` cannot complete here,
and **nobody has seen it rendered.**

SPEC IMPACT: `DECISION_LOG.md` row with the front-door opening.
