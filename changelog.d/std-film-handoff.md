# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-03 · feat(guest-site): the Save-the-Date film hands off to the site instead of being a wall

Second build item of the event-website work (owner, 2026-08-03: *"we want them to navigate around right away"*, then *"keep going"*).

**The problem.** More than `STD_THRESHOLD_DAYS` (90) out, `phasedBody` renders the film **instead of** the site. The film is `fixed inset-0 z-[50]`; the browse menu is `z-30`. So on a wedding months away — nearly every newly-created one — a visitor gets the film and nothing else, with the menu they are meant to browse with underneath it, invisible. Combined with PR #4068 (the dead tabs), flipping open browse would have shipped a menu that was both unreachable and partly broken.

**The shape.** The film still plays first and in full — nothing bought is skipped — and once its closing beat is reached a quiet *"See our page ↓"* appears. Taking it lifts the film in place; a *"Watch our film again"* control brings it back. An in-place lift rather than a link, because the cinematic opening is a **paid SKU** and navigating away would spend the couple's purchase with no way back.

**The safety property, and the flaw it nearly shipped with.** Every beat node is mounted for the whole film and merely faded, using `pointer-events-none` + `aria-hidden` — **neither of which removes an element from the tab order**. A button written into the closing beat without a mount guard is Tab-reachable from frame one, under the veil, before the music, the couple's clip or the gallery have played. Two keystrokes would skip everything they paid for. The exit is therefore gated on `canExit && idx === closeIdx`, a real mount condition. `std-film-handoff.test.ts` pins it and **rejects the hidden-instead-of-gated variant by name**; mutation-verified by reintroducing exactly that.

**Why an event, not a callback.** The film is mounted by SERVER components (`SaveTheDateView` ← `site-body`), so a function cannot cross the boundary. Both halves import `STD_FILM_EXIT_EVENT` from the film module, and a test rejects a hard-coded copy in the listener. Mirrors the shipped `papic:out-of-shots` pattern.

**Also removed:** the dead `websiteUrl` slot in `lib/save-the-date-content.ts` — a *"See details"* target that shipped as data with **zero consumers** and no button. Leaving it beside this handoff would have left two mechanisms for one affordance, one live and one dead.

**Flag-off is byte-identical.** `StdFilmHandoff` is mounted only when `plan.openBrowse` is true, and `canExit={plan.openBrowse}`. Every event in production has open browse off except the sample, so no live site changes.

Verified: 6,308/6,308 unit tests, `tsc --noEmit` clean, `next lint` clean. No migration, no flag, no route change.

SPEC IMPACT: `0024_save_the_date/` — the film gains a terminal exit under open browse. The paid cinematic opening is unchanged and still plays in full before the exit exists.
