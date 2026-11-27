## 2026-11-27 · fix(app): no black band behind the iPhone status bar

The Apple build 10 screenshots (iPhone 17 Pro Max simulator) showed a black strip above the top bar on every screen, with the dark clock drawn on it, so the time was unreadable.

Cause: the web asks @capacitor/status-bar to keep the web view below the clock (`setOverlaysWebView({ overlay: false })`). On iOS that makes the plugin lay its own view over the status-bar strip, coloured with its `backgroundColor`, which is `UIColor.black` unless set. It was never set, so it covered the page-coloured strip that `SideSafeAreaHost.swift` paints from the web view's `underPageBackgroundColor`.

Fix: `NativeBridge` now sets that strip fully transparent (`#00000000`) before laying it (`keepTheStripClear` in `app/_components/native-bridge.tsx`), so the page's own colour shows behind the clock in Light and Dark. Layout is unchanged. Web code only: the plugin and its `setBackgroundColor` are already in build 10, so no new iOS build is needed. Guard: `app/_components/the-strip-behind-the-clock-is-clear.test.ts` (fails without the fix).

SPEC IMPACT: None
