## 2026-08-21 · feat(story): a story opens only once its celebration is over

Owner 2026-08-21: *"editorial will unlock only after the event"* — and the story
lives on the **Untold** shelf of My Events, the place a celebration lands when it
leaves *Coming up*.

Before the day there are no photos, no moments and nobody to hear from, so the
editor was a set of empty boxes asking a couple to invent their own wedding.

🔑 **THE GATE IS THE SHELF, NOT A SECOND DATE RULE.** `storyGate` delegates to
`isFinishedEvent` — the same test that moves a card off *Coming up* — so the board
and the story can never disagree. A card cannot sit on Untold while its story says
"not yet", and it cannot be told while the card still says *Coming up*.

🪤 **THE FIRST DRAFT OF THIS FILE BROKE ITS OWN RULE.** It re-collapsed
`event_end_date` itself before calling the shared helper — a second answer to a
question the board already answers, written three lines under a comment warning
against exactly that. `isFinishedEvent` already knows both that an archived event
counts as finished and that a multi-day celebration ends on its LAST day.

⚠ **THE PH-LOCAL DAY DECIDES.** 16:30 UTC on the 18th is already 00:30 on the 19th
in Manila — a wedding on the 18th IS over for the couple, and a UTC comparison
would refuse them their story for another seven and a half hours, on the morning
they are most likely to look.

**A dateless celebration is OPEN**, deliberately. There is no day to wait for, so
refusing would be a wait with no end — and prod carries such events.

**It reads as a WAIT, not a refusal:** no danger colour, no "you can't". It names
the date, says the first draft arrives the morning after built from their own
schedule and photos, and offers the way back.

**Guards:** 7 assertions, all 4 sabotages mutation-checked with counts printed
before → after, all RED — including one that pins the gate and the board giving
the SAME answer across four event shapes.

⏭ **NEXT SLICES** (prototype approved, not built): moments named from the couple's
own run-of-show instead of an even time-split; columns they write, add and remove;
the plain editor over the magazine fields; the three audiences.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-21 already records the ruling.
