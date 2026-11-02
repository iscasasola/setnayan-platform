## 2026-09-16 · docs(hub): a settled decision stops being described as open (PAP-26)

`lib/event-hub-control.ts` said, of the named-guest preview, that rendering an actual named person
*"remains unbuilt and unruled"*.

**It was ruled on 2026-09-14** — *"Preview as a guest" shows a GENERIC guest, never a real named one,
on both pages* (DECISION_LOG.md, the owner's Part A acceptance). The fabricated seat-holder **is the
answer**, not a placeholder for one.

### 🔑 A stale "open" costs more than a stale "done"

A session sweeping for open decisions greps exactly these phrases, finds one, and puts a **settled
question back on the owner's desk.** That happened repeatedly in the week this was written: rows
marked open were closed, a "CONFIRMED OPEN" privacy leak had been fixed three days earlier, and a
badge deadline that did not exist reached the owner twice.

**"Done" gets checked, because somebody wants to use the thing. "Open" gets ACTED ON.**

### What the guard pins, and what it deliberately does not

It does **not** ban the phrases. Plenty of questions are genuinely open and saying so is the honest
thing — `IDEAL_PHOTOGRAPHS_PER_GUEST` in `(shell)/papic/page.tsx` says *"awaiting the owner"* and
that is **true today**: it is a guessed number sizing a recommendation on a public page, which is
exactly the class the owner ruled "don't guess" about. It is left alone and flagged, not tidied.

Two claims are pinned: the phrase does not come back, **and** the correction carries the ruling's
DATE. A docblock that merely stops saying "unruled" leaves the next reader unable to tell a decision
from an omission — the same ambiguity, one step quieter.

### 🛡 Mutation-checked — and the first version failed its own control

| mutation | landed | result |
|---|---|---|
| control | — | **2 pass, 0 fail** |
| restore the stale claim | 0 → 1 | **RED** |
| drop the ruling date | 1 → 0 | **RED** on the second assertion |
| control after restores | — | **2 pass, 0 fail** |

🔑 **The control was RED on the first attempt because my own correction QUOTED the phrase it bans.**
A text scan cannot tell prose *about* a phrase from the phrase itself — and stripping comments is no
help when the thing being guarded lives entirely in a comment. The note now **describes** the stale
wording instead of repeating it, and says so, so the next editor does not reintroduce the collision.

SPEC IMPACT: None — records an existing ruling where a reader will meet it.
