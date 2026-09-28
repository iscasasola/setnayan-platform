## 2026-09-28 · feat(maker): a scene's "Upload media" is always there, uploads in place, and a photo can be Parallax

Owner, verbatim: *"where is the upload media/: photo parallax effect or snippet
that would run like the background?"* (DECISION_LOG 2026-09-28 "“UPLOAD MEDIA”
ON A SCENE BACKGROUND IS ALWAYS THERE…"), built under the same day's rule *"they
can edit it with pro features. but need to upgrade to pro when clicked on
apply"*.

- **Always drawn, open to every couple.** The scene Format → Background row
  draws Upload media even with no picture at all (it was `ownsPro && hasMedia`).
  A free couple picks, uploads and sees media on the Maker canvas, in the DRAFT;
  a small ◆ mark says it is Pro, never a padlock. Apply still holds it without
  Event Hub Pro (`planHubDraftApply` / `canvasFreePart`, unchanged — the new keys
  are Pro look keys). The app-store shell's free couple is not shown it.
- **The couple's pictures:** hero · gallery · the Save the Date's own UPLOADED
  background (signed in the editor page's one `Promise.all`; Apply's "every photo
  is the couple's own" accepts it) · the one video · a scene's own uploads.
- **Upload in place:** the shipped `<FileUpload>` (compressImage / compressVideo,
  15 s, silent) into `events/<id>/scene-background/` — the Main background's
  pattern, +0 server actions; Apply accepts that folder like `main-background/`;
  it counts on the Maker media meter. A clip's still is grabbed in the browser
  and uploaded beside it (`lib/upload-still.ts`, shared with the Main background).
- **Motion: Still · Parallax** (one PickMenu) on a photo — the SHIPPED hero
  parallax: the photo layer wears `data-pahina-parallax`, `PahinaCoverParallax`
  now re-reads its layers each frame (scenes stream in after it, and the Maker
  turns Parallax on in place), one CSS rule folds the couple's zoom into the
  ±6% / 1.16 pair, reduced motion stands it still. Stored as
  `canvas.mediaMotion` (no migration).
- **A snippet** plays muted, looping, inline, cover-fitted and only while on
  screen (the shipped `SceneClip`) — on the couple's own Maker canvas
  (`ownClipPlays`, a verified host). ⚠ Guests still never get an unscreened clip
  (SEC-6, `GUEST_HERO_VIDEO_PLAYBACK = false`, untouched): they now see the
  clip's still (`canvas.poster`) as the scene's photo instead of an empty card.

Guards: `lib/scene-upload-media.test.ts`; `hub-canvas-frame-snippet-gate.test.ts`
updated for the host exception and SceneClip.

SPEC IMPACT: DECISION_LOG row "AS BUILT — SCENE UPLOAD MEDIA" (corpus) — records
the deviations: guests see a clip's still until SEC-6 opens; a Save the Date
LIBRARY scene is not offered (it is not the couple's photo).
