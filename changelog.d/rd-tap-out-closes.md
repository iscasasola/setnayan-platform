## 2026-10-25 · fix(overlays): a tap on the dark closes the pop-up again — the page lock had made the close layer inert

Owner, on his iPhone (live, People › Invite someone): *"I cannot tap out the screen"*.

**Proven cause (Playwright WebKit/iPhone 13 + Chromium/Pixel 7, the real `GuestPopup`):** not the blur. `useModalA11y` → `isolateOverlay(panel)` (added the same morning in "one backdrop and one iOS-safe page lock behind every pop-up") makes every sibling of the panel `inert` unless it is a full-screen **fixed** layer or wears `data-overlay-backdrop`. `GuestPopup`'s close button was a transparent **`absolute`** layer beside the panel, so it went `inert`; the tap landed on the root and `onClose` never ran — on every browser. With the isolation switched off the same WebKit tap passes straight through the `pointer-events-none` blur and closes. The same walk killed the tap-out on the ⓘ explain pop-up, the calendar sheet, the Maker sheet, the colour sheet, the lock pop-up and ~15 hand-made sheets with an `absolute inset-0` close button.

**Fix, two holds:**
- `lib/overlay-lock.ts` — the decision is a pure `keepsBesidePopup()`: marked, full-screen fixed, **or a full-screen `<button>` in any position** stays live. A full-screen `div`, the bottom bar and small buttons still go inert (re-measured: page and bar inert, body pinned, a tap inside the panel does not close).
- The dark IS the close button: `GuestPopup`, `StudioPopup` (colour sheet), `LockPopup`, `CalendarSheet` and `ExplainPopup` draw `<OverlayBackdrop onClose>` instead of a transparent button under a `pointer-events-none` dark span. `POPUP_DARK` / `POPUP_SCRIM` are deleted. The Maker sheet keeps its separate dark (it carries the hole round the live preview) and its button now wears `data-overlay-backdrop`.

Guards: `one-backdrop-everywhere.test.ts` tests 4 (the walk keeps the close layer — pure cases) and 5 (no `sn-popup-dark pointer-events-none` over a separate close layer, two reasoned exceptions); the guest-popup, guest-list-sheet, stages-popup, calendar, form-row and Maker-sheet tests now pin the new shape. Sabotaged (fixed-only rule back + the old pair back in `GuestPopup`) → 4 RED; restored → green.

SPEC IMPACT: None — restores INTERACTION_RULES § 9 "pressing on the dark part removes the pop up" as already written.
