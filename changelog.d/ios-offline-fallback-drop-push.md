## 2026-09-22 · fix(mobile): the iOS shell shows the offline page instead of a blank WebView, and drops the unused push plugin

Apple rejected the submission with *"The app crashed on launch."* A Release build
of `apps/mobile/ios/App` was compiled and launched on an iPhone 17 Pro simulator
and **did not crash** — it loaded `https://www.setnayan.com`, followed the
middleware 307 to `/login` and stayed up. Two real defects were found on the way,
and those are what this PR fixes. The crash itself is not yet explained; the
remaining difference is the signed device build, and the crash log from App
Store Connect is the decisive artefact.

### 1 · iOS had no offline fallback. Android has had one all along.

`capacitor.config.ts` stated that `webDir` (./www) is "the LOCAL FALLBACK shown
when the remote URL is unreachable". That was **only ever true on Android**,
where `MainActivity` subclasses Capacitor's own `BridgeWebViewClient` and loads
the bundled page from `onReceivedError`. iOS carried a stock `AppDelegate` and a
stock `CAPBridgeViewController` and no `WKNavigationDelegate` of any kind. The
bundled page said so in its own comment: *"Wiring it as the WebView error page is
a per-platform follow-up (iOS: WKNavigationDelegate...)"*.

What that looked like: the splash auto-hides after `launchShowDuration` (2s)
whether or not the remote page arrived. If it did not — a proxied or captive
network, a DNS failure, the host down — you were left looking at a **blank white
WebView**, with no error, no explanation and no retry, forever. An automated
launch check scores that as a failed launch.

New `apps/mobile/ios/App/App/SetnayanBridgeViewController.swift`, wired as the
initial view controller in `Main.storyboard`.

🔑 **THE FIRST VERSION OF THIS FIX SHIPPED INERT, AND ONLY RUNNING IT FOUND
THAT.** Every piece of the mechanism logged correctly — proxy installed, failure
caught (`NSURLErrorDomain -1003`, cannotFindHost), `hasRenderedContent=false`,
`loadFileURL` called — **and the screen stayed blank.** Capacitor's own
`decidePolicyFor` only recognises `server.url`; it treats every other URL as an
external link, **cancels the navigation and hands it to Safari**. So the
`file://` fallback was cancelled silently, with no error and no second failure
callback to notice. The handler now allows files inside this app's own bundle
(scoped to `Bundle.main.bundleURL`, never an arbitrary `file://` a remote page
could hand us) and forwards everything else untouched.

Two more things the implementation had to get right, both of which would have
turned the fix into a new bug:

- **The proxy forwards, it does not replace.** Capacitor owns the webView's
  `navigationDelegate` — a `CAPWebViewDelegationHandler` carrying the bridge —
  and `CAPBridgeViewController` exposes no hook to substitute it. Replacing it
  outright severs every plugin. Unhandled selectors go to Capacitor's handler
  via `forwardingTarget(for:)` + `responds(to:)`, so the auth challenge, the
  script-message plumbing and the scroll delegate are untouched.
- **The fallback fires only when nothing has rendered yet.** A WKWebView that
  already has content KEEPS showing it when a later navigation fails; only the
  first load leaves a blank screen. Falling back unconditionally would REPLACE a
  working page mid-session every time one navigation failed. `-999`
  (`NSURLErrorCancelled`, raised by the `/` → `/login` 307 on the normal launch
  path) and `WebKitErrorDomain` 102 are excluded for the same reason.

⚠ **Android's `onReceivedError` has exactly that second bug today** — it reloads
the fallback on any main-frame error, including mid-session. Flagged, not fixed
here; it wants its own change and its own test.

**Verified by running it**, both branches, on the final code:

| Build | Result |
|---|---|
| `server.url = https://www.setnayan.com` | login page renders; zero `[offline-fallback]` log lines |
| `server.url = https://unreachable.setnayan.invalid` | branded "You're offline" page with Retry |

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select points at CommandLineTools
cd apps/mobile/ios/App && xcodebuild -scheme App -configuration Release -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO build
```

### 2 · `@capacitor/push-notifications` was registered in the binary and unreachable from any code path

It shipped in `packageClassList`, in `Package.swift` and in the Android Gradle
wiring. Its only consumer was `apps/mobile/src/push.ts`, which **nothing
imports** — `apps/mobile` has no build step and `www/` contains one static
`index.html`, so that file was never compiled or bundled. Push in the product is
Web Push through a service worker: every call site passes
`registerPushToken(..., 'web')`. Its own docblock listed five "OWNER ACTION
REQUIRED" steps and steps 3–5 were never done — no `google-services.json`, no
`aps-environment` entitlement, `/api/notify` still on TODO stubs.

So the plugin was pure App Review surface for zero function. Removed from
`package.json`, both native projects re-synced (`npx cap sync ios|android` — 7
plugins now, push gone), and `src/push.ts` deleted.

**To bring it back**, restore `src/push.ts` from this commit's parent, re-add the
dependency, `npx cap sync`, then do the five steps its docblock names — the
Firebase `google-services.json`, the Xcode Push Notifications capability plus an
`aps-environment` entitlement and APNs keys, and the FCM/APNs forwarding in
`apps/web/app/api/notify/route.ts`. Shipping the plugin without them is what this
removes.

### Still open — owner, not engineering

- **The crash log.** App Store Connect → the build → the rejection → Crash log,
  or Xcode → Organizer → Crashes. Nothing here explains a crash, and a Release
  simulator build does not reproduce one.
- **`CURRENT_PROJECT_VERSION` is back to `1`** in both configurations —
  regenerating the iOS project reset it, and the 2026-09-07 closeout had bumped
  it to `2` precisely because App Store Connect refuses a duplicate build number.
  Deliberately NOT changed here: the next free number depends on what has already
  been uploaded, which is not readable from the repo.
  Re-measure: `grep CURRENT_PROJECT_VERSION apps/mobile/ios/App/App.xcodeproj/project.pbxproj | sort -u`
- **Signing.** `project.pbxproj` hard-codes `CODE_SIGN_IDENTITY = "iPhone
  Developer"` in the **Release** configuration and sets no `DEVELOPMENT_TEAM`.
  The entitlements request `com.apple.developer.associated-domains`
  (`applinks:www.setnayan.com`); an entitlement a distribution profile does not
  grant gets the app killed at launch by the OS, which passes every local test
  and reads to App Review as a crash.

SPEC IMPACT: None — native shell behaviour and a dependency removal. No product
decision changes; the offline page's copy and the four-platform distribution lock
are unchanged.
