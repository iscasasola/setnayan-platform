## 2026-06-25 · feat(mobile): generate iOS Capacitor shell + App Store submission fixes

Adds the iOS native project to `apps/mobile` (the iOS analog of Android's #1044)
and applies every App Store **blocker** fix surfaced by the 15-agent
`ios-appstore-readiness` audit. iOS = Capacitor 8 remote-URL WKWebView shell
(SPM, no CocoaPods), bundle `com.setnayan.app`.

- `cap add ios` → committed `ios/` project.
- `Info.plist`: NSCamera / NSMicrophone / NSPhotoLibraryAdd / NSPhotoLibrary
  usage strings; `ITSAppUsesNonExemptEncryption=false` (export compliance);
  removed stale `armv7` capability; iPhone portrait-only; `setnayan://` scheme
  (Android deep-link parity). Geo intentionally omitted (WKWebView can't service
  web geolocation on a remote origin → no declared-but-unused permission).
- NEW `PrivacyInfo.xcprivacy` (required-reason APIs `CA92.1` UserDefaults +
  `C617.1` FileTimestamp; collected-data Email/Name/Photos, non-tracking) —
  wired into Copy Bundle Resources; **verified present in the built bundle**
  (else ITMS-91053 auto-reject).
- NEW `App.entitlements` (`applinks:www.setnayan.com`) + `CODE_SIGN_ENTITLEMENTS`.
- Real opaque 1024² Setnayan app icon (from the brand source; replaces the
  Capacitor placeholder → avoids a 4.x design rejection).
- `apps/web` AASA: real Team ID `P95JPDWWB3` (Universal Links for `/dashboard/*`).

Verified: `xcodebuild -sdk iphonesimulator … CODE_SIGNING_ALLOWED=NO` →
**BUILD SUCCEEDED**, privacy manifest confirmed in `App.app/`.

Remaining for submission are owner-side (Apple portal / App Store Connect /
Xcode signing-team) + the v1.1 IAP build — tracked in
`09_Operations/iOS_Submission_Checklist_2026-06-25.md`.

SPEC IMPACT: None on web/Android product behavior — additive native iOS shell
+ a Team-ID fill-in on an existing placeholder AASA. iOS digital-SKU IAP is a
separate v1.1 decision (logged in DECISION_LOG 2026-06-25).
