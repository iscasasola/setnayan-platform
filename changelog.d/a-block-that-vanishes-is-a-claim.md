## 2026-08-24 · fix(dashboard): a block that vanishes is still a claim

Second pass over the same class. The first PR fixed the screens that SAID
something false; these are the ones that said nothing at all — a refused read
returned `null`, the block disappeared, and its absence read as "there is
nothing here". Silence is a claim when the alternative is a supplier waiting,
a message unreviewed, or a form that overwrites what it failed to load.

What changes for a person:

- **Guest messages** — the review queue disappeared entirely on a refused read,
  so an event where guests had written looked like an event where nobody had,
  and nothing reached the wall.
- **A supplier's Papic challenge** — waited for an okay that was never asked for.
- **Photos taken by suppliers** — the read beside it already refused to claim
  "no supplier has taken photos"; the claim arrived one read later anyway.
- **Your host's plan** — the whole block left the schedule without a word.
- **Pakanta** and **Editorial** — the worst two: the form opened blank and
  **saving writes the blank over what the couple wrote**. Both now say so before
  they start typing.
- **Live Studio** — "not connected" about a channel that was connected, one
  click from re-authorising something that was fine.
- **Photo recap** — told a couple who had connected Google Drive to connect it.

Twenty-nine more reads across the tree bind and log their error without changing
what is shown, because the existing direction is already the right one: an
access gate that fails closed, a name that falls back, a browser-tab title.
What they were missing was any trace at all.

The couple's supplier page keeps its documented fail-open exactly as written —
it can only ever show MORE, never hide a category, and that is a decision, not a
defect. Its three reads are logged, not rewritten.

`app/dashboard/reads-are-honest.test.ts`: the bill goes **69 → 16 sites**, and
**zero of the sixteen are in the couple's event tree** — all sit in
`(account)`/`(launcher)`, outside this session's territory. Positive control
extended to the seven new gates; mutation-measured.

SPEC IMPACT: None.
