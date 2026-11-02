## 2026-09-20 · feat(invitation): the page opens on the mark, not on a box about the reader

Owner, reading his own invitation: *"it starts with the logo like when you enter a place you see
their logo on their building."* An identified guest met a status card — *"Hi again, <name>"* —
with the couple's monogram a screen and a half below it.

The hero now runs FIRST in the guest branch. Everything personal moves below it: the spotlight
card, the guest status card, the home-screen offer and the account prompt. **Nothing is new and
nothing is removed — only the order changed**, so every mount still appears exactly once.

A shared phone also stops announcing whose invitation it is before it says whose wedding it is.

First slice of the Event Hub arrival design (the canvas the owner approved on 2026-09-20). The
sticky state-labelled action, the pass and the day-of rearrangement are separate slices.

Guarded by `the-invitation-opens-on-the-mark.test.ts`, which reads POSITIONS rather than presence:
a test that only asks "is the card mounted?" passes just as happily with it back on top. Moving the
card above the hero turns two of its four cases red.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row — the arrival order.
