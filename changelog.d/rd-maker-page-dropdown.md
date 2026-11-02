## 2026-09-30 · feat(maker): "Page ▾" — the guest's own pages at the top of the navigator

**Owner, verbatim (pointing at the guest Event Hub's bottom bar Home · Details · Story · Me):**
*"on the navigator, there should be Home, Details, Story, Me on top dropdown so we can fix and
improve the event hub itself for invitation."* Same day: *"on Invitation, the menu is Welcome -
Details - Our Love Story - Me"* and *"Live - Welcome - Camera - Gallery - Me"* for The Day.

- The navigator's one dropdown (it was "This stage's menu", read off the canvas's un-answered guest
  bar, so the Invitation offered RSVP and never Me) is now **Page ▾**: exactly the pages a guest's
  bar offers on the stage being edited, in the bar's order, words and icons, ending in Me.
- **One source for the words.** `lib/maker-guest-pages.ts` names no page — it asks
  `resolveSiteNav` (the function that draws the guest's bar) for a guest who holds their key and
  has answered, on the stage's own allow-list (`STAGE_BAR`). When the guest bar's labels are
  renamed (Welcome · Details · Our Love Story · Me), the Maker follows with no edit here.
- A pick **jumps, never filters**: the navigator scrolls to that page's first scene and the canvas
  gets the bridge's existing `scrollTo` — no reload, no refresh, no stage change. Every scene stays
  listed (`every-scene-is-in-the-navigator.test.ts` still green).
- **Me** and a page of its own (**Camera**) are pickable and say what they are instead of doing
  nothing. Me can't be drawn on the canvas yet: the canvas is the host's render, and
  `app/[slug]/page.tsx` builds the guest's Me (`meSlot`) only for a real guest — the sample-guest
  preview (`?as=replied`) renders without it. A page of this one with no scenes on this stage
  (e.g. Gallery on The Day) is listed but not pickable, with its reason.
- `PickMenu` options may carry an `icon`.
- Guard: `lib/the-page-dropdown-is-the-guest-bar.test.ts` — the dropdown equals the guest bar on
  every stage (keys, words, order, icons), no page name is typed in the Maker, a pick is one
  message and never a reload, nothing under `app/[slug]` reads the dropdown. Sabotaged four ways
  (a relabel, a wrong icon, a typed label, a filter + `router.refresh()`), each caught.

Guest-facing behaviour: none. No file under `app/[slug]` changed.

SPEC IMPACT: None — Maker navigator presentation of an existing owner ruling; the guest bar's
labels themselves are changed by the builder that owns them.
