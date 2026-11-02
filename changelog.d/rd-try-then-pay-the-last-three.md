## 2026-09-29 · feat(maker): try-then-pay reaches the last three Pro tools — the QR look, music + hero video, the gallery

Owner, verbatim: *"yes to all 3, do the follow-up"* (DECISION_LOG "TRY-THEN-PAY REACHES THE LAST THREE PRO TOOLS…"). Stacked on train f (#6091).

- **The Pro QR look** (Shape · Pattern · Colour, with the couple's logo in the centre): `updateQrStyle` now saves into the Event Hub draft as `style_preferences: { qr }` (same export, +0 server actions) instead of refusing a couple without Pro. The Details preview draws the draft for a verified host only (`/api/website/qr/<slug>?draft=1`, `private, no-store`). Apply MERGES the drafted `qr` into the live blob through the admin client, so the couple's other keys (onboarding answers) are never lost; the draft can hold only `qr`.
- **Background music + hero video** (`updateSiteChrome`) and **the gallery** (`updateOurPhotos`): `draft=1` takes the draft door before any Pro question; the Maker panels post it and show what is drafted. Apply holds each new file that is not in this event's own folder, re-screens every new gallery photo (fail-closed), and stamps the song's source / switches it off with no song, as the live writer does.
- **Named on the Apply sheet** from the same plan: "QR look · Your QR code", "Background music · Whole Event Hub", "Hero video · Hero", "Your photos · Photos you add" — each can be taken off. Switching an existing song on or off stays free.
- **An empty scene of their own** (hidden or already visible) takes its first words into the draft for a couple without Pro, instead of a live save the server refused; filling an empty scene is Pro at Apply ("Words · …"); words a scene already has stay free and live. New draft field `custom` on `custom_*` rows.
- **Love Story** rows on the sheet stay "Go to" only (tested).
- Tests: new `lib/try-then-pay-the-last-three.test.ts`; re-pointed `lib/every-maker-form-drafts-or-says-so.test.ts` (the two media panels are draft doors now; the QR is a draft door; one per-row mark for a scene's words), `lib/hub-draft.test.ts` (two columns priced by their own rule), `lib/a-section-of-your-own-is-pro-and-laid-out.test.ts` (empty scene's words draft).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — new row "AS BUILT — TRY-THEN-PAY REACHES THE LAST THREE PRO TOOLS".
