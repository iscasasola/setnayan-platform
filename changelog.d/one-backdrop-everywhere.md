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
- Every hand-made dimmer moved onto it — 38 pop-ups in all: Hub More, Hub bar dialogs, ticket, Report this page,
  account switcher, tours, package lock, Papic Add credits, My shots, story clock, admin palette/logs/wipe-ban,
  Samahan stories, invite/QR/sponsor/emcee/prep/seating/vendor/quote/cancel dialogs, Mood Board chooser, Our Story
  moments, scene templates (desktop; the phone keeps its clear tap-catcher so the preview stays visible), the pay
  screenshot viewer, the budget tour and supplier prep. Overlays that never called `useModalA11y` now do, so they
  hold the page too. The co-host welcome (server-rendered, no script) wears the same house dark; a tap on it submits
  its Confirm. The baseline `lib/one-backdrop.baseline.txt` is now EMPTY — guard
  `lib/one-backdrop-everywhere.test.ts` fails any new hand-made `fixed inset-0` dimmer.

SPEC IMPACT: None.
