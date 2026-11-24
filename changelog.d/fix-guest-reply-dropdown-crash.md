## 2026-11-24 · fix(dropdowns): a dropdown can no longer crash the page on a phone (the guest card's Reply ▾)

LIVE FIX. The owner, on his phone on setnayan.com: Guests › a guest's card › Reply › tap the Reply dropdown, and the whole page fell to "Something on our end didn't work."

- **The real error** is in `app_telemetry_logs` (PAGE_CRASH on `/dashboard/[id]/guests`, 21 Nov on a68d08d and 23 Nov 14:32 UTC on 976c106): React #185, "Maximum update depth exceeded". The state setter is called from a layout effect. In the shipped bundle, `PickMenu`'s `setAt` (inside `place`) sits exactly 173 characters before the `place()` call in its layout effect, the same gap as the two stack columns.
- **Cause:** `PickMenu`'s placing `useLayoutEffect` had no dependency list. It measured and re-placed the list after every render, including the render its own `setAt` caused. On the owner's iPhone each placement changed what the next measurement read, so the answer never repeated and React stopped the page. Desktop Chromium and WebKit never showed it.
- **Fix** (`pick-menu.tsx`): the effect runs on `[open, unplaced, options.length]`. It places the list once on open and once more when the list exists (its real height), as the design always meant. Scroll and resize still re-place it from their listeners. Each of those is its own task, so it cannot loop inside one commit. Every `PickMenu` in the app gets the fix.
- **Walked** in the guests lab at 375 px in WebKit and Chromium, on the Reply, Invited to and Meal dropdowns. Each opens against its button (below or above), takes focus and picks, with no error screen. Positions are identical to before the fix.
- **Guard:** `a-dropdown-places-itself-a-bounded-number-of-times.test.ts` (4 tests). It checks the source (the placing effect has its deps, and it is the only layout effect). It also runs React's layout-effect rule against the real `placePickList`, on the Reply dropdown's shape and a screen that never agrees with the list. With no deps it passes React's limit, which is the crash. With the shipped deps it places at most twice. Removing the deps turns it red.
- `pick-menu.tsx` is 9,548 bytes, under the 9,800 inline line.

SPEC IMPACT: None.
