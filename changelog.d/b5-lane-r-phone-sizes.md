## 2026-11-10 · fix(front-pages): no sideways scroll at 320 px — a closed ⓘ takes no room, an open one stays on screen

Build 5 Lane R. Measured on the live site, logged out, at 320 · 360 · 375 · 390 · 430 px, light and dark, on `/`, `/for-suppliers`, `/for-coordinators`, `/features`, `/pricing`.

- **Sideways scroll at 320 px on `/` (332 px wide) and `/pricing` (338 px wide).** Both caused by CLOSED InfoTip bubbles: `.sn-tip` is `visibility: hidden` but still laid out, so a 288-px bubble hanging from an ⓘ 44 px in widened the page. `globals.css`: the closed `.sn-tip` is now `max-width: 0; max-height: 0; overflow: hidden`, and the size comes back AFTER the close fade (same delay as `visibility`), so the fade looks the same.
- **An open ⓘ bubble ran off the screen** (18 px past the right edge on `/pricing`, 12 px on `/`, and 6 px past the left edge on the pricing rows). `info-tip.tsx` measures the bubble from layout on open and sets `--sn-tip-nudge` so it stays 16 px in from both edges. The `.sn-tip` translate now adds that nudge.
- **The hero's "Unlimited cameras" ⓘ was cut off after one line** on `/` at every phone width. The hero is `overflow: hidden` and the line sits on its bottom edge. That one bubble now opens upward (`front-door-landing.css`). This was already broken on live and is not a side effect of the change above.
- **A long one-word name was cut off mid-letter** on `/` at 320 px ("FlowerStore.p"). `.fd-ttl` now has `overflow-wrap: anywhere`.
- **Equal-weight choices at unequal widths (T19).** `/for-coordinators` and `/for-suppliers` "Ask about this date | Pick another day" were 160 | 143 px in one row and two odd-width pills stacked at 320 px. They now share the row equally, or take the full width each when stacked. The `/for-coordinators` Edit | View | Off segments were 44 | 50 | 44 and are now equal.
- **"Free" printed for the live-stream camera** (owner flagged "Live stream says '1 camera free'"; ruling: never "free" for the camera). Every live-stream line now says "included", and none prints a price:
  - the Home Live tile, `lib/home-first-screen.ts` ("1 camera free" became "1 camera included");
  - the in-app Live Watch sheet (`iap-live-watch-sheet.tsx`);
  - the app's Live Watch status (`lib/iap/where-bought.ts`);
  - the Live Watch controller and studio pages;
  - the `/about` and `/privacy` lines, the help entry, `llms.txt`, the add-ons blurb, the on-air pinned-camera notice, and the front-page JSON-LD line in `app/page.tsx`.

  Papic's "Cameras are free and unlimited" and its free credits are a different product and are left alone. So are code comments and the rehearsal wording ("Rehearse free", the "Free live stream" overlay), which do not call the camera free.

Guards: `lib/the-live-camera-is-never-free.test.ts` fails 13 of 14 against the old copy (`app/page.tsx` was already fixed in an earlier commit). `lib/a-closed-tip-takes-no-room.test.ts` fails 4 out of 4 against the old `globals.css`/`info-tip.tsx` and passes after the fix. It also holds that the hero ⓘ opens upward.

SPEC IMPACT: None.
