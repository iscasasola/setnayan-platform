## 2026-09-20 · chore(mobile): the iOS project carries its signing team and build 3

Two values the repo did not hold, found while producing the first NFC build:

- **`DEVELOPMENT_TEAM` was unset** in both Release and Debug configurations, so
  a fresh clone could not sign at all — Xcode would stop at "Signing requires a
  development team" until someone picked one by hand. Set to `P95JPDWWB3`,
  which is already public in this repo (`apps/web/public/.well-known/apple-app-site-association`
  carries `P95JPDWWB3.com.setnayan.app`).
- **`CURRENT_PROJECT_VERSION` was 2**, the number already uploaded on
  2026-06-25. Raised to 3 for the NFC build.

Verified by producing the real artefacts from this tree: `xcodebuild archive`
→ ARCHIVE SUCCEEDED, then `-exportArchive` with `method: app-store-connect` →
`App.ipa`, signed **Apple Distribution: Indalecio Casasola (P95JPDWWB3)**,
entitlements carrying `com.apple.developer.nfc.readersession.formats = [TAG]`,
and the binary containing CoreNFC + the plugin's own session code.

SPEC IMPACT: None.
