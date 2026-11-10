## 2026-11-10 · fix(front-pages): no sideways scroll at 320 px — a closed ⓘ takes no room, an open one stays on screen

Build 5 Lane R. Measured on the live site, logged out, at 320 · 360 · 375 · 390 · 430 px, light and dark, on `/`, `/for-suppliers`, `/for-coordinators`, `/features`, `/pricing`.

- **Sideways scroll at 320 px on `/` (332 px wide) and `/pricing` (338 px wide).** Both caused by CLOSED InfoTip bubbles: `.sn-tip` is `visibility: hidden` but still laid out, so a 288-px bubble hanging from an ⓘ 44 px in widened the page. `globals.css`: the closed `.sn-tip` is now `max-width: 0; max-height: 0; overflow: hidden`, and the size comes back AFTER the close fade (same delay as `visibility`), so the fade looks the same.
- **An open ⓘ bubble ran off the screen** (18 px past the right edge on `/pricing`, 12 px on `/`, and 6 px past the left edge on the pricing rows). `info-tip.tsx` measures the bubble from layout on open and sets `--sn-tip-nudge` so it stays 16 px in from both edges. The `.sn-tip` translate now adds that nudge.
- **A long one-word name was cut off mid-letter** on `/` at 320 px ("FlowerStore.p"). `.fd-ttl` now has `overflow-wrap: anywhere`.
- **Equal-weight choices at unequal widths (T19).** `/for-coordinators` and `/for-suppliers` "Ask about this date | Pick another day" were 160 | 143 px in one row and two odd-width pills stacked at 320 px. They now share the row equally, or take the full width each when stacked. The `/for-coordinators` Edit | View | Off segments were 44 | 50 | 44 and are now equal.

- **"Free" printed for the live-stream camera** (owner ruling: never). `app/page.tsx` Live Watch feature line now says "(one camera included; multicam control room as an add-on)", with no price. None of the other front pages (`/features`, `/pricing`, `/for-suppliers`, `/for-coordinators`) uses the same wording.

Guard: `lib/a-closed-tip-takes-no-room.test.ts` fails 4 out of 4 against the old `globals.css`/`info-tip.tsx` and passes after the fix.

SPEC IMPACT: None.
