## 2026-08-17 · fix(shell): the account menu opens in the corner you pressed

Owner, having just got the styling back and opened the account menu: *"sign in
is a pop up on the upper left?"* He had pressed the account button at the **top
right** of the bar. A full-height panel flew in from the **far left**.

🔑 **THE TRIGGER MOVED AND THE PANEL'S GEOMETRY STAYED.** The left drawer was
CORRECT when it was written: the avatar pill was `lg:hidden` — a phone control —
and on desktop this same panel was opened by the **rail plaque** in the
bottom-left, where a left drawer is the obvious answer. Then the pill was
promoted to every width and became THE desktop account menu on **all six** top
bars (admin · account · launcher · event · shop · the shared cluster), and
nobody re-derived where its panel should land. Nothing broke on the day it
changed — the geometry just stopped matching the question being asked.

Desktop is now a 320px card **under the pill, 8px below the bar, 12px in from the
right edge.** Mobile keeps its bottom sheet. The motion changed with it: a
drop-and-fade from under the control instead of a slide from the far edge,
because the movement has to agree with where the thing you pressed is.

🔒 **`SwitcherPlaqueTrigger` keeps its left drawer, deliberately.** Its trigger
really is on the left rail (Plaque-as-Menu, council 2026-07-16). A test holds
that boundary in **both** directions, so a future "unify the two panels" pass has
to read the reasoning before it moves either one.

🪤 **AND THE FIRST VERSION OF THIS FIX PUT THE MENU 2,213 PIXELS DOWN AN EMPTY
PAGE — silently.** I wrote the bar clearance as
`lg:top-[calc(var(--fd-bar,56px)+8px)]`. **CSS `calc()` requires whitespace
around `+`.** Measured in a real browser against the live stylesheet: the parser
**keeps** the declaration — nothing dropped, nothing thrown, no warning — and
computes `top: 2213.2px`. The spaced form computes `64px`. Tailwind's arbitrary
values take underscores for spaces, so the shipped class is
`…56px)_+_8px)]`.

🔑 **This is the same family the repo keeps meeting — the phantom column, the
phantom enum value, the phantom RPC argument, the blocked iframe, the unresolved
`r2://`, the rejected CHECK constraint: the engine DECLINES quietly and the only
symptom is that something is not where it should be.** Add "invalid `calc()`" to
that list. It is caught by an assertion, not by taste.

⚠ **`--fd-bar` CANNOT BE INHERITED HERE, so the fallback is what renders.** The
token is declared on `.fd`; this panel is portaled to `document.body`. That makes
56px a *second* hand-typed copy of the bar's height — the drift this repo has
paid for twice — so the guard pins the fallback to the token's declared value and
fails when **either** side moves (both directions mutation-proved).

✅ **VERIFIED BY MEASUREMENT, on the live page against the real bar:** `top` 64px
against a bar whose bottom is 56px (an 8px gap, no overlap), right edge 12px from
the viewport edge, 320px wide, in the right half, max-height resolving to 544px,
fully on screen. That is the resolved geometry measured in a browser — **not** the
signed-in panel itself, which needs an authenticated session and is covered by
the guards instead.

🛡 `menu-opens-where-you-pressed.test.ts` — 4 assertions, each mutation-checked
by occurrence count (pill panel back to the left drawer 1→0 · fallback drifting
from the token 1→0 · the **token** moving instead 1→0 · the underscores dropped
1→0 · raw spaces instead of underscores 1→0), every one turning exactly its own
test red with the baseline green before and after. It strips comments first: the
component's docblock quotes the retired `lg:left-0` to explain why it is gone.

SPEC IMPACT: None. Presentation of one existing control; no route, price, SKU,
schema, flag or locked decision moves, and the owner-locked Plaque-as-Menu
verdict is untouched.
