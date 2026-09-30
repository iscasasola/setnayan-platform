## 2026-09-30 · fix(maker): View ▾ Both fits the screen — the desktop and the phone scale to the room they actually have

Owner, verbatim 2026-09-30: *"the desktop and mobile on view must adjust on the screen showing both side to side just exceeded the screen"*.

**Why it overflowed.** The canvas section (`editor-shell.tsx`, `aria-label="Preview"`) had no `min-w-0`, and the desktop frame is drawn 1280 px wide (scaled with a CSS transform, which does not shrink its layout box). The section's minimum width therefore became 1280 px + the 390 px phone + gap, and the whole pair was pushed past the window's right edge whenever the scenes list or the inspector took room.

**The fix (layout and scaling only — no save/refresh path touched).**
- The section may shrink (`min-w-0`), so the canvas row's width is the room left by the scenes list and the inspector, whichever are open.
- The ROW is measured (ResizeObserver, `usePaneSize`) while Both is picked, so it re-fits on window resize, on the list/inspector opening or closing, and on their drag handles.
- `bothLayout(width, height)` (`both-view.ts`, pure) sizes the PAIR: the desktop keeps a 1280 × 800 shape, the phone 390 × 844; the phone is scaled to the row's height (≤ 1, ≤ 40% of the row), the desktop takes the rest, and `phone + 16 px gap + desktop ≤ row width` always. Room to spare draws the desktop at scale 1 and wider than 1280 (never stretched).
- If either frame would be too small to read (phone < 0.6, desktop < 0.28), Desktop is drawn instead, with the pick kept — the same rule a sub-1024 px window already follows — and a line under the canvas says why ("Not enough room for Both — showing Desktop…").
- Taps: the frames are scaled by CSS transform; the browser maps pointer events through it and the editor bridge works in the iframe's own coordinates, so no bridge maths changed.

Guard: `apps/web/lib/the-maker-both-view-is-live.test.ts` — test 6 asserts the pair's total width ≤ the row at 1024 / 1280 / 1440 / 1920 with the scenes list and inspector open and closed (and that the common cases draw Both rather than falling back); 6b pins the section's `min-w-0`, the measured row and the fixed, clipping boxes.

SPEC IMPACT: None — implements the shipped View ▾ Both (DECISION_LOG 2026-09-28) as specified; no decision changes.
