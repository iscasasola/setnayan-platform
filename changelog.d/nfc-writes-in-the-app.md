## 2026-09-20 · feat(mobile): "Write to NFC" writes tags inside the Setnayan iOS and Android app

PR 2 of the NFC strip (PR 1 = #5721). The same button now writes tags inside
the Capacitor app, on iPhone through CoreNFC, via `@capgo/capacitor-nfc`
8.2.8 (Capacitor 8, Swift Package Manager; pinned exact). `npx cap sync` wired
it into `ios/App/CapApp-SPM/Package.swift` and the Android Gradle settings.

iOS: `App.entitlements` gains `com.apple.developer.nfc.readersession.formats
= [TAG]` — NOT `NDEF`, which App Store upload refuses (ITMS-90778); TAG covers
NDEF reader sessions. `Info.plist` gains `NFCReaderUsageDescription`. An
unsigned Release build for a real iPhone target compiled clean with the plugin
(`xcodebuild … generic/platform=iOS CODE_SIGNING_ALLOWED=NO` → BUILD
SUCCEEDED). Android: the app manifest already declared the NFC permission.

Web (`app/_components/nfc-write-button.tsx`): three writers behind one sheet —
the app's native plugin first (only when `Capacitor.isPluginAvailable
('CapacitorNfc')`, so an app build from before this PR falls through safely;
the web deploys ahead of App Review), then Web NFC in Chrome, then the
copy-the-link sheet. The plugin cannot read back the tag it just wrote in
the same touch, so on the app confirmation is a SECOND TAP ("Tap the tag
once more to confirm"). Every path now ends in `settle(found, target)`, the
ONE place success is set, and only when `readBackMatches`; the guard counts
producers of the success state and fails on a second one. Fixed along the
way: a timeout inside a session could throw where nothing caught it and
leave the sheet spinning.

`lib/nfc-tag.ts` gains the byte-level pieces the plugin needs: the full NFC
Forum URI identifier table, `ndefUriRecord` (encode), `decodeNdefUriRecords`
(read back, including absolute-URI records; unknown records skipped, never
guessed), `classifyNativeNfcError`, `sessionEndReason`, and a `no-nfc`
reason. The byte budget now uses the same table as the encoder, and a test
pins that they agree.

Guards: `lib/nfc-tag.test.ts` (11) · `every-qr-carries-the-strip.test.ts`
(5, incl. the iOS entitlement/usage-string/SPM/Gradle wiring), each new rule
mutation-checked red (a second success producer, success without read-back,
an `NDEF` entitlement).

Still the flag `NEXT_PUBLIC_NFC_WRITE_ENABLED` (OFF). Owner steps before this
reaches an iPhone: enable "NFC Tag Reading" on the App ID in the Apple
Developer portal (automatic signing picks it up), bump the build number,
archive and upload, App Review. The Android app needs a rebuild too.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 NFC row — the iOS-write half now
built (row amended). No schema · no SKU · no price.
