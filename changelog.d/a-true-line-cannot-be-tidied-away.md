## 2026-09-16 · test(papic): the true "reads in chapters" line is pinned to its mechanism (PAP-11)

`papic-page-says-only-what-is-true.test.ts` is a wall of **prohibitions** — claims that must not
creep onto the public Papic page. The risk on this one line is the **opposite**: it is TRUE, and a
reader can tidy it off.

`lib/papic-chapters.ts` ships and groups one gallery by how far from the day each photo was taken
(*"3 months to go" · "12 days to go" · "The day"*), read by `papic/pool/_components/pool-grid.tsx`
and `papic/me/[token]/page.tsx`.

🔑 **The trap is that the same file warns "the year" is UNBUILT**, and a gallery reading in chapters
is a different thing wearing the same word. A reader clearing unbuilt claims has every reason to
delete a true one — and until now **nothing would have failed.** The file said so itself:

> *"The chapters line is still unpinned; that belongs to whoever owns that copy, and is recorded
> rather than silently adopted here."*

Recording it instead of quietly adopting it was the right call then. This is the row that closes it.

**Pinned to the MECHANISM, not only to the words.** Two assertions: the claim is on the page, and
the module that makes it true still exports its chapter type. If the gallery ever stops grouping
that way, the second fails first and forces a decision — **a guard that keeps a sentence alive after
its mechanism dies is worse than no guard, because it makes a false claim load-bearing.**

Matched on the claim rather than the exact sentence, whitespace-normalised: the wording may be
improved, the promise may not quietly leave.

### 🛡 Mutation-checked — and the first attempt was a vacuous pass in reverse

The first version asserted `captured_at`, **guessed from a docblock rather than read from the
module**. It failed on the untouched tree — so both "sabotages" went red against an **already-red
control and proved nothing**. Rekeyed onto `PapicChapter`, the type the module actually exports.

| run | landed | result |
|---|---|---|
| control | — | **18 pass, 0 fail** |
| tidy the true line off the page | 1 → 0 | **RED** |
| the mechanism dies (`PapicChapter` renamed) | 5 → 0 | **RED** |
| control after restores | — | **18 pass, 0 fail** |

🔑 **A control must be green before any sabotage means anything.** Two red runs against a broken
test look exactly like two successful sabotages.

SPEC IMPACT: None — pins an existing true claim.
