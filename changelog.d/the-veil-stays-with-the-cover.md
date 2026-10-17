## 2026-10-17 · feat(veil): the lifted veil stays with the cover and returns with it

Owner, verbatim, on live `/cale-ice` after an unveil: *"the veil disappears. it shouldn't. it should stay until cover
is gone. and return when cover scene returns"*. Off the Save the Date, the overlay retired the lifted veil ~1.8 s after
the lift. Now, from the unveil on, the lifted drape stays on the Cover Scene while any of it is on screen, rides the
cover's top edge out as the guest scrolls into the event, is hidden with its WebGL cloth paused while the cover is off
screen (one IntersectionObserver), and comes back with the cover. It never closes again (`keepsOpen`: the hit-zone goes
inert at the unveil, a swipe down no longer re-covers). Save-Data / reduced motion draw the settled drape still. The
Maker's ▶ preview (`preview` mode) and the Save the Date's valance are unchanged. Guarded by
`apps/web/app/[slug]/_components/reveal/the-veil-stays-with-the-cover.test.ts`.

SPEC IMPACT: supersedes, for the drape, the 2026-09-25 reveal-stages ruling "once opened it is gone for the visit"
(`lib/reveal-stages.ts` docblock). DECISION_LOG row to be recorded by the controller (builders do not edit the corpus
checkout this round).
