## 2026-08-24 · fix(guards): one-word-two-numbers pins the MEASURE, not the wording

`one-word-two-numbers.test.ts` exists to stop the account home quietly adopting
the event page's **vendor-lock** percentage — two different numbers were wearing
one word ("% planned"), and the fix was to caption them apart.

One of its assertions pinned the **literal** `${pct}% planned` in home. That made
it a guard against a fix: the board then had to remove that exact caption for an
unrelated and correct reason (**D-6** — the ring already prints the figure, so
`7%` sat beside `7% planned`), and this assertion failed a change it has no
opinion about. **That is the one thing a guard must never do.**

It now pins the **measure**: home must still derive its own checklist
`done / items.length`. Its sibling assertion already holds the other half (home
must not read `briefing.lockedPct`). Between them the original harm is fully
covered, and a caption may change without asking this file's permission.

### Verified in all three states

| | result |
|---|---|
| current `main` (caption present) | **passes** |
| with #4805 applied (caption removed) | **passes** — this is what unblocks it |
| home adopts `briefing.lockedPct` (the real harm) | **red**, tests 3 *and* 4 |

Measured by occurrence count: the checklist derivation goes `1 → 0` and the guard
goes red.

🔑 The general shape, worth more than the fix: **a guard that pins a string
outlives the reason it was written; a guard that pins the measure does not.**
This one vetoed a correct change for four hours.

lib suite 7805/7805.

SPEC IMPACT: None.
