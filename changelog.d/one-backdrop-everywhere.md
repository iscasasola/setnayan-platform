## 2026-10-25 · fix(overlays): one backdrop, one page lock behind every pop-up

Owner, 25 Oct: *"the darken also moves and does not darken and blurr background. back should not move and will not be
scrollable or tappable until pop up is gone … just implement it across all"*.

- `lib/overlay-lock.ts` (new), called by `useModalA11y` — the hook every sheet, dialog, side panel and viewer uses:
  the page is pinned the iOS-safe way (body `position: fixed` at `-scrollY`, put back on the same pixel on the last
  close; counted, so stacked pop-ups hold it until the last one closes), and everything behind the pop-up is `inert` +
  `aria-hidden` (`inertBehind` from `popup-behind.ts`, reused, now able to keep the backdrop live). Before this the
  lock was `body { overflow: hidden }`, which iOS scrolls straight past — the dimmed layer slid with the page.
- `app/_components/overlay-backdrop.tsx` (new): THE backdrop — `fixed inset-0`, `.sn-popup-dark` (dark + 6 px blur,
  light and dark mode), opacity fade, `touch-action: none`; a tap closes. The shared `<Sheet>` draws it, closes on
  Back (`useBackCloses`, now also stepping back when a caller closes the sheet itself), and its body is
  `overscroll-contain`. The Guests drawer's scrim moved onto it; the guest card / side panel scrims
  (`.sn-inspector-peek`, `.sn-side-panel-scrim`) now wear the same dark and blur.
- Guard `lib/one-backdrop-everywhere.test.ts` + `lib/one-backdrop.baseline.txt` (shrink-only list of hand-made
  `fixed inset-0` dimmers still to move).

SPEC IMPACT: None.
