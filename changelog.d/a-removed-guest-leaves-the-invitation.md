## 2026-09-14 · fix(invitation): a guest the couple REMOVED is off their invitation

**Found by the owner, on his own wedding page, hours after I shipped the bug.**

`guests` deletes **softly** — the row stays with `deleted_at` set — and
`loadEntourage` shipped without `.is('deleted_at', null)`. So two people the
couple had removed that morning were still printed on the public invitation:

| Who | Role | Removed |
|---|---|---|
| Indalecia Casasola | Best Man | 2026-09-14 05:29 |
| Judge Glenn Subia | Principal Sponsor | 2026-09-14 |

🔑 **It did not present as a deleted row. It presented as a DUPLICATE** — the same
name twice — because the live row and the removed one differ only in a column
nothing renders. I reported it to the owner as duplicate data to clean up,
**twice**, and he corrected me from his own screen both times: *"i can only see 1
indalecio and 1 indalecia"*, then *"i also only see 1 subia"*. Indalecio (the
groom) and Indalecia (the best man) are two different people; there was never a
duplicate.

⚠ **And the query I diagnosed it with had the same omission as the code I was
diagnosing**, so it confirmed my wrong answer. A second query written by the same
hand is not a second opinion.

⚠ The convention was never in doubt: **every other guest read in the repo already
filters it** — one forty lines above this in the same file, four in
`lib/guests.ts`. This read was the only one that missed it.

### The guard

`a-removed-guest-leaves-the-invitation.test.ts` asserts the SOURCE of the query,
because a pure function cannot see a missing `WHERE` clause. Red against the
shipped read, green with the fix.

🪤 **Its first cut failed against its own fix.** This repo's `stripComments`
replaces a comment with **spaces of the same length** so offsets survive — so a
fixed-size character window is mostly blank once a docblock sits in it, and the
line being looked for falls off the end. Whitespace is collapsed before matching
now, and the docblock says why.

⛔ **A rule this file deliberately does NOT assert:** "every guests read in
loaders.ts filters `deleted_at`". I wrote it first and it is **false** — the
file also looks a single guest up by `guest_id`, where the filter is neither
present nor wanted. A guard stating an untrue rule is worse than none: it goes
red for correct code, and the next person weakens it instead of reading it.

SPEC IMPACT: None — a missing predicate, not a decision.
