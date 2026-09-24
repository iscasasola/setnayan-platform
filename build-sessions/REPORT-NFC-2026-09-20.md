# Report to the controller — NFC Writer for QR codes (session "NFC Writer for QR Codes", 2026-09-20)

**PR #5721 · auto-merge armed · branch `claude/every-qr-can-be-a-tap` · worktree `~/Documents/Claude/Projects/wt-nfc` · commit a9284d5143 on #5717.** No migration.

## What it is
Owner "go" 2026-09-20. Every QR that is a LINK carries one strip — **Download · Write to NFC · Copy link** (`app/_components/qr-actions.tsx`). Write to NFC (`nfc-write-button.tsx`) writes the QR's own URL as one NDEF URL record onto a blank sticker so a phone TAPS instead of scans. Tags open on iPhone and Android; only WRITING is Chrome-on-Android (Web NFC). Supersedes the 2026-07-01 "NFC → V2" and 2026-06-12 "QR-only" rows for the web strip (new DECISION_LOG row written).

## Flag — ships OFF
`NEXT_PUBLIC_NFC_WRITE_ENABLED` (`lib/nfc-write-flag.ts`, registered in `flag-chokepoint-scan.test.ts`). A real tap is the only proof; no session can produce one. Owner's step after merge: one tap on an Android phone in Chrome with a blank NTAG213, then flip the flag in Vercel. Download + Copy are live, unflagged.

## Files held until merge (collision table)
`dashboard/[eventId]/invitation/page.tsx` · `guests/invite/page.tsx` · `website/editor/_components/editor-shell.tsx` · `studio/custom-qr-guest/page.tsx` · `[slug]/_components/guest-code-keepers.tsx` · `vendor-dashboard/_components/qr-section.tsx` · `vendor-dashboard/invite/page.tsx` · `vendor-dashboard/locked-qr/page.tsx` · `vendor-dashboard/on-the-day/_components/guest-review-qr.tsx`.
New: `lib/nfc-tag.ts` (+test) · `lib/nfc-write-flag.ts` · `lib/qr-download.ts` · `app/_components/{nfc-write-button,qr-actions}.tsx` · guard `app/_components/every-qr-carries-the-strip.test.ts` (pins mount COUNT per file; forbids the strip on the 3 payment QRs and the crew pairing QR).

## Verified
nfc-tag 8/8 · strip guard 4/4 with 3 mutations proven red · flag scan + env-flag green · all 112 guards reading touched files green · tsc exit 0 · next lint clean. NOT verified: the physical tap.

## Owner calls surfaced
1. Crew pairing QR is `setnayan://` with no https receiver — so it has no tag. Make it an https link? (small, separate)
2. PR 2: iOS in-app writing = Capacitor NFC plugin in `apps/mobile` + NFC entitlement + App Store re-review. Needs a go. (The iOS shell EXISTS — submitted 2026-06-25; it is not "Phase 2".)

The session prunes wt-nfc itself after merge.

## Update 2026-09-20
First CI run failed one guard: "port keeps every control". Cause: three vendor pages no longer mount <CopyButton> directly because it now renders inside <QrActions>; Copy link is still on every page. Fixed by regenerating the port-control baseline from the tree merged with origin/main (commit 55019f321). The only real removals are those three CopyButton lines. CI re-running, auto-merge still armed.

## PR 2 — iOS/Android in-app writing: #5726 (auto armed, stacked on #5721)
Capgo NFC plugin 8.2.8 in apps/mobile; iOS entitlement TAG (not NDEF) + NFCReaderUsageDescription; unsigned iPhone Release build compiled clean. Files held until merge: apps/mobile/{package.json, package-lock.json, ios/App/App/App.entitlements, ios/App/App/Info.plist, ios/App/CapApp-SPM/Package.swift, android/capacitor.settings.gradle, android/app/capacitor.build.gradle}, apps/web/app/_components/nfc-write-button.tsx, apps/web/lib/nfc-tag.ts. Owner steps: enable NFC Tag Reading on the App ID in the Apple Developer portal, bump build, archive, upload, App Review; rebuild the Android app. Not verified here: a real tap, and the Android Gradle build (no Android SDK on this Mac).

## PR 3 — NFC check-in: #5731 (auto armed, stacked on #5726)
Desk reads guest tags; migration 20271234853164 (guest_checkins.method + nfc_tap, pipeline-applied on merge); per-phone ?nfc-test=1 switch because the owner has only an iPhone. Files held: guests/checkin/{actions.ts,_components/checkin-desk.tsx}, app/layout.tsx, app/_components/{nfc-runtime,use-nfc-tag-reader,use-nfc-enabled,nfc-write-button}, lib/nfc-*. #5721 MERGED 18:05Z.
- ✅ #5726 MERGED (18:27Z). #5731 still in CI.
- ✅ #5731 MERGED (19:11Z). All three NFC PRs merged; all NFC worktrees pruned. Remaining: owner steps in build-sessions/NFC-OWNER-STEPS.md.

## 2026-09-20 — iOS 1.0 build 3 SUBMITTED for App Review
NFC live in prod (flag ON). Listing + review notes: build-sessions/APP-STORE-LISTING-DRAFT.md. Open follow-ups: (a) Apple CDN still serves the OLD app-site-association, so tags open Safari until it refreshes (~24h, no action); (b) Android app needs a rebuild for its half of the app-link fix, and assetlinks.json still holds a placeholder fingerprint; (c) PR #5766 (privacy-declaration guard) in CI.
