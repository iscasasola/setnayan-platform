## 2026-07-21 · fix(live-studio): doorways to camera pairing + honest note on displays

Owner, from inside the control room: *"there is no way to sync camera and display"*. Both halves
were real.

### Cameras — the page existed but was ORPHANED

`/studio/panood/cameras` shipped in #3438 with **no link from anywhere**. An operator standing in
the control room had no route to the links that put a phone on air — the first thing anyone needs
there. That breaks the project's own wayfinding rule: a page ships with its doorway.

Two doorways added, deliberately:
- **Control room header** — "Connect cameras", beside the back link.
- **Sources rail header** — "Connect a camera". This is the contextual one: the moment an operator
  notices a camera they expected is missing is when they're looking at the rail, not the header.

(Prod already shows 11 seats with 2 claimed, so provisioning works — the links were just unreachable.)

### Displays — genuinely not built, and said so rather than faked

Live Studio venue screens are unwired end to end:
- `provisionPanoodScreensAdmin` has **no callers**, so a screen row is never created.
- `panoodScreenPairUrl` builds `/wall?code=…` while the route is `/wall/[eventId]` — **a 404**.
- That route gates on the **`LIVE_WALL`** SKU, a *different* product from Live Studio.

So the control room can choose what each screen shows, but nothing can pair a screen to it. Rather
than ship a pairing UI onto nothing, the Cameras page now carries an honest note and points at the
workaround that does work today: put a laptop on the venue screen and use the OBS program window.

**Open owner question:** is a Live Studio "screen" the same object as the Live Photo Wall, or a
separate display class? That decides whether this is a small wiring job or a new surface.

124 unit tests pass; typecheck + production build clean.

SPEC IMPACT: Surfaces an unbuilt piece of `Live_Studio_Repackaging_2026-07-08.md` § 7 ("walls —
photo-wall / mirror / live-background / off"). The routing grid exists; screen pairing does not.
