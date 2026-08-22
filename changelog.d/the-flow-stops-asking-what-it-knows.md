## 2026-08-20 · feat(onboarding): the create flow stops asking what it already knows

Three defects the owner found in one walk from *Your Year* into a birthday, all the
same shape — a question whose answer the flow was already holding.

**"it asked if its mine."** The celebrant screen had already been changed to say
*"This one's yours"* and to suppress the autofocus, but the text field still rendered
underneath. A box with a cursor in it is a question whatever the heading says. It now
shows the answer as the `For … · Change` chip the create picker already ships —
reproduced, not redrawn — and the field is one tap away. The refusal that tells you
*"put their name above"* forces the field open, because a folded field beside that
sentence would be the dead end that screen exists to fix.

**"it should be when do you want to celebrate it?"** That exact title, and the three
day chips under it, were already coded — gated on a value only the anniversary-only
anchor screen ever writes, so every birthday got the plain *"When is it?"*. The
trigger is widened to any day already known. 🪤 The carried day is deliberately NOT
poured into `anchorDate`: an anchor is what an event commemorates rather than when it
is held, and `anchorOrigin` defaults to the literal `'wedding'`, so a birthday would
have rendered **"Our wedding falls on Wed 16 Dec 2026"** — naming a wedding that does
not exist.

**"it also knows my birthday to be 40th. why do i get asked for this?"** The Year row
prints the age and threw it away at the hop. It now crosses in the same
sessionStorage carry as the day (the age, never the birth date — the smaller fact
that answers the question), and answers the bracket. ⛔ The screen is **skipped in
transit, never removed**: removal shifts every later index, `screens[step]` is read
with a non-null assertion whose next line calls a string method on it, and it would
disarm the "you already have one of these" walk-back for exactly the people it
targets. A bracket the person chose themselves always wins.

**Then the owner sharpened it:** *"since we already know it is for his birthday, then
it is not a question of what type of party."* The skip only fired when a Year row
handed over an age, so the same birthday created from the Create button still asked.
The age now also comes from the signed-in person's own profile — a blank celebrant has
always meant "mine" — so the question is answered at every door into the flow. It is
deliberately NOT routed through the prefill seam, which is gated by a fail-closed flag
holding back a wider brief: a fix built behind it would ship switched off. Typing a
celebrant name puts the question back, and a stored answer that differs from the
derived one keeps its screen rather than being hidden with no way back to it.

**And the owner's reasoning exposed a hole in the mapping itself.** He said: *"i am
turning 40. that is not a kids' party. that is an adult party since that is already
above 21 (debut for men)."* His case was already right — but the line between a
child's party and an adult one had been a hand-picked **12**, so a **thirteen-year-old
resolved to "An adult birthday"**, which is his own correction pointed the other way.
The boundary is now the **debut age**, read from the app's own ladder rather than
re-typed: 18 for women, 21 for men. Past it is an adult birthday; at it is the debut;
below it **no option is true, so the flow asks** instead of guessing. Ages whose
meaning depends on a sex not on file (19, 20) are asked too. 40 is above both debut
ages, so it still answers without one.

⚠ The four birthday options do not match the owner-locked milestone ladder (1 · 7 ·
18/21 · 60 — there is no 50). The mapping deliberately follows what the labels SAY;
reconciling the two is a copy decision, flagged rather than made.

SPEC IMPACT: DECISION_LOG.md 2026-08-20.
