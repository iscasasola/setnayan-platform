## 2026-09-22 · feat(overview): status stays in view

**PR 5 of the Overview redesign** (owner-approved 2026-09-22) — the last one, and the only purely
visual one.

From **1280px** the flow takes the width on the left and the day + the numbers pin on the right.
The desktop page measured **3,165px**, and everything that tells a couple where they stand — the
date, the countdown, the locked share, the budget, the guest split — lived in the first screen and
was gone for the other 2,200.

The phone stack is untouched: every rule sits inside a `min-width` block, and `space-y-10` stays the
phone rhythm. Measured at 1024 in a browser: `display: block`, `position: static`.

### 🛑 The collision the prototype did not model
**This page already has a sticky right column.** `.sn-inspector-rail` opens at the *same* 1280
breakpoint and takes `clamp(340px, 30vw, 420px)` + 24px while the master reflows to what is left.
Two permanent right columns leave roughly **310px of flow** at 1280.

The prototype this design came from had no inspector — a drawer stood in for it, which is noted in
the prototype's own header. So the drawn layout was never tested against the real three-column
reality, and the collision only surfaced from reading the shipped CSS.

**Resolved by making them yield: one right column at a time.** When
`.sn-inspector-shell[data-open='true']` is an ancestor, the grid collapses to a single column and
the status block stops sticking. Status pins when the inspector is shut (the common case) and steps
aside when it opens.

### Why 1280 and not 1024
The split has to clear the app rail *and* leave the decision groups their two columns. At 1024 the
content box is roughly 780px — `780 − 364` leaves about **416px** of flow, narrower than the two-up
group cards it has to hold. At 1280 it is about `1,038 − 364 = 674px`, which is what the board has
today.

### ⚠ The appearance is NOT verified by me, and auto-merge is deliberately NOT armed
The Overview requires a signed-in session. The dev server has Supabase env, but signing in needs a
password, so I cannot render this page locally — and no test in this repo can mount a 3,000-line
server component that reads the database.

**What I did verify, in a browser, against these exact rules lifted out of `globals.css`:** at 1280
the container computes `display: grid` with a 336px sticky status column; with `[data-open='true']`
on the inspector shell it computes `display: block` / `position: static`; at 1024 it is
block/static. That is the mechanism, not the look.

**Please look at the Vercel preview before merging.** This is a deliberate departure from the
standing auto-merge default (owner-locked 2026-05-15) because that default exists to stop me asking
permission routinely, not to ship an unreviewable visual change to the couple's most-lived-in page.

### Guarded
`lib/overview-status-stays-in-view.test.ts` — the three layout hooks, no inline grid utilities, the
1280 breakpoint with its arithmetic in the failure message, the inspector-yield declarations, and
no unconditional grid outside a media query.

⚠ The yield assertion started as `css.includes("[data-open='true'] .sn-overview-cols")` and a
sabotage that renamed the rule **stayed green** — a neighbouring `> * + *` rule carries the same
prefix. It now matches the declaration, and the same sabotage goes red.

SPEC IMPACT: None beyond the 2026-09-22 `DECISION_LOG.md` rows already applied.
