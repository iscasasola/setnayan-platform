## 2026-09-22 · feat(overview): a date is not a decision, one rank mark, and the minis that expired

Three owner rulings off the Overview redesign prototype (`prototypes/event_overview_redesign_2026-09-22/`),
approved 2026-09-22. Measured live the same day on event `044f7e64`: **662 words · 40 controls ·
6.2 phone screens**, and a board that said **"9 open decisions"** when four things needed the couple.

**1 · A date is not a decision.** Six of those nine were recommended deadlines and scheduled
blocks — rows nobody resolves by reading them. They leave the board and get their own heading,
`Coming up · N dates`, drawn by the SAME renderer, with the same rows, ids, chips and links. The
digest now reads `4 open decisions · ranked · 6 dates coming`, so the smaller number cannot read
as "we lost six things".

🔑 **The page was already disagreeing with itself about this number.** Two inches above the "9",
the Sai briefing said *"2 decisions need you"* — it counts `cockpitModel.decisions`, which never
included payments or dates. One screen, two counts of the same noun.

The split is a **pure sibling**, `lib/a-date-is-not-a-decision.ts`, not four lines inside a
3,000-line `server-only` component that no test can import. It also makes the regression
unwritable: a dates group handed to the board is pulled back out instead of inflating the count.

**2 · One rank mark, not two.** The board printed `PRIORITY 1`, `PRIORITY 2`… down a list already
in that order — the word and the position said the same thing, and the word was the widest element
in the group header. The number stays and becomes the mark (gold, 28px circle); the word moves to
`aria-label`, because it carried the meaning for anyone not looking at the colour. The free state
keeps its plain item count: there is no ranking without Sai, and a rank number there would be a
lie about how the list was ordered.

**3 · After the day, two minis stopped being true.** Guests (*"77 still to reply"* — nobody is
going to reply now) and Schedule·next (*there is no next*) are gated on `!eventHasHappened`.
**Budget, Messages and Papic deliberately are not** — a balance and an unread thread are still true
the morning after. `FinishedEventSummary` already reports who actually came.

🛑 **Papic was in that list, and CI took it back out — correctly.** `papic-home-tile.test.ts` pins
an owner ruling of **2026-07-30**: *"always hold a slot. since that is the foundation of the app."*
— which had already reversed an earlier cut that gave Papic a slot only when one was free. Gating it
here would have re-introduced exactly that, one phase later. It also never needed gating: `preCapture`
already flips the tile from "N shots ready" to "N photos in" on the first capture, so after the day it
reports what arrived. **A tile that restates itself was never holding an expired fact.** The guard now
asserts Papic stays ungated, so the mistake cannot be made twice.

**Guarded, and the guard was probed.** `lib/a-date-is-not-a-decision.test.ts` executes (1) and (2)
against the pure module and reads the component's source for (3), printing every occurrence count.
Sabotage runs: hand-rolling the count beside the split goes red ✅; un-gating a mini that must stay
gated goes red ✅. A first attempt at a third assertion — a ban on the phrase
`groupsUnordered.push(deadlineGroup)` — stayed **green** against `…(deadlineGroup as never)` and was
replaced with the property it was standing in for.

SPEC IMPACT: `DECISION_LOG.md` row dated 2026-09-22 (applied) + `prototypes/event_overview_redesign_2026-09-22/`.

⚠ **Unchanged, and flagged rather than taken:** the dates block is still `aiActive`-only, exactly
as `deadlineGroup` has been since it shipped — giving the free page a dates rail would hand over
part of what Setnayan AI sells, which is an owner call.
