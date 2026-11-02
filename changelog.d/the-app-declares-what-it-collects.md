## 2026-09-20 · test(privacy): the iOS app's declarations must keep matching what Apple was told

Found while filling the App Privacy page for the v1.0 resubmission: App Store
Connect said **"Data Not Linked to You"** while `PrivacyInfo.xcprivacy` inside
the shipped build declared email, name and photos as **linked**. Two answers to
one question, caught only by a human reading two screens. The owner republished
the page as "Data Linked to You"; this guard stops the pair drifting again.

**The one that can go wrong silently is LOCATION.** The web app does collect
precise location in one place — Papic capture stamps lat/lon when the
`papic_geo_metadata` control is active (it is, in prod), and
`isStoreShellWebOnlyPath('/papic/seat/…')` is **false**, so that route is NOT
blocked in the app. It never reaches the app only because the iOS project has
no location usage string, so iOS refuses the WebView's request. That absence is
the entire basis for answering "no location" to Apple. Adding
`NSLocationWhenInUseUsageDescription` is a one-line change that looks harmless
and would make the published privacy answers false, with nobody told.

`apps/web/lib/the-app-declares-what-it-collects.test.ts` pins three things:
no location usage string (with the exact remediation steps in the failure
message), the manifest's collected types + linked/tracking flags against what
Apple was told, and that every usage string is specific enough for App Review.

Mutation-checked: a location key added, a type flipped to not-linked, and a
usage string reduced to "Camera access" — each red. Two bugs in the guard's own
first draft were caught this way: a pattern that swept up `Linked`/`Tracking`
strings as if they were data types, and one that missed `NFCReaderUsageDescription`
because it assumed every usage key starts with `NS` (it counted 4 of 5).

SPEC IMPACT: None — the published answers already match.
