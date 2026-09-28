## 2026-09-28 · fix(guest-hub, prints, maker): the countdown no longer breaks hydration; the Menu editor's one-⋯-per-row shape is pinned; the snap-grid note stops promising free placement

**What a guest sees.** Every guest Event Hub (`/<slug>`) was logging React #418 — "text content
does not match server-rendered HTML" — on every load, measured on prod across three deployments.
The cause was the countdown: `CountdownWidget` read `Date.now()` INSIDE render
(`useState(() => compute(target))`), so the server rendered one second and the phone, hydrating a
moment later, computed another. Reproduced locally, unminified, on the Secs tile (`+ 05` / `- 18`).
Now the clock is read only after mount — both sides render the same shell (`––` in each tile, same
height, nothing jumps) and the first tick fills it the moment the page is interactive. Nothing is
suppressed. Held by `app/[slug]/_components/countdown-renders-the-same-for-any-clock.test.ts`:
the server markup is byte-identical at three unrelated instants, so a `Date.now()` moved back into
render goes red here before it reaches a guest's console.

**What the couple sees in Prints & Tickets → Menu card.** The dish rows already shipped on the
train as ONE full-width field + ONE "⋯" (Move or remove …) per line, with the labelled strip
(Up · Down · Remove / Earlier · Later · Remove moment) opening only for the tapped row — verified
in a 375 px browser: input 263 px wide, every target 44 × 44. No rebuild (RULE 0); the shape is now
pinned by `launch/_components/print-menu-editor-one-more-button-per-row.test.ts` (per moment exactly
dishes + 1 "⋯", no arrow buttons and no strip while closed, "Dish N of <moment>" labels kept,
every control `min-h-11`).

**What the couple reads in the Maker's More ▾ menu.** The snap-grid note no longer says "Placing
things freely comes in the next build." — the owner ruled the canvas keeps its rails (2026-09-23,
"rails on"; `DECISION_LOG.md` 2026-09-27 rows repeat it). Only `MAKER_COMING_NEXT.snap` in
`maker-bar.ts` changed, to stay clear of #6068.

SPEC IMPACT: None — no product decision changed; the copy edit brings the Maker in line with the
"rails on" ruling already in `DECISION_LOG.md`.
