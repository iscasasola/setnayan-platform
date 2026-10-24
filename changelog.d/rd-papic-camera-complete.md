## 2026-10-24 · feat(papic): the complete guest camera — one camera, a Pro dress, a mark on the photos' copies

Owner, 24 Oct: "Okay build it" on `prototypes/papic_camera_complete_2026-10-24_fable.html`, then the final style
ruling: *"Free: plain camera with a small Setnayan mark on saved photos. Pro: their logo on the shutter, theme
colours, and their monogram on saved photos. No frames."* Stacked on #6849 (save first, send later).

- **The camera, complete** (`papic-guest-capture.tsx` + `guest-camera-tools.tsx`, `tag-scanner-overlay.tsx`,
  `my-shots-sheet.tsx`): rule-of-thirds grid (remembered on the device) · Selfie ⇄ Main pill (selfie mirrored) ·
  .5 / 1 / 2× zoom — 2× on every phone, a digital crop where the track's own zoom cannot reach it; the selfie
  camera drops 0.5× (`lib/papic-camera-steps.ts`) · Photo ⇄ Snippet (Snippet: tap starts, tap stops; hold still
  records in Photo) · tap-to-focus only where the track reports a focus mode · "My shots" as a sheet over the
  camera (this phone's shots; still-waiting shots marked; no navigation) · "Tag who's in it" beside the shutter,
  a framed scanner over the viewfinder, "✓ Ana Reyes tagged" / "✓ Table 4 · 8 added" · the share line compacted
  to one line + ⓘ · the save-first chip says "Ready ⓘ" at rest. No flash, no torch.
- **One camera, no looks**: Classic / Your brand / Challenges are gone (`lib/camera-look*.ts` deleted, the
  Maker's Camera Style dropdown and all `camera_look` draft plumbing removed, the Challenges chips layout
  retired). A stored `style_preferences.camera_look` is ignored; no data migration (zero events had one).
  The Maker's Camera part draws the one camera face. Gate 31 → "Your logo and colours on the Papic camera, your
  monogram on its photos", home Logo & QR.
- **Pro dress** (`lib/camera-dress.ts`): Pro = the event's Logo & QR part or Full Pro (`eventHubPartActive`):
  the event's logo on a white shutter, the theme colour on corners and pills. Free = the plain camera.
- **The mark** (`lib/papic-photo-mark.ts`, `lib/papic-photo-mark-of-event.ts`): burned into the COPIES only —
  thumb · tile · display · clip poster — on the phone, in the uploader's background prepare step; never the
  original. Free → the Setnayan mark; Pro → the couple's monogram (Setnayan mark when they have none).

SPEC IMPACT: DECISION_LOG 2026-10-24 "ONE PAPIC CAMERA — THE COMPLETE DESIGN IS THE ONLY STYLE; FREE WEARS A
SETNAYAN MARK, PRO WEARS THE COUPLE'S BRAND" (corpus 832625cb, already recorded) supersedes "THE CAMERA HAS ITS
OWN THREE LAYOUTS" (2026-10-06). No further corpus edit in this PR.
