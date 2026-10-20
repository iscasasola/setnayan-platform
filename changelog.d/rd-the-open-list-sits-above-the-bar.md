## 2026-10-20 · fix(guests): an open list sits above the bottom bar — the Group list and its editors, and every PickMenu

The controller's 375 px shot of the guest card: the app's bottom bar (Guests · Suppliers · Hub · More) drew OVER the open Group list, and "＋ New group…"'s Create / × sat under it. Measured in the lab (Chromium + WebKit, 375 × 812, the `/guests/[guestId]` card page under the real dock): before, the New group strip was 63 px under the bar (Create 43 px), a rename strip 139 px, and the Title PickMenu (plus the Add card's Role) opened down 56 px over the bar. After: 0 everywhere. The guest card's phone sheet over the List (z-75) covers the bar and was never affected.

- `lib/bottom-chrome.ts` (the cookie banner's bar rule) gains its mirror `topChromeDrop` and `revealDelta`. The new `lib/reveal-above-chrome.ts` measures the clear band: fixed/sticky bars, skipping bars under the layer the thing sits in, plus the keyboard's edge via `visualViewport`.
- `GuestGroupPicker` scrolls its list into the band on open, from its pill down. When an editor opens (new, rename, delete) it scrolls that editor and its buttons into the band, again when the editor's message changes or the keyboard moves. The name box focuses without the browser's own scroll.
- `PickMenu` places its list against a floor at the bar's top (`pickViewport`, `placePickList`'s new optional `floor`), so a list near the bottom opens up instead of over the bar.
- Guard: `lib/an-open-list-sits-above-the-bar.test.ts`.

SPEC IMPACT: None.
