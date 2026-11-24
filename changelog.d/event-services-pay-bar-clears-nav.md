## 2026-11-25 · fix(app): on Event services the nav no longer covers the Pay bar or the "1 of 2" step

The owner's iPhone walk (1.0 build 9) found the bottom nav covering the foot of Event services' Pay bar, where App Review buys the three plans. This is a web-only fix: the app loads the live site, so no new iPhone build is needed. Two causes, both measured on the live page at 390 px:

- **The nav's clearance went stale.**
  - The nav's dock publishes its height to `--sn-bottomdock-h`, and every bar standing on the nav sits on it, including the Pay bar's ThumbDock.
  - The dock's home-indicator room is its padding, and an iPhone WebView can report that inset after the first paint. The dock's ResizeObserver watched the content box, which padding does not change, so the height stayed short by the home indicator.
  - With a 34 px inset, the Pay bar sat 34 px into the nav's pill, covering its second line and half of Pay.
  - Now the dock observes its border box (`app/_components/nav/bottom-nav.tsx`), so a late inset reaches every bar on the nav. No new number.
- **The "1 of 2 · Event Pro" step was trapped under the nav.**
  - The event layout's `<main class="sn-vt-page">` carries a view-transition-name, which makes it a stacking context. The step that names each Apple payment was a fixed layer inside it, so the nav and the Pay bar covered it.
  - Now it is drawn into `<body>` (`createPortal`, as ThumbDock does for the Pay bar), at the pop layer (`--sn-z-pop`). Its own hook carries the page's colours, and its sheet adds the home-indicator inset. It lies over the top bar and the nav, as frame 08b draws.
- Words, flow and money are unchanged.
- **Guards:**
  - New: `the-pay-bar-and-its-step-clear-the-nav.test.ts` (5 checks, 4 sabotages each seen red).
  - Updated: `event-services-wears-the-website-look.test.ts`, whose scope now includes the step's own hook beside the cart bar's.
- No migration, no email, no new server action.

SPEC IMPACT: None. A layout fix to the approved v5 frames (08 · 08b), no product change.
