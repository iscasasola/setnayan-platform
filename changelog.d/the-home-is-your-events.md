## 2026-08-19 · design(home): the account home is your events

**SPEC IMPACT:** Reverses the four-surface home of 2026-07-15 — **on the owner's
explicit instruction**, logged below so a future session does not "restore" it.

Owner 2026-08-19: *"make the page just your events."*

**Why the July design stopped being right.** It gave the home four surfaces —
Events · Alaala · Yours to run · People — because at the time the rail had none
of them. **The rail grew rows for Alaala, People and Your Story afterwards**, and
the home kept showing the same things. Four rail rows and one page were doing the
same job. That is drift, not a decision.

### Removed — 305 lines of bento plus the status board

The status tiles · the Alaala tile · creator benefits · the Setnayan-AI watch ·
"Yours to run" · the People tile · the memory wall · the year strip, and the data
that fed them.

**Every destination they owned survives**, verified per-link by a 58-agent
mapping pass, then re-verified by skeptics told to refute each "still reachable"
claim. `lint-port-no-lost-controls` reports exactly **one** removal —
`/dashboard/library?tab=vendors` — whose "Saved vendors" chip sits on Alaala
itself, one rail click away. Baseline regenerated and measured: 402 routes before
and after, **1** destination, **0** actions.

### Kept, and each for a reason

- **The phone's bottom nav.** Below 1024px the rail is `display:none` and the app
  variant renders no hamburger — it is the phone's **only** navigation.
- **The needs-you nudge, PROMOTED to every width.** It lived inside `sm:hidden`
  as the phone's stand-in for the desktop Watch tile. This PR deletes **both**
  desktop carriers of that number, so left alone, the one thing on this page a
  couple must ACT on would have existed on phones only — invisible on the screen
  most people plan from.

### The title, and the defect it was hiding

**"Where to?" is gone. The h1 is "Your events".** It was a router's question for
a page offering five kinds of destination; over two labelled shelves it asks
something the page has already answered.

⚠ **And the zero-state had to go with it.** It read *"Let's set up your first
event."* whenever the board was empty — but `fetchUserEvents` **degrades to `[]`
on every error** (`lib/events.ts`, "collapse to graceful-degrade-always" after a
re-throw crashed every dashboard twice). An empty list **cannot be told apart
from a refused read.** While four other blocks rendered, that was a bad line in a
corner; on an events-only page it is the **entire screen** shown to somebody with
six weddings whose read just failed. The title now obeys the rule the FINISHED
shelf twelve lines below already states: *say what this is FOR, never that you
have none.*

### Four guards changed, none weakened

| guard | what happened |
|---|---|
| `an-invited-person-is-recognised` | both assertions pointed at deleted code. Rewritten to pin the **stronger** rule: the page makes **no zero-claim at all**. Counting the merged set fixed *which* events were counted; claiming nothing removes the failure mode. |
| `alaala-is-memories` | repointed from the home to Alaala's own page, which mounts the same shared body. |
| `open-shop/has-a-doorway` | the launcher assertion deleted (the switcher carries the same door behind the same gate); the wording test narrowed to the one surviving doorway. |
| `two-levels-and-the-board` | the per-state title assertion updated to the claim-free one. |

Verified: `tsc` clean · 8714/8718 (4 pre-existing missing-module failures) ·
lost-controls ✅ after an audited regeneration.
