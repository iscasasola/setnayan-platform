## 2026-09-29 · feat(logo): every screen that shows the couple's logo plays it when it moves

Owner, pointing at the couple's mark drawn as a still `<img src="data:image/svg+xml…">`
on the RSVP card: *"can we also animate this?"* → *"all logos should animate if
animation is active"*.

**The rule.** Wherever the couple's logo is on a SCREEN, a saved logo that moves (a
layer whose In is not None, or whose During is Drift — `logoHasMotion`,
`lib/logo-layers.ts`) plays through THE one player (`LayeredLogoPlayer`) when the
animation is on for the event — the same gate as the Event Hub hero: Animated
Monogram active (paid, or included with Event Hub Pro) and not switched to "Use
Static Image". Otherwise the surface draws exactly the still it drew before.

- `app/_components/couple-logo.tsx` — `CoupleLogo`, the one small wrapper: takes the
  mark, `plays`, a `place` and the surface's own `still`. Plays **once** on arrival
  (+ its Drift); a re-render never replays it and a remount in the same place shows
  it arrived (`settled`); an **offscreen** logo waits for the viewport
  (IntersectionObserver) so a board of many cards animates only what is on screen;
  **reduced motion** → the still, from the first paint (the still is in the server
  HTML, hidden only under `motion-safe:`).
- `lib/logo-plays.server.ts` — `logoPlaysFor(eventId, svg)`: asks nothing for a logo
  that does not move; otherwise the hero's own gate (owned && not "Use Static Image"),
  from the same two helpers, once per request — not a second gate.
- `lib/couple-logo-plays.ts` — the pure decisions (plays, phase on mount, arrivals,
  settled motion).
- `LayeredLogoPlayer` now builds its live tree through `inertLogoTree`: parsed into an
  inert `<template>` and checked against an element/attribute ALLOWLIST on the
  browser's own parse (`logoElementPlayable` / `logoAttributePlayable`) — never raw
  markup into the page. A logo that fails it stays the still `<img>`. This is what
  makes it safe to play the couple's host-writable mark in a SUPPLIER's session
  (SEC-3).
- Converted: the Event Hub hero (`HeroMonogram` — now waits for the viewport and plays
  once), the invite doors' seal (Capiz · Velvet · Abaca, via `SealMark`), the dashboard
  rail chip, the home board's event cards
  and posters, the Maker's poster preview, the Library's album cards, the supplier's
  client page (Style card), the venue screen (`/live/screen`), and the Save-the-Date
  film's owned-without-a-studio-reveal branch.
- Still ON PURPOSE (and listed, with reasons, in the guard): prints/PDFs, the QR
  centre, favicons/app icons/OG + social images, emails, the broadcast corner mark
  (composited into the stream), the wax seal's pressed impression, the "Your mark
  everywhere" print mock-ups, an unsaved studio draft thumbnail, the before/after
  buy preview's "before".
- Guard `apps/web/lib/every-logo-plays.test.ts` — the rule, the allowlist, reduced
  motion, plays-once, offscreen, rendered surfaces, and a SWEEP of `app/**/*.tsx`
  that fails when an SVG mark is drawn as a still image/markup outside `CoupleLogo`
  and off the reasoned still-list. Each part sabotage-tested.
- Not touched: the RSVP reply crest (`hub-door-skin.tsx`, `invite/reply/page.tsx`) and
  `rsvp-widget.tsx` / `door-shell.tsx` — PR #6144 plays that crest behind the SAME gate
  (`eventAnimatedMonogramActive` && `!markAnimationSwitchedOff`), which
  `lib/logo-plays.server.ts` uses word for word.

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-29 row "every logo plays when animation is
on" (the rule + the still-list).
