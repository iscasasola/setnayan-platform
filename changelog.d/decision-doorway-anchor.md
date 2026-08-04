## 2026-07-29 · fix(marketplace): "Still needs your decision" lands on the exact accordion cell — the leaf row never had an anchor

Owner: *"still needs your decision doesn't jump to the exact accordion cell."* Two defects, one handler.

**1 · The exact cell had no scroll target at all.** The bench (`_components/shortlist-categories.tsx`) rendered exactly ONE anchor — `id={`slfold-${folder.slug}`}`, the folder card. The leaf category row rendered none. So `TeamDecisionDoorway` aiming at `#slfold-<slug>` was not mis-targeted; it was targeting the only thing that existed. The category itself sat expanded somewhere below the folder head, unreachable by construction.

The leaf row now carries `id={replan ? benchTileAnchorId(t.tile) : undefined}` — `#sltile-reception`, `#sltile-catering`, and so on. Wedding tiles are globally unique (69 tiles across `WEDDING_TILES_BY_PARENT`, 0 duplicates), and the `sltile-` / `slfold-` prefixes cannot collide, so the id is safe as a document-wide anchor.

**2 · The doorway was guessing a delay against a remount it could not see.** It did `router.push('?tab=shortlist&open=<tile>')` and then waited a fixed **220ms** before scrolling. But that push changes `page.tsx`'s `key={`sl-${sp.open ?? ''}`}`, which **remounts** the bench. A caller cannot observe a remount it does not own, so the race was a coin flip — and it lost *silently*, because it ended in `?.scrollIntoView()` on a null.

**The scroll moved to the bench, which owns that remount and therefore owns its timing.** A `useLayoutEffect` beside `openPlan` scrolls `#sltile-<initialOpenTile>` on mount. No millisecond is guessed: `openFolder` / `openTile` are seeded in the `useState` initialisers, so `.fold.open` / `.cat.open` are present on the *first* paint, no expand transition runs, and layout is final — one `requestAnimationFrame` to let that paint complete is exact rather than hopeful. If the leaf row isn't on the bench it falls back to the folder anchor.

`openPlan` (Coverage Strip tiles, plan chips) keeps aiming at the FOLDER anchor deliberately: that path expands a folder that was *collapsed*, and while the `0fr→1fr` transition runs the leaf rows have no height yet, so a leaf target there would land on a position that no longer exists 240ms later. It is only routed through the shared helper so reduced motion reaches it.

**What stays in the doorway is only what a remount cannot cover**, and it is now derived rather than timed — `willRemount` is literally `?open=` before vs. after, the same value the page keys on:

- **a plan group with no `catalogTile`** (`attire` · `music_entertainment` · `logistics` — 3 of 27) has nothing to deep-link to, so it scrolls to the folder. It now carries the *current* `?open=` through instead of dropping it: dropping it would re-key the bench and collapse it out from under the very scroll that branch is performing.
- **the same row tapped twice** — `?open=` is unchanged, so no re-key, no remount, no mount effect. The anchor is already in the DOM, so it scrolls directly rather than waiting for something that will never fire. (Under the old code this case worked by accident; under a naive "just delete the timeout" it would have become a dead click.)

**Landing offset — `block: 'start'` alone tucks the row under the chrome.** Both anchors carry `scroll-margin-top` in the bench's own stylesheet: **14px** on mobile (`ServicesTakeover` hides `.shell-topbar` below 1024px, so nothing is pinned at the top — this is breathing room, not clearance; the bottom nav + section dock sit *below* the landed row and cannot cover it) and **96px** at ≥1024px, which is the same clearance the takeover's own `ServiceSection` anchors already use for the `sticky top-0` `.shell-topbar` that *reveals* on the upward scroll a doorway performs.

**Reduced motion:** a programmatic `scrollIntoView` is not a CSS transition, so no stylesheet can reach it — `benchScrollBehavior()` reads `prefers-reduced-motion` in JS and returns `'auto'` (an instant jump). Centralised in `lib/bench-anchors.ts` so the two call sites cannot disagree.

**Flag OFF is byte-identical.** The leaf `id` resolves to `undefined` (no attribute emitted) and the mount effect returns early, so the checklist's `?open=` deep link keeps landing the category open-but-unscrolled exactly as it ships. Flag ON, `checklist-full.tsx`'s `?tab=shortlist&open=<tile>` link — the same shipped contract, from a different route — gains the scroll for free: a cross-route navigation mounts the bench fresh, which is precisely when the new effect fires.

**Traced end to end against the owner's own event** (`044f7e64-…`, wedding, 2026-12-18, 0 locks): `reception_venue` → `catalogTile 'reception'` → `?open=reception` → key `sl-reception` → folder `venue` (slug `venue`), leaf row "Reception" → `#sltile-reception`. `ceremony_venue`, `catering` and `photography` (→ `photo_video`) resolve the same way. `resolveInPlanTiles` pins the deep-link target, so the row renders even for a category the couple had removed from their plan.

New: `lib/bench-anchors.ts` (id derivation + the one reduced-motion-aware scroll) and `lib/bench-deep-link-anchor.test.ts` (11 assertions). Mutation-checked both ways: deleting the leaf `id` turns *"the bench renders the LEAF anchor on every category row"* red; pointing the mount scroll away from the leaf turns *"the bench scrolls the deep-linked tile into view on mount"* red.

Untouched: the `grid-template-columns: minmax(0,1fr)` accordion-overflow rule (#3799/#3801), the reduced-motion blocks, and the folder/leaf row icons.

SPEC IMPACT: None — no SKU, price, schema, entitlement or flag change. A navigation defect inside the shipped Explore-Replan bench.
