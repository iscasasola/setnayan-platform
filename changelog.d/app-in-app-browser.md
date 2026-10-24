## 2026-10-24 · feat(mobile): the Event Hub opens in an in-app browser sheet over the app

- **Native (needs a new app build — land before build 6 is archived):** `apps/mobile` adds
  `@capacitor/browser@^8.0.5` (same Capacitor 8 line as `@capacitor/core`). `npx cap sync ios`
  and `npx cap sync android` wired it into `ios/App/CapApp-SPM/Package.swift` and the Android
  `capacitor.settings.gradle` / `app/capacitor.build.gradle`. The same sync moved the
  `capacitor-swift-pm` pin from 8.4.0 to 8.4.3, matching the `@capacitor/ios` 8.4.3 that
  dependabot installed without re-syncing; `Package.resolved` was re-resolved with
  `xcodebuild -list` to match. `CURRENT_PROJECT_VERSION` (6) and the bundle id are unchanged.
- **Web:** `apps/web/lib/open-external.ts` → `openEventHub(url)`. In the app with the plugin it
  calls `Capacitor.Plugins.Browser.open` (SFSafariViewController / Custom Tabs; Done → back where
  the couple was). On the web it opens a new tab (`noopener`). In an app build without the plugin
  it navigates the same web view. No `@capacitor/*` import in `apps/web`. Public pages only: the
  sheet has its own cookies, so a signed-in draft preview does not belong in it.
- Held by `apps/web/lib/the-event-hub-opens-over-the-app.test.ts` (all three arms, a refused sheet,
  and the native half in package.json / Package.swift / gradle).
- Nothing calls the helper yet; the Home control row (rd/home-control-row) is its first caller.

SPEC IMPACT: None
