## 2026-10-25 · fix(search-pin): the first hit lands under the section head that will stick over it

Owner, live on the Guest list (searching "Buanhog"): *"Search is still not showing the first search result properly"* —
the first hit sat under the sticky "VIP · 2" section head. `chromeFoot` reads only what is stuck NOW; a section head in
the flow above its first row sticks only after the pin scrolls the page under it, and the sticky block eases its `top`
over 300 ms, so the hit-test missed it. `stickyHeadsFoot` now reads every sticky box that precedes the result in one of
its containers by its own resolved `top` (where it will rest), and the pin settles once more after `PIN_SETTLE_MS`.
It stops at the result's own `overflow:auto` scroller (a head stuck outside it is already the scroller's top — § 2c,
red without the stop) and skips a sticky box beside the result (a desktop rail). Held by
`lib/a-search-pins-its-first-result.test.ts` § 2b and § 2c.

SPEC IMPACT: None
