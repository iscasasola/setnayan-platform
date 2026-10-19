## 2026-10-19 · fix(hub): Home lands with the cover fully gone, so the bars stay

The one-page Invitation (owner 2026-10-15, approved prototype §1, Q3: "Home lands on the welcome line, so the
bar never re-hides itself") already ships; walked live signed-out on `maria-and-jose` and `marco-marga` at 375
(Chromium) and in the iPhone 13 engine (WebKit) point by point. One point did not hold: a tap on Home stopped
152 px above its mark (the root's `scroll-padding-top: 4.5rem` plus the mark's own `scroll-mt-20`), so the
cover's door came back on screen and — by the 2026-10-16 rule (bars only once the cover is fully gone) — both
bars left on the guest's own tap. The Home mark (`[data-home-after-cover]`, `app/globals.css`) now cancels the
root's padding and lands 2 px past the cover's edge; `site-body.tsx`'s mark drops its `scroll-mt-20`. Guarded by
`app/[slug]/_lib/the-invitation-is-one-page.test.ts` 7 (the stop computed from the shipped stylesheet, with and
without the top bar; four sabotages seen red). Guest-page goldens regenerated (the mark's class string only).

SPEC IMPACT: None — implements the approved 2026-10-15 Q3 answer under the 2026-10-16 cover rule; no new ruling.
